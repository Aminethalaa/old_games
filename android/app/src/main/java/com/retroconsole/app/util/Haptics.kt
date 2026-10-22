package com.retroconsole.app.util

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.retroconsole.app.data.SettingsStore

class Haptics(context: Context, private val settings: SettingsStore) {
    private val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= 31) {
        (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
    } else {
        @Suppress("DEPRECATION") context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }

    /** Short buzz used by games (collisions, line clears...). Honors the Vibration setting. */
    fun buzz(ms: Long) {
        if (!settings.value.vibrate) return
        val v = vibrator ?: return
        if (!v.hasVibrator()) return
        val d = ms.coerceIn(1L, 500L)
        if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(d, VibrationEffect.DEFAULT_AMPLITUDE))
        else @Suppress("DEPRECATION") v.vibrate(d)
    }
}
