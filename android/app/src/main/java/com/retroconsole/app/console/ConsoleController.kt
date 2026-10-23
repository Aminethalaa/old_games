package com.retroconsole.app.console

import android.app.Application
import android.util.Log
import com.retroconsole.app.AppGraph
import com.retroconsole.app.data.InstalledGame
import java.util.Locale
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

/** The physical buttons the player can press (the web side only ever sees these names). */
enum class ConsoleButton(val js: String) {
    UP("up"), DOWN("down"), LEFT("left"), RIGHT("right"), A("a"), B("b"), START("start")
}

sealed interface ConsoleEvent {
    /** The LCD menu asked to open a native page: store | trophies | settings | import. */
    data class Open(val target: String) : ConsoleEvent
}

/**
 * Owns the LCD WebView and the console state machine (power, home menu, running game) and routes
 * button presses, settings, lifecycle and bridge messages between the native UI and the web content.
 */
class ConsoleController(private val app: Application, private val graph: AppGraph) : LcdBridgeListener {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    var lcd = LcdView(app, this)
        private set

    private val _lcdGeneration = MutableStateFlow(0)
    /** Bumps when the WebView had to be rebuilt (its render process died); the UI re-attaches the new view. */
    val lcdGeneration: StateFlow<Int> = _lcdGeneration.asStateFlow()

    private val _power = MutableStateFlow(true)
    val power: StateFlow<Boolean> = _power.asStateFlow()

    private val _game = MutableStateFlow<InstalledGame?>(null)
    /** The game currently on the LCD, or null while the home menu is showing. */
    val game: StateFlow<InstalledGame?> = _game.asStateFlow()

    private val _pressed = MutableStateFlow<Set<ConsoleButton>>(emptySet())
    val pressed: StateFlow<Set<ConsoleButton>> = _pressed.asStateFlow()

    private val _events = MutableSharedFlow<ConsoleEvent>(extraBufferCapacity = 8)
    val events: SharedFlow<ConsoleEvent> = _events.asSharedFlow()

    private var started = false
    private var launchedAt = 0L
    private var covered = false
    private var homeRevision = -1

    private var lastGameId: String? = null

    private fun showHome(boot: Boolean) {
        homeRevision = graph.installer.changes.value
        lcd.loadHome(boot, lastGameId)
    }

    /** Loads the first page. Safe to call more than once. */
    fun start() {
        if (started) return
        started = true
        showHome(boot = graph.settings.value.bootAnimation)
        val s = graph.settings
        scope.launch { s.state.map { it.sound }.distinctUntilChanged().drop(1).collect { lcd.cmd("sound", it) } }
        scope.launch { s.state.map { it.volume }.distinctUntilChanged().drop(1).collect { lcd.cmd("volume", it) } }
        scope.launch { s.state.map { it.lcd }.distinctUntilChanged().drop(1).collect { lcd.cmd("lcd", it) } }
        scope.launch { s.state.map { it.grid }.distinctUntilChanged().drop(1).collect { lcd.cmd("grid", it) } }
        scope.launch { s.state.map { it.vibrate }.distinctUntilChanged().drop(1).collect { lcd.cmd("vibrate", it) } }
        scope.launch { s.state.map { it.language }.distinctUntilChanged().drop(1).collect { if (_game.value == null && _power.value) showHome(false) } }
    }

    // ------------------------------------------------------------------ buttons

    fun press(button: ConsoleButton, down: Boolean) {
        _pressed.value = if (down) _pressed.value + button else _pressed.value - button
        if (!_power.value || covered) return
        lcd.button(button.js, down)
    }

    private fun releaseAll() {
        _pressed.value.forEach { lcd.button(it.js, false) }
        _pressed.value = emptySet()
    }

    fun togglePower() {
        if (_power.value) {
            leaveGame()
            releaseAll()
            _power.value = false
            lcd.blank()
        } else {
            _power.value = true
            _game.value = null
            showHome(boot = graph.settings.value.bootAnimation)
        }
    }

    fun toggleSound() {
        graph.settings.update { it.copy(sound = !it.sound) }
    }

