package com.retroconsole.app.store

import com.retroconsole.app.data.AppJson
import com.retroconsole.app.data.GameManifest
import com.retroconsole.app.data.PixelIcon
import java.io.File
import java.security.MessageDigest

/** Systems the console can run game files for ("Import my own game"). Cores live in assets/web/emulators/<coreDir>. */
enum class RomKind(val coreDir: String, val label: String, val color: String, val size: List<Int>) {
    NES("nes", "NES", "#ff6b6b", listOf(256, 240)),
    GAME_BOY("gb", "Game Boy", "#8bd450", listOf(160, 144)),
}

/**
 * Turns a game file the user picked into a console menu entry (a folder in `games/` with a tiny page that loads the
 * bundled emulator and the file). Pure Kotlin so it is unit-tested on the JVM. The app never ships or downloads game
 * files: this only accepts files the user already has.
 */
object RomPackage {
    const val MAX_ROM_BYTES = 8L * 1024 * 1024
    private const val MIN_GB_BYTES = 0x8000L

    /** Decides what a file is from its header (NES) or name and size (Game Boy). Returns null when unsupported. */
    fun detect(file: File, fileName: String): RomKind? {
        val len = file.length()
        if (len < 16 || len > MAX_ROM_BYTES) return null
        val head = ByteArray(16)
        val n = file.inputStream().use { it.read(head) }
        if (n < 16) return null
        if (head[0] == 'P'.code.toByte() && head[1] == 'K'.code.toByte()) return null          // zip archives: unzip first
        if (head[0] == 'N'.code.toByte() && head[1] == 'E'.code.toByte() && head[2] == 'S'.code.toByte() && head[3] == 0x1A.toByte()) return RomKind.NES
        val ext = fileName.substringAfterLast('.', "").lowercase()
        if ((ext == "gb" || ext == "gbc") && len >= MIN_GB_BYTES && len % 0x4000L == 0L) return RomKind.GAME_BOY
        return null
    }

    /** "Super_Cool-Game (USA) [!].nes" -> "Super Cool Game" */
    fun prettyName(fileName: String): String {
        val base = fileName.substringBeforeLast('.', fileName)
            .replace(Regex("\\s*[(\\[][^)\\]]*[)\\]]"), "")
            .replace(Regex("[_.\\-]+"), " ").trim()
        return base.split(' ').filter { it.isNotBlank() }.joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }
            .take(40).ifBlank { "My Game" }
    }

    private fun sha256Hex(file: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buf = ByteArray(64 * 1024)
            while (true) { val n = input.read(buf); if (n < 0) break; md.update(buf, 0, n) }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }

    /** A little cartridge icon in the system's colour. */
    fun icon(kind: RomKind): PixelIcon = PixelIcon(
        palette = mapOf("G" to "#8c8c94", "D" to "#4a4a52", "L" to kind.color, "W" to "#f2f2f8"),
        rows = listOf(
            "............",
            ".DDDDDDDDDD.",
            ".DGGGGGGGGD.",
            ".DGLLLLLLGD.",
            ".DGLWWWWLGD.",
            ".DGLWWWWLGD.",
            ".DGLLLLLLGD.",
            ".DGGGGGGGGD.",
            ".DGGGDDGGGD.",
            ".DDDDDDDDDD.",
            "..DD....DD..",
            "............",
        ),
    )

    /**
     * Installs [rom] as `<gamesRoot>/rom-<name>-<hash>/` (index.html from [indexHtml], rom.bin, manifest.json).
     * Importing the same file again replaces the entry; different files never collide.
     */
    fun install(rom: File, fileName: String, kind: RomKind, gamesRoot: File, indexHtml: String): GameManifest {
        val name = prettyName(fileName)
        val id = "rom-" + GamePackage.slug(name).take(24).trim('-') + "-" + sha256Hex(rom).take(6)
        val manifest = GameManifest(
            id = id, name = name, short = name.take(11).uppercase(), version = "1.0.0", sdk = 1, author = "",
            category = "other", layout = "full", size = kind.size, color = kind.color,
            description = "Your own ${kind.label} game file",
            controls = mapOf("dpad" to "D-pad", "a" to "A  (A+B together = Select)", "b" to "B", "start" to "Start"),
            tags = listOf("rom", kind.coreDir), icon = icon(kind),
        )
        GamePackage.validateManifest(manifest)
        val tmp = File(File(gamesRoot, ".tmp").apply { mkdirs() }, "$id-${System.nanoTime()}").apply { mkdirs() }
        try {
            File(tmp, "index.html").writeText(indexHtml)
            rom.copyTo(File(tmp, "rom.bin"), overwrite = true)
            File(tmp, "manifest.json").writeText(AppJson.encodeToString(GameManifest.serializer(), manifest))
            GamePackage.moveIntoPlace(tmp, File(gamesRoot, id))
        } catch (e: Throwable) { tmp.deleteRecursively(); throw e }
        return manifest
    }
}
