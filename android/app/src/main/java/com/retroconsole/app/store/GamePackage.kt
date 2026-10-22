package com.retroconsole.app.store

import com.retroconsole.app.data.AppJson
import com.retroconsole.app.data.GameManifest
import com.retroconsole.app.data.ID_REGEX
import java.io.File
import java.io.IOException
import java.util.zip.ZipEntry
import java.util.zip.ZipFile

class InstallException(val code: Code, val detail: String = "", cause: Throwable? = null) : Exception("$code: $detail", cause) {
    enum class Code { TOO_LARGE, BAD_ARCHIVE, UNSAFE_PATH, BAD_FILE_TYPE, NO_INDEX, BAD_MANIFEST, ID_MISMATCH, ID_RESERVED, CHECKSUM, NETWORK, UNSUPPORTED_SDK, IO }
}

/**
 * Pure (Android-free) logic that validates a downloaded/imported game archive and unpacks it safely.
 * Games are arbitrary web content, so everything is allow-listed and size-capped.
 */
object GamePackage {
    const val MAX_ZIP_BYTES = 40L * 1024 * 1024
    const val MAX_UNPACKED_BYTES = 80L * 1024 * 1024
    const val MAX_ENTRIES = 3000
    const val MAX_HTML_BYTES = 8L * 1024 * 1024
    const val SUPPORTED_SDK = 1

    val ALLOWED_EXTENSIONS = setOf(
        "html", "htm", "js", "mjs", "json", "css", "png", "jpg", "jpeg", "gif", "webp", "svg", "ico",
        "ogg", "mp3", "wav", "m4a", "ttf", "otf", "woff", "woff2", "txt", "md", "map", "atlas", "tsx", "tmx",
    )
    private val COLOR = Regex("^#[0-9a-fA-F]{6}$")

    /** Normalises an archive entry name; returns null for entries that must be ignored, throws for unsafe ones. */
    fun safeName(raw: String): String? {
        val name = raw.replace('\\', '/')
        if (name.endsWith("/")) return null
        if (name.startsWith("__MACOSX/") || name.substringAfterLast('/') == ".DS_Store" || name.substringAfterLast('/').startsWith("._")) return null
        if (name.startsWith("/") || name.contains(':') || name.split('/').any { it == ".." || it.isEmpty() }) {
            throw InstallException(InstallException.Code.UNSAFE_PATH, raw)
        }
        return name
    }

    /** "My Game.zip" -> "My Game" (only package-like extensions are removed). */
    fun stripExt(name: String): String = name.replace(Regex("\\.(zip|html?|retrogame)$", RegexOption.IGNORE_CASE), "")

    fun slug(text: String): String {
        val s = stripExt(text).lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-').take(30).trim('-')
        return if (s.length >= 2) s else "game"
    }

    fun prettyName(fileName: String): String =
        stripExt(fileName).replace(Regex("[-_.]+"), " ").trim().split(' ')
            .joinToString(" ") { w -> w.replaceFirstChar { it.uppercase() } }.ifBlank { "Imported Game" }.take(40)

    fun validateManifest(m: GameManifest) {
        fun bad(msg: String): Nothing = throw InstallException(InstallException.Code.BAD_MANIFEST, msg)
        if (!ID_REGEX.matches(m.id)) bad("id")
        if (m.name.isBlank() || m.name.length > 60) bad("name")
        if (!Regex("^\\d+(\\.\\d+){0,3}$").matches(m.version)) bad("version")
        if (m.sdk > SUPPORTED_SDK) throw InstallException(InstallException.Code.UNSUPPORTED_SDK, "sdk ${m.sdk}")
        if (!COLOR.matches(m.color)) bad("color")
        if (m.entry.isBlank() || m.entry.startsWith("/") || m.entry.contains("..") || m.entry.contains(':')) bad("entry")
        m.icon?.let { icon ->
            if (icon.rows.size !in 4..32 || icon.rows.any { it.length != icon.rows.size }) bad("icon shape")
            if (icon.palette.size > 32 || icon.palette.values.any { !COLOR.matches(it) }) bad("icon palette")
        }
        if (m.achievements.size > 40 || m.description.length > 600) bad("size")
    }

