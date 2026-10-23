package com.retroconsole.app.data

import android.content.Context
import com.retroconsole.app.BuildConfig
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class Settings(
    val skin: String = "classic",
    /** color | gb | brick */
    val lcd: String = "color",
    val grid: Boolean = false,
    val sound: Boolean = true,
    val volume: Float = 0.7f,
    val vibrate: Boolean = true,
    val leftHanded: Boolean = false,
    val buttonScale: Float = 1f,
    /** system | en | fr | ar */
    val language: String = "system",
    val autoUpdate: Boolean = true,
    val storeUrl: String = BuildConfig.DEFAULT_STORE_URL,
    val bootAnimation: Boolean = true,
)

class SettingsStore(context: Context) {
    private val prefs = context.getSharedPreferences("settings", Context.MODE_PRIVATE)
    private val _state = MutableStateFlow(load())
    val state: StateFlow<Settings> = _state.asStateFlow()
    val value: Settings get() = _state.value

    private fun load(): Settings {
        val d = Settings()
        return Settings(
            skin = prefs.getString("skin", d.skin) ?: d.skin,
            lcd = prefs.getString("lcd", d.lcd) ?: d.lcd,
            grid = prefs.getBoolean("grid", d.grid),
            sound = prefs.getBoolean("sound", d.sound),
            volume = prefs.getFloat("volume", d.volume),
            vibrate = prefs.getBoolean("vibrate", d.vibrate),
            leftHanded = prefs.getBoolean("leftHanded", d.leftHanded),
            buttonScale = prefs.getFloat("buttonScale", d.buttonScale),
            language = prefs.getString("language", d.language) ?: d.language,
            autoUpdate = prefs.getBoolean("autoUpdate", d.autoUpdate),
            storeUrl = prefs.getString("storeUrl", d.storeUrl)?.takeIf { it.isNotBlank() } ?: d.storeUrl,
            bootAnimation = prefs.getBoolean("bootAnimation", d.bootAnimation),
        )
    }

    fun update(transform: (Settings) -> Settings) {
        val next = transform(_state.value)
        _state.value = next
        prefs.edit()
            .putString("skin", next.skin)
            .putString("lcd", next.lcd)
            .putBoolean("grid", next.grid)
            .putBoolean("sound", next.sound)
            .putFloat("volume", next.volume)
            .putBoolean("vibrate", next.vibrate)
            .putBoolean("leftHanded", next.leftHanded)
            .putFloat("buttonScale", next.buttonScale)
            .putString("language", next.language)
            .putBoolean("autoUpdate", next.autoUpdate)
            .putString("storeUrl", next.storeUrl)
            .putBoolean("bootAnimation", next.bootAnimation)
            .apply()
    }
}
