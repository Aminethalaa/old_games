package com.retroconsole.app

import com.retroconsole.app.console.WebPaths
import com.retroconsole.app.data.compareVersions
import com.retroconsole.app.store.GamePackage
import com.retroconsole.app.store.InstallException
import com.retroconsole.app.store.InstallException.Code
import com.retroconsole.app.store.StoreClient
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

class GamePackageTest {
    private lateinit var tmp: File
    private lateinit var games: File

    @Before fun setUp() {
        tmp = File.createTempFile("retro", "test").apply { delete(); mkdirs() }
        games = File(tmp, "games").apply { mkdirs() }
    }

    @After fun tearDown() { tmp.deleteRecursively() }

    private fun zip(vararg entries: Pair<String, String>, name: String = "g.zip"): File {
        val f = File(tmp, name)
        ZipOutputStream(f.outputStream()).use { z ->
            for ((n, c) in entries) { z.putNextEntry(ZipEntry(n)); z.write(c.toByteArray()); z.closeEntry() }
        }
        return f
    }

    private fun manifest(id: String = "my-game", version: String = "1.0.0", sdk: Int = 1, extra: String = "") =
        """{"id":"$id","name":"My Game","version":"$version","sdk":$sdk,"category":"arcade","color":"#ffec27"$extra}"""

    private fun expectError(code: Code, block: () -> Unit) {
        try { block(); fail("expected $code") } catch (e: InstallException) { assertEquals(code, e.code) }
    }

    @Test fun installsValidPackage() {
        val z = zip("manifest.json" to manifest(), "index.html" to "<html></html>", "game.js" to "1", "img/a.png" to "x")
        val m = GamePackage.installZip(z, games, emptySet(), "my-game", "My Game")
        assertEquals("my-game", m.id)
        assertTrue(File(games, "my-game/index.html").exists())
        assertTrue(File(games, "my-game/img/a.png").exists())
        assertFalse(File(games, ".tmp").listFiles().orEmpty().isNotEmpty())
    }

    @Test fun flattensSingleTopLevelFolder() {
        val z = zip("pack/manifest.json" to manifest(), "pack/index.html" to "<html></html>")
        GamePackage.installZip(z, games, emptySet(), null, "x")
        assertTrue(File(games, "my-game/index.html").exists())
    }

    @Test fun packageWithoutManifestBecomesCompatGame() {
        val z = zip("index.html" to "<html></html>")
        val m = GamePackage.installZip(z, games, emptySet(), null, "cool-snake_v2.zip")
        assertEquals(0, m.sdk)
        assertTrue(m.compat)
        assertEquals("cool-snake-v2", m.id)
        assertTrue(File(games, "cool-snake-v2/manifest.json").exists())
    }

    @Test fun rejectsZipSlip() {
        val z = zip("index.html" to "<html></html>", "../evil.js" to "x")
        expectError(Code.UNSAFE_PATH) { GamePackage.installZip(z, games, emptySet(), null, "x") }
        assertFalse(File(tmp, "evil.js").exists())
        val z2 = zip("index.html" to "<html></html>", "a/../../evil.js" to "x", name = "b.zip")
        expectError(Code.UNSAFE_PATH) { GamePackage.installZip(z2, games, emptySet(), null, "x") }
        val z3 = zip("index.html" to "<html></html>", "/abs.js" to "x", name = "c.zip")
        expectError(Code.UNSAFE_PATH) { GamePackage.installZip(z3, games, emptySet(), null, "x") }
    }

    @Test fun rejectsExecutableContent() {
        for (bad in listOf("run.exe", "lib.so", "app.apk", "x.sh", "dex.dex")) {
            val z = zip("index.html" to "<html></html>", bad to "x", name = "$bad.zip")
            expectError(Code.BAD_FILE_TYPE) { GamePackage.installZip(z, games, emptySet(), null, "x") }
        }
        assertFalse(File(games, "x").exists())
    }

    @Test fun requiresIndexHtml() {
        expectError(Code.NO_INDEX) { GamePackage.installZip(zip("game.js" to "1"), games, emptySet(), null, "x") }
        expectError(Code.NO_INDEX) { GamePackage.installZip(zip("a/index.html" to "x", "b/x.js" to "y", name = "m.zip"), games, emptySet(), null, "x") }
    }

