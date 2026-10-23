package com.retroconsole.app.data

import android.content.Context
import java.io.File
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Hi-scores, achievements, play counters and save-and-resume blobs, per game id. */
class ProgressStore(context: Context) {
    private val prefs = context.getSharedPreferences("progress", Context.MODE_PRIVATE)
    private val saveDir = File(context.filesDir, "saves").apply { mkdirs() }

    private val _revision = MutableStateFlow(0)
    /** Bumps whenever anything changes, so screens can refresh. */
    val revision: StateFlow<Int> = _revision.asStateFlow()
    private fun bump() { _revision.value = _revision.value + 1 }

    fun hiScore(id: String): Long = prefs.getLong("hi_$id", 0L)

    fun submitHiScore(id: String, value: Long) {
        if (value > hiScore(id)) { prefs.edit().putLong("hi_$id", value).apply(); bump() }
    }

    fun achievements(id: String): Set<String> = prefs.getStringSet("ach_$id", emptySet()) ?: emptySet()

    fun unlock(id: String, achievement: String): Boolean {
        val cur = achievements(id)
        if (achievement in cur || achievement.length > 64) return false
        prefs.edit().putStringSet("ach_$id", cur + achievement).apply()
        bump()
        return true
    }

    fun plays(id: String): Int = prefs.getInt("plays_$id", 0)
    fun playTimeMs(id: String): Long = prefs.getLong("time_$id", 0L)
    fun lastPlayed(id: String): Long = prefs.getLong("last_$id", 0L)

    fun recordLaunch(id: String) {
        prefs.edit().putInt("plays_$id", plays(id) + 1).putLong("last_$id", System.currentTimeMillis()).apply()
        bump()
    }

    fun addPlayTime(id: String, ms: Long) {
        if (ms <= 0) return
        prefs.edit().putLong("time_$id", playTimeMs(id) + ms).apply()
        bump()
    }

    private fun saveFile(id: String) = File(saveDir, "$id.json")

    fun save(id: String): String? = runCatching { saveFile(id).takeIf { it.exists() }?.readText() }.getOrNull()

    fun setSave(id: String, data: String?) {
        runCatching {
            if (data == null) saveFile(id).delete() else if (data.length <= MAX_SAVE_CHARS) saveFile(id).writeText(data)
        }
    }

    fun forget(id: String) {
        prefs.edit().remove("hi_$id").remove("ach_$id").remove("plays_$id").remove("time_$id").remove("last_$id").apply()
        saveFile(id).delete()
        bump()
    }

    fun clearAll() {
        prefs.edit().clear().apply()
        saveDir.listFiles()?.forEach { it.delete() }
        bump()
    }

    fun totalPlayTimeMs(ids: Collection<String>): Long = ids.sumOf { playTimeMs(it) }

    companion object { const val MAX_SAVE_CHARS = 250_000 }
}