    /** RESET: restart the running game, or reload the menu. */
    fun reset() {
        if (!_power.value) return
        val g = _game.value
        if (g == null) showHome(false)
        else if (g.manifest.compat) lcd.loadGame(g.url, true)
        else lcd.cmd("reset")
    }

    /** HOME: leave the game (it saves itself) and show the menu. */
    fun home() {
        if (!_power.value) return
        if (_game.value != null) { lcd.cmd("save"); leaveGame() }
        releaseAll()
        showHome(false)
    }

    fun launch(id: String) {
        val g = graph.library.find(id) ?: return
        leaveGame()
        _game.value = g
        lastGameId = g.id
        launchedAt = System.currentTimeMillis()
        graph.progress.recordLaunch(g.id)
        lcd.loadGame(g.url, g.manifest.compat)
    }

    private fun leaveGame() {
        val g = _game.value ?: return
        if (launchedAt > 0) graph.progress.addPlayTime(g.id, System.currentTimeMillis() - launchedAt)
        launchedAt = 0
        _game.value = null
    }

    /** True when back should return to the menu instead of leaving the app. */
    fun handleBack(): Boolean {
        if (_power.value && _game.value != null) { home(); return true }
        return false
    }

    // ---------------------------------------------------------------- lifecycle

    /** A native page (store, settings...) covers the console: pause the game and ignore buttons. */
    fun setCovered(value: Boolean) {
        if (covered == value) return
        covered = value
        if (value) { releaseAll(); lcd.cmd("pause"); lcd.cmd("save"); lcd.onPause() }
        else {
            lcd.onResume()
            // the menu only needs a reload when games were installed/removed meanwhile
            if (_game.value == null && _power.value && homeRevision != graph.installer.changes.value) showHome(false)
        }
    }

    fun onStop() { lcd.cmd("pause"); lcd.cmd("save"); releaseAll(); lcd.onPause() }
    fun onStart() { if (!covered) lcd.onResume() }

    /** A WebView whose render process died is unusable: replace it, then show the menu again. */
    private fun rebuildLcd() {
        val old = lcd
        leaveGame()
        releaseAll()
        lcd = LcdView(app, this)
        _lcdGeneration.value = _lcdGeneration.value + 1
        scope.launch {
            kotlinx.coroutines.delay(300)
            (old.webView.parent as? android.view.ViewGroup)?.removeView(old.webView)
            runCatching { old.destroy() }
        }
        if (_power.value) showHome(false) else lcd.blank()
    }

    // -------------------------------------------------------------------- bridge

    private fun lang(): String {
        val l = graph.settings.value.language
        return if (l == "system") Locale.getDefault().language.take(2) else l
    }

    override fun initJson(): String {
        val s = graph.settings.value
        val g = _game.value
        val o = JSONObject()
        o.put("gameId", g?.id ?: "")
        o.put("lang", lang())
        o.put("sound", s.sound)
        o.put("volume", s.volume.toDouble())
        o.put("lcd", s.lcd)
        o.put("grid", s.grid)
        o.put("vibrate", s.vibrate)
        if (g != null) {
            o.put("hi", graph.progress.hiScore(g.id))
            o.put("save", graph.progress.save(g.id) ?: JSONObject.NULL)
            o.put("unlocked", JSONArray(graph.progress.achievements(g.id).toList()))
        }
        return o.toString()
    }

    override fun libraryJson(): String = graph.library.libraryJson(lang())

    override fun onMessage(type: String, payload: JSONObject) {
        val g = _game.value
        when (type) {
            "launch" -> launch(payload.optString("id"))
            "open" -> {
                val target = payload.optString("target")
                if (target in setOf("store", "trophies", "settings", "import")) _events.tryEmit(ConsoleEvent.Open(target))
            }
            "hiscore" -> if (g != null) graph.progress.submitHiScore(g.id, payload.optLong("value"))
            "achievement" -> if (g != null) graph.progress.unlock(g.id, payload.optString("id"))
            "save" -> if (g != null) graph.progress.setSave(g.id, if (payload.isNull("data")) null else payload.optString("data"))
            "vibrate" -> graph.haptics.buzz(payload.optLong("ms", 20))
            "error" -> Log.w("RetroGame", "${g?.id}: ${payload.optString("message")}")
            "render-gone" -> rebuildLcd()
        }
    }
}
