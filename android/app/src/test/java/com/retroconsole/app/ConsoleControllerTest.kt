package com.retroconsole.app

import com.retroconsole.app.console.ConsoleButton
import com.retroconsole.app.console.ConsoleEvent
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.yield
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/** The console state machine and the JS bridge contract, against the real app graph and the real bundled assets. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = RetroApp::class)
class ConsoleControllerTest {
    private val graph get() = (RuntimeEnvironment.getApplication() as RetroApp).graph
    private val console get() = graph.console
    private val lastUrl get() = shadowOf(console.lcd.webView).lastLoadedUrl

    private fun msg(type: String, build: JSONObject.() -> Unit = {}) = console.onMessage(type, JSONObject().apply { put("type", type); build() })

    @Test fun startsOnTheHomeMenuWithBootAnimation() {
        console.start()
        assertTrue(lastUrl, lastUrl.endsWith("/shell/home.html?boot=1"))
        assertTrue(console.power.value)
        assertNull(console.game.value)
    }

    @Test fun launchingAndLeavingAGame() {
        console.start()
        msg("launch") { put("id", "block-stack") }
        assertEquals("block-stack", console.game.value?.id)
        assertEquals("https://appassets.androidplatform.net/builtin/block-stack/index.html", lastUrl)
        assertEquals(1, graph.progress.plays("block-stack"))

        // what the SDK would read for this page
        val init = JSONObject(console.initJson())
        assertEquals("block-stack", init.getString("gameId"))
        assertTrue(init.getBoolean("sound"))
        assertEquals("color", init.getString("lcd"))

        console.home()
        assertNull(console.game.value)
        assertTrue(lastUrl, lastUrl.endsWith("/shell/home.html?last=block-stack"))   // menu reopens on the game just played
        assertTrue(JSONObject(console.initJson()).getString("gameId").isEmpty())
    }

    @Test fun unknownGameIsIgnored() {
        console.start()
        msg("launch") { put("id", "does-not-exist") }
        assertNull(console.game.value)
    }

    @Test fun scoresAchievementsAndSavesArePersistedPerGame() {
        console.start()
        msg("launch") { put("id", "snake") }
        msg("hiscore") { put("value", 120) }
        msg("hiscore") { put("value", 80) }          // lower scores never overwrite
        msg("achievement") { put("id", "first-apple") }
        msg("achievement") { put("id", "first-apple") }
        msg("save") { put("data", "{\"x\":1}") }
        assertEquals(120L, graph.progress.hiScore("snake"))
        assertEquals(setOf("first-apple"), graph.progress.achievements("snake"))
        val init = JSONObject(console.initJson())
        assertEquals(120, init.getInt("hi"))
        assertEquals("{\"x\":1}", init.getString("save"))
        assertEquals("first-apple", init.getJSONArray("unlocked").getString(0))

        // a different game cannot see or touch snake's data
        msg("launch") { put("id", "block-stack") }
        assertEquals(0L, graph.progress.hiScore("block-stack"))
        assertTrue(JSONObject(console.initJson()).isNull("save"))

        msg("launch") { put("id", "snake") }
        msg("save") { put("data", JSONObject.NULL) }
        assertNull(graph.progress.save("snake"))
    }

    @Test fun libraryJsonListsBundledGamesWithIcons() {
        val lib = JSONObject(console.libraryJson())
        val games: JSONArray = lib.getJSONArray("games")
        assertTrue("expected the built-in games, got ${games.length()}", games.length() >= 6)
        val ids = (0 until games.length()).map { games.getJSONObject(it).getString("id") }
        assertTrue("block-stack" in ids && "snake" in ids)
        val g = games.getJSONObject(ids.indexOf("block-stack"))
        assertTrue(g.getBoolean("builtin"))
        assertEquals(12, g.getJSONObject("icon").getJSONArray("rows").length())
        assertTrue(g.getString("url").startsWith("https://appassets.androidplatform.net/builtin/block-stack/"))
    }

    @Test fun powerButtonBlanksAndRestoresTheScreen() {
        console.start()
        console.togglePower()
        assertFalse(console.power.value)
        assertEquals("about:blank", lastUrl)
        console.press(ConsoleButton.A, true)                 // ignored while off, but the key still lights up
        assertTrue(ConsoleButton.A in console.pressed.value)
        console.press(ConsoleButton.A, false)
        console.togglePower()
        assertTrue(console.power.value)
        assertTrue(lastUrl, lastUrl.contains("/shell/home.html"))
    }

    @Test fun menuTilesRequestNativePages(): Unit = runBlocking {
        console.start()
        val pending = async { withTimeout(2000) { console.events.first() } }
        yield()
        msg("open") { put("target", "store") }
        val e = pending.await()
        assertEquals("store", (e as ConsoleEvent.Open).target)
        // unknown targets are dropped
        msg("open") { put("target", "format-disk") }
    }

    @Test fun bridgeToleratesGarbage() {
        console.start()
        msg("hiscore") { put("value", "not a number") }      // no current game -> ignored
        msg("totally-unknown")
        msg("error") { put("message", "boom") }
        assertNotNull(console.initJson())
    }

    @Test fun backReturnsToTheMenuBeforeLeavingTheApp() {
        console.start()
        assertFalse(console.handleBack())
        msg("launch") { put("id", "snake") }
        assertTrue(console.handleBack())
        assertNull(console.game.value)
    }
}