    @Test fun validatesManifest() {
        expectError(Code.ID_MISMATCH) { GamePackage.installZip(zip("manifest.json" to manifest(id = "other"), "index.html" to "x"), games, emptySet(), "my-game", "x") }
        expectError(Code.ID_RESERVED) { GamePackage.installZip(zip("manifest.json" to manifest(id = "snake"), "index.html" to "x", name = "r.zip"), games, setOf("snake"), null, "x") }
        expectError(Code.UNSUPPORTED_SDK) { GamePackage.installZip(zip("manifest.json" to manifest(sdk = 99), "index.html" to "x", name = "s.zip"), games, emptySet(), null, "x") }
        expectError(Code.BAD_MANIFEST) { GamePackage.installZip(zip("manifest.json" to manifest(id = "Bad Id!"), "index.html" to "x", name = "i.zip"), games, emptySet(), null, "x") }
        expectError(Code.BAD_MANIFEST) { GamePackage.installZip(zip("manifest.json" to "not json", "index.html" to "x", name = "j.zip"), games, emptySet(), null, "x") }
        expectError(Code.BAD_MANIFEST) { GamePackage.installZip(zip("manifest.json" to manifest(extra = ""","entry":"../../etc/passwd""""), "index.html" to "x", name = "e.zip"), games, emptySet(), null, "x") }
        expectError(Code.BAD_MANIFEST) { GamePackage.installZip(zip("manifest.json" to manifest(extra = ""","icon":{"palette":{"a":"red"},"rows":["aaaa","aaaa","aaaa","aaaa"]}"""), "index.html" to "x", name = "ic.zip"), games, emptySet(), null, "x") }
    }

    @Test fun stopsZipBombs() {
        val f = File(tmp, "bomb.zip")
        ZipOutputStream(f.outputStream()).use { z ->
            z.putNextEntry(ZipEntry("index.html")); z.write("<html></html>".toByteArray()); z.closeEntry()
            z.putNextEntry(ZipEntry("big.txt"))
            val chunk = ByteArray(1 shl 20)
            repeat(GamePackage.MAX_UNPACKED_BYTES.toInt() / (1 shl 20) + 2) { z.write(chunk) }
            z.closeEntry()
        }
        expectError(Code.TOO_LARGE) { GamePackage.installZip(f, games, emptySet(), null, "x") }
        assertTrue(games.listFiles().orEmpty().none { !it.name.startsWith(".") })
        assertTrue(File(games, ".tmp").listFiles().orEmpty().isEmpty())
    }

    @Test fun updateReplacesOldFiles() {
        GamePackage.installZip(zip("manifest.json" to manifest(version = "1.0.0"), "index.html" to "v1", "old.js" to "1"), games, emptySet(), "my-game", "x")
        GamePackage.installZip(zip("manifest.json" to manifest(version = "1.1.0"), "index.html" to "v2", name = "u.zip"), games, emptySet(), "my-game", "x")
        assertEquals("v2", File(games, "my-game/index.html").readText())
        assertFalse(File(games, "my-game/old.js").exists())
    }

    @Test fun notAZipIsRejected() {
        val f = File(tmp, "x.zip").apply { writeText("hello") }
        expectError(Code.BAD_ARCHIVE) { GamePackage.installZip(f, games, emptySet(), null, "x") }
    }

    @Test fun installsSingleHtml() {
        val f = File(tmp, "My Cool Game.html").apply { writeText("<html></html>") }
        val m = GamePackage.installHtml(f, games, emptySet(), "My Cool Game.html")
        assertEquals("my-cool-game", m.id)
        assertTrue(File(games, "${m.id}/index.html").exists())
    }

    @Test fun onlyRealHtmlIsAcceptedAsASingleFileGame() {
        val junk = File(tmp, "junk.html").apply { writeBytes(ByteArray(3000) { (it * 7).toByte() }) }
        expectError(Code.BAD_ARCHIVE) { GamePackage.installHtml(junk, games, emptySet(), "junk.html") }
        val text = File(tmp, "notes.html").apply { writeText("just some notes, no markup") }
        expectError(Code.BAD_ARCHIVE) { GamePackage.installHtml(text, games, emptySet(), "notes.html") }
        val ok = File(tmp, "ok.html").apply { writeText("<!DOCTYPE html><canvas id=c></canvas><script>1</script>") }
        assertEquals("ok", GamePackage.installHtml(ok, games, emptySet(), "ok.html").id)
        assertEquals(setOf("ok"), games.listFiles().orEmpty().filter { !it.name.startsWith(".") }.map { it.name }.toSet())
    }

    @Test fun versionOrdering() {
        assertEquals(0, compareVersions("1.0.0", "1.0"))
        assertEquals(1, compareVersions("1.2.10", "1.2.9"))
        assertEquals(-1, compareVersions("1.0.9", "1.1.0"))
        assertEquals(1, compareVersions("2.0", "1.99.99"))
    }

    @Test fun webPathsStayInsideTheirFolder() {
        assertNull(WebPaths.cleanPath("../secret"))
        assertNull(WebPaths.cleanPath("a/../../b"))
        assertNull(WebPaths.cleanPath("a\\b"))
        assertEquals("index.html", WebPaths.cleanPath(""))
        assertEquals("snake/index.html", WebPaths.cleanPath("snake/"))
        assertEquals("snake/game.js", WebPaths.cleanPath("/snake/game.js"))
        assertEquals("text/html", WebPaths.mimeOf("index.html"))
        assertEquals("text/javascript", WebPaths.mimeOf("a/b.js"))
        assertEquals("font/ttf", WebPaths.mimeOf("PressStart2P.ttf"))
        assertTrue(WebPaths.CSP.contains("connect-src 'self'"))
    }

    @Test fun catalogUrlsResolveRelativeToCatalog() {
        assertEquals("https://example.com/store/packs/a-1.0.0.zip", StoreClient.resolve("https://example.com/store/catalog.json", "packs/a-1.0.0.zip"))
        assertEquals("https://cdn.test/x.zip", StoreClient.resolve("https://example.com/store/catalog.json", "https://cdn.test/x.zip"))
    }
}
