package com.retroconsole.app

import android.content.Intent
import android.os.Bundle
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.WindowManager
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.retroconsole.app.console.ConsoleButton
import com.retroconsole.app.ui.RetroRoot
import com.retroconsole.app.ui.RetroTheme

class MainActivity : AppCompatActivity() {
    private val graph get() = (application as RetroApp).graph
    private var consoleVisible = true
    private val axisOn = mutableMapOf<ConsoleButton, Boolean>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
        )
        graph.console.start()
        handleIntent(intent)
        setContent {
            RetroTheme { RetroRoot(graph, ::onConsoleVisible) }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    override fun onStart() { super.onStart(); graph.console.onStart() }
    override fun onStop() { super.onStop(); graph.console.onStop() }

    /** Links (`retrogame://install?url=https://…`) and shared/opened game files ask for an install confirmation. */
    private fun handleIntent(i: Intent?) {
        val data = i?.data ?: return
        if (i.action != Intent.ACTION_VIEW) return
        when (data.scheme) {
            "retrogame" -> data.getQueryParameter("url")?.takeIf { it.startsWith("https://") }?.let { graph.pendingInstall.value = PendingInstall.FromUrl(it) }
            "content", "file" -> graph.pendingInstall.value = PendingInstall.FromFile(data)
            "https" -> graph.pendingInstall.value = PendingInstall.FromUrl(data.toString())
        }
        setIntent(Intent())
    }

    private fun onConsoleVisible(visible: Boolean) {
        consoleVisible = visible
        val c = WindowInsetsControllerCompat(window, window.decorView)
        c.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        if (visible) {
            c.hide(WindowInsetsCompat.Type.systemBars())
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
            c.show(WindowInsetsCompat.Type.systemBars())
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
        if (!visible) releaseAxes()
    }

    private fun mapKey(code: Int): ConsoleButton? = when (code) {
        KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_W -> ConsoleButton.UP
        KeyEvent.KEYCODE_DPAD_DOWN, KeyEvent.KEYCODE_S -> ConsoleButton.DOWN
        KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_A -> ConsoleButton.LEFT
        KeyEvent.KEYCODE_DPAD_RIGHT, KeyEvent.KEYCODE_D -> ConsoleButton.RIGHT
        KeyEvent.KEYCODE_BUTTON_A, KeyEvent.KEYCODE_BUTTON_X, KeyEvent.KEYCODE_SPACE, KeyEvent.KEYCODE_Z, KeyEvent.KEYCODE_J, KeyEvent.KEYCODE_DPAD_CENTER -> ConsoleButton.A
        KeyEvent.KEYCODE_BUTTON_B, KeyEvent.KEYCODE_BUTTON_Y, KeyEvent.KEYCODE_X, KeyEvent.KEYCODE_K -> ConsoleButton.B
        KeyEvent.KEYCODE_BUTTON_START, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER, KeyEvent.KEYCODE_P -> ConsoleButton.START
        else -> null
    }

    /** Bluetooth/USB gamepads and keyboards drive the console exactly like the on-screen keys. */
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (consoleVisible) {
            val b = mapKey(event.keyCode)
            if (b != null) {
                if (event.repeatCount == 0) graph.console.press(b, event.action == KeyEvent.ACTION_DOWN)
                return true
            }
            if ((event.keyCode == KeyEvent.KEYCODE_BUTTON_SELECT || event.keyCode == KeyEvent.KEYCODE_ESCAPE) && event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
                graph.console.home()
                return true
            }
        }
        return super.dispatchKeyEvent(event)
    }

    override fun onGenericMotionEvent(ev: MotionEvent): Boolean {
        if (consoleVisible && ev.source and InputDevice.SOURCE_JOYSTICK == InputDevice.SOURCE_JOYSTICK && ev.action == MotionEvent.ACTION_MOVE) {
            val x = ev.getAxisValue(MotionEvent.AXIS_HAT_X).takeIf { it != 0f } ?: ev.getAxisValue(MotionEvent.AXIS_X)
            val y = ev.getAxisValue(MotionEvent.AXIS_HAT_Y).takeIf { it != 0f } ?: ev.getAxisValue(MotionEvent.AXIS_Y)
            setAxis(ConsoleButton.LEFT, x < -0.5f)
            setAxis(ConsoleButton.RIGHT, x > 0.5f)
            setAxis(ConsoleButton.UP, y < -0.5f)
            setAxis(ConsoleButton.DOWN, y > 0.5f)
            return true
        }
        return super.onGenericMotionEvent(ev)
    }

    private fun setAxis(b: ConsoleButton, on: Boolean) {
        if (axisOn[b] == on) return
        axisOn[b] = on
        graph.console.press(b, on)
    }

    private fun releaseAxes() {
        axisOn.filterValues { it }.keys.forEach { graph.console.press(it, false) }
        axisOn.clear()
    }
}
