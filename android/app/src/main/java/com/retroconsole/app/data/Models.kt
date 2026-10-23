package com.retroconsole.app.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** Shared JSON configuration: tolerant of unknown keys so newer manifests/catalogs keep working. */
val AppJson = Json {
    ignoreUnknownKeys = true
    coerceInputValues = true
    encodeDefaults = true
    isLenient = false
}

/** Pixel-art icon: square grid of characters ('.' = transparent) + character -> "#rrggbb" palette. */
@Serializable
data class PixelIcon(
    val palette: Map<String, String> = emptyMap(),
    val rows: List<String> = emptyList(),
)

@Serializable
data class AchievementDef(
    val id: String,
    val name: String,
    val desc: String = "",
)

/** `manifest.json` of a game package (see docs/GAME_SDK.md). `sdk == 0` means "compat" (plain HTML5 game, keyboard emulation). */
@Serializable
data class GameManifest(
    val id: String,
    val name: String,
    val short: String? = null,
    val version: String = "1.0.0",
    val sdk: Int = 1,
    val author: String = "",
    val category: String = "arcade",
    val layout: String = "classic",
    val size: List<Int>? = null,
    val color: String = "#ffec27",
    val description: String = "",
    val controls: Map<String, String> = emptyMap(),
    val tags: List<String> = emptyList(),
    val achievements: List<AchievementDef> = emptyList(),
    val icon: PixelIcon? = null,
    val entry: String = "index.html",
) {
    val compat: Boolean get() = sdk < 1
}

/** A game that can be launched: either bundled in the APK assets or installed into app storage. */
data class InstalledGame(
    val manifest: GameManifest,
    val builtin: Boolean,
    val installedAt: Long = 0L,
) {
    val id: String get() = manifest.id
    val url: String
        get() = "https://${LcdHost.DOMAIN}/${if (builtin) "builtin" else "installed"}/${manifest.id}/${manifest.entry}"
}

object LcdHost {
    const val DOMAIN = "appassets.androidplatform.net"
}

object Categories {
    /** Display order of the categories everywhere (menu, store, trophies). */
    val order = listOf("classic", "arcade", "puzzle", "action")
    fun rank(category: String): Int = order.indexOf(category).let { if (it < 0) order.size else it }
}

val ID_REGEX = Regex("^[a-z0-9][a-z0-9-]{1,40}$")

/** Returns -1/0/1 comparing two dotted numeric versions ("1.2.10" > "1.2.9"). Missing parts count as 0. */
fun compareVersions(a: String, b: String): Int {
    val pa = a.split('.').map { it.toIntOrNull() ?: 0 }
    val pb = b.split('.').map { it.toIntOrNull() ?: 0 }
    for (i in 0 until maxOf(pa.size, pb.size)) {
        val x = pa.getOrElse(i) { 0 }
        val y = pb.getOrElse(i) { 0 }
        if (x != y) return if (x < y) -1 else 1
    }
    return 0
}