    /**
     * Validates [zip] and installs it as `<gamesRoot>/<id>/`.
     * @param expectedId when set (store installs) the manifest id must match.
     * @param fallbackName used to derive id/name when the archive has no manifest.json (plain HTML5 game, "compat" mode).
     */
    fun installZip(zip: File, gamesRoot: File, reservedIds: Set<String>, expectedId: String?, fallbackName: String): GameManifest {
        if (zip.length() > MAX_ZIP_BYTES) throw InstallException(InstallException.Code.TOO_LARGE, "${zip.length()}")
        val zf = try { ZipFile(zip) } catch (e: IOException) { throw InstallException(InstallException.Code.BAD_ARCHIVE, e.message ?: "", e) }
        zf.use { z ->
            val entries = z.entries().toList()
            if (entries.size > MAX_ENTRIES) throw InstallException(InstallException.Code.TOO_LARGE, "entries ${entries.size}")
            val names = LinkedHashMap<String, ZipEntry>()
            for (e in entries) { safeName(e.name)?.let { names[it] = e } }
            if (names.isEmpty()) throw InstallException(InstallException.Code.BAD_ARCHIVE, "empty")

            val prefix = when {
                "index.html" in names -> ""
                else -> {
                    val tops = names.keys.map { it.substringBefore('/', "") }.toSet()
                    val only = tops.singleOrNull()
                    if (only != null && only.isNotEmpty() && "$only/index.html" in names && names.keys.all { it.startsWith("$only/") }) "$only/"
                    else throw InstallException(InstallException.Code.NO_INDEX)
                }
            }

            val manifestEntry = names["${prefix}manifest.json"]
            val manifest: GameManifest = if (manifestEntry != null) {
                if (manifestEntry.size > 256 * 1024) throw InstallException(InstallException.Code.BAD_MANIFEST, "too big")
                val text = z.getInputStream(manifestEntry).bufferedReader().use { it.readText() }
                val m = try { AppJson.decodeFromString<GameManifest>(text) } catch (e: Exception) {
                    throw InstallException(InstallException.Code.BAD_MANIFEST, e.message ?: "", e)
                }
                validateManifest(m)
                if ("$prefix${m.entry}" !in names) throw InstallException(InstallException.Code.NO_INDEX, m.entry)
                m
            } else {
                var id = slug(fallbackName)
                if (id in reservedIds) id += "-imp"
                GameManifest(id = id, name = prettyName(fallbackName), sdk = 0, layout = "full", category = "action", description = "Imported HTML5 game")
            }

            if (expectedId != null && manifest.id != expectedId) throw InstallException(InstallException.Code.ID_MISMATCH, manifest.id)
            if (manifest.id in reservedIds) throw InstallException(InstallException.Code.ID_RESERVED, manifest.id)

            val tmpRoot = File(gamesRoot, ".tmp").apply { mkdirs() }
            val tmp = File(tmpRoot, "${manifest.id}-${System.nanoTime()}")
            try {
                var total = 0L
                for ((name, entry) in names) {
                    if (!name.startsWith(prefix)) continue
                    val rel = name.removePrefix(prefix)
                    val ext = rel.substringAfterLast('.', "").lowercase()
                    if (ext !in ALLOWED_EXTENSIONS) throw InstallException(InstallException.Code.BAD_FILE_TYPE, rel)
                    val out = File(tmp, rel)
                    if (!out.canonicalPath.startsWith(tmp.canonicalPath + File.separator)) throw InstallException(InstallException.Code.UNSAFE_PATH, rel)
                    out.parentFile?.mkdirs()
                    z.getInputStream(entry).use { input ->
                        out.outputStream().use { output ->
                            val buf = ByteArray(16 * 1024)
                            while (true) {
                                val n = input.read(buf)
                                if (n < 0) break
                                total += n
                                if (total > MAX_UNPACKED_BYTES) throw InstallException(InstallException.Code.TOO_LARGE, "unpacked")
                                output.write(buf, 0, n)
                            }
                        }
                    }
                }
                if (manifestEntry == null) File(tmp, "manifest.json").writeText(AppJson.encodeToString(GameManifest.serializer(), manifest))
                moveIntoPlace(tmp, File(gamesRoot, manifest.id))
            } catch (e: Throwable) {
                tmp.deleteRecursively()
                throw e
            }
            return manifest
        }
    }

    /** True when [file] is plausibly an HTML document: no binary (NUL) bytes and an HTML marker near the top. */
    fun looksLikeHtml(file: File): Boolean {
        val head = ByteArray(4096)
        val n = file.inputStream().use { it.read(head) }
        if (n <= 0) return false
        if ((0 until n).any { head[it] == 0.toByte() }) return false
        val text = String(head, 0, n, Charsets.UTF_8).lowercase()
        return listOf("<!doctype html", "<html", "<head", "<body", "<script", "<canvas").any { it in text }
    }

    /** Installs a single stand-alone HTML file as a "compat" game. */
    fun installHtml(html: File, gamesRoot: File, reservedIds: Set<String>, fallbackName: String): GameManifest {
        if (html.length() > MAX_HTML_BYTES) throw InstallException(InstallException.Code.TOO_LARGE, "${html.length()}")
        if (!looksLikeHtml(html)) throw InstallException(InstallException.Code.BAD_ARCHIVE, "not a zip or an html file")
        var id = slug(fallbackName)
        if (id in reservedIds) id += "-imp"
        val manifest = GameManifest(id = id, name = prettyName(fallbackName), sdk = 0, layout = "full", category = "action", description = "Imported HTML5 game")
        val tmp = File(File(gamesRoot, ".tmp").apply { mkdirs() }, "$id-${System.nanoTime()}").apply { mkdirs() }
        try {
            html.copyTo(File(tmp, "index.html"), overwrite = true)
            File(tmp, "manifest.json").writeText(AppJson.encodeToString(GameManifest.serializer(), manifest))
            moveIntoPlace(tmp, File(gamesRoot, id))
        } catch (e: Throwable) { tmp.deleteRecursively(); throw e }
        return manifest
    }

    private fun moveIntoPlace(tmp: File, dest: File) {
        if (dest.exists()) dest.deleteRecursively()
        if (!tmp.renameTo(dest)) {
            tmp.copyRecursively(dest, overwrite = true)
            tmp.deleteRecursively()
        }
        dest.setLastModified(System.currentTimeMillis())
    }
}
