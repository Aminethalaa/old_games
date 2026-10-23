package com.retroconsole.app.data

import android.content.Context
import java.io.File
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray

/** Everything that can be launched: games bundled in assets + games installed into app storage. */
class GameLibrary(private val context: Context, private val progress: ProgressStore) {
    val gamesRoot: File = File(context.filesDir, "games").apply { mkdirs() }

    private val builtinCache: List<InstalledGame> by lazy { loadBuiltin() }

    private fun loadBuiltin(): List<InstalledGame> {
        val assets = context.assets
        // AssetManager.list returns direct children on devices; some environments return nested paths, so keep only the first segment
        val ids = runCatching { assets.list("web/games/builtin")?.map { it.substringBefore('/') }?.distinct() }.getOrNull().orEmpty()
        return ids.mapNotNull { id ->
            runCatching {
                val text = assets.open("web/games/builtin/$id/manifest.json").bufferedReader().use { it.readText() }
                InstalledGame(AppJson.decodeFromString<GameManifest>(text), builtin = true)
            }.getOrNull()
        }
    }

    fun builtinIds(): Set<String> = builtinCache.map { it.id }.toSet()

    fun installed(): List<InstalledGame> {
        val builtin = builtinIds()
        return gamesRoot.listFiles { f -> f.isDirectory && !f.name.startsWith(".") }.orEmpty().mapNotNull { dir ->
            if (dir.name in builtin) return@mapNotNull null
            runCatching {
                val text = File(dir, "manifest.json").readText()
                InstalledGame(AppJson.decodeFromString<GameManifest>(text), builtin = false, installedAt = dir.lastModified())
            }.getOrNull()
        }
    }

    fun all(): List<InstalledGame> =
        (builtinCache + installed()).sortedWith(
            compareBy<InstalledGame> { Categories.rank(it.manifest.category) }.thenBy { !it.builtin }.thenBy { it.manifest.name.lowercase() }
        )

    fun find(id: String): InstalledGame? = all().firstOrNull { it.id == id }

    fun isInstalled(id: String): Boolean = find(id) != null

    fun installedVersion(id: String): String? = find(id)?.manifest?.version

    /** The JSON the console home screen (web/shell/home.js) reads through `RetroNative.getLibrary()`. */
    fun libraryJson(lang: String): String {
        val now = System.currentTimeMillis()
        val games = all().map { g ->
            val m = g.manifest
            val fresh = !g.builtin && progress.plays(g.id) == 0 && now - g.installedAt < NEW_WINDOW_MS
            buildJsonObject {
                put("id", m.id)
                put("name", m.name)
                put("short", m.short ?: m.name)
                put("category", m.category)
                put("color", m.color)
                put("description", m.description)
                put("url", g.url)
                put("builtin", g.builtin)
                put("installed", true)
                put("hi", progress.hiScore(g.id))
                put("isNew", fresh)
                put("compat", m.compat)
                m.icon?.let { icon ->
                    put("icon", buildJsonObject {
                        put("palette", JsonObject(icon.palette.mapValues { JsonPrimitive(it.value) }))
                        put("rows", JsonArray(icon.rows.map { JsonPrimitive(it) }))
                    })
                }
            }
        }
        return buildJsonObject {
            put("sdk", 1)
            put("lang", lang)
            putJsonArray("games") { games.forEach { add(it) } }
        }.toString()
    }

    companion object { const val NEW_WINDOW_MS = 3L * 24 * 60 * 60 * 1000 }
}
