package com.retroconsole.app

import com.retroconsole.app.store.RomKind
import com.retroconsole.app.store.RomPackage
import java.io.File
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class RomPackageTest {
    private lateinit var tmp: File
    private lateinit var games: File

    @Before fun setUp() { tmp = File.createTempFile("rom", "test").apply { delete(); mkdirs() }; games = File(tmp, "games").apply { mkdirs() } }
    @After fun tearDown() { tmp.deleteRecursively() }

    private fun file(name: String, bytes: ByteArray) = File(tmp, name).apply { writeBytes(bytes) }
    private fun nes(size: Int = 24592, fill: Int = 0) = ByteArray(size) { fill.toByte() }.also { it[0] = 'N'.code.toByte(); it[1] = 'E'.code.toByte(); it[2] = 'S'.code.toByte(); it[3] = 0x1A }
    private fun gb(size: Int = 0x8000, fill: Int = 0) = ByteArray(size) { fill.toByte() }

    @Test fun detectsNesByHeaderWhateverTheName() {
        assertEquals(RomKind.NES, RomPackage.detect(file("a.nes", nes()), "a.nes"))
        assertEquals(RomKind.NES, RomPackage.detect(file("noext", nes()), "noext"))
        assertEquals(RomKind.NES, RomPackage.detect(file("x.bin", nes()), "x.bin"))
    }

    @Test fun detectsGameBoyByExtensionAndSize() {
        assertEquals(RomKind.GAME_BOY, RomPackage.detect(file("g.gb", gb()), "g.gb"))
        assertEquals(RomKind.GAME_BOY, RomPackage.detect(file("g.GBC", gb(0x100000)), "g.GBC"))
        assertNull("wrong extension", RomPackage.detect(file("g.txt", gb()), "g.txt"))
        assertNull("too small", RomPackage.detect(file("s.gb", gb(0x4000)), "s.gb"))
        assertNull("not a whole number of banks", RomPackage.detect(file("o.gb", gb(0x8000 + 17)), "o.gb"))
    }

    @Test fun rejectsEverythingElse() {
        assertNull(RomPackage.detect(file("z.nes", "PK\u0003\u0004".toByteArray() + ByteArray(200)), "z.nes"))   // zip: unzip first
        assertNull(RomPackage.detect(file("junk.nes", ByteArray(5000) { it.toByte() }), "junk.nes"))
        assertNull(RomPackage.detect(file("tiny.nes", byteArrayOf(1, 2, 3)), "tiny.nes"))
        assertNull(RomPackage.detect(file("empty.gb", ByteArray(0)), "empty.gb"))
        assertNull("over the size cap", RomPackage.detect(file("big.gb", ByteArray((RomPackage.MAX_ROM_BYTES + 0x4000).toInt())), "big.gb"))
    }

    @Test fun cleansUpDisplayNames() {
        assertEquals("Super Cool Game", RomPackage.prettyName("Super_Cool-Game (USA) [!].nes"))
        assertEquals("My Game", RomPackage.prettyName("(only tags).gb"))
        assertEquals("Hello World", RomPackage.prettyName("hello.world.gbc"))
        assertTrue(RomPackage.prettyName("x".repeat(200) + ".nes").length <= 40)
    }

    @Test fun installsAMenuEntryWithTheFileAndTheEmulatorPage() {
        val rom = file("Test Game (World).nes", nes(fill = 7))
        val template = "<html>player</html>"
        val m = RomPackage.install(rom, rom.name, RomKind.NES, games, template)
        assertEquals("Test Game", m.name)
        assertEquals("other", m.category)
        assertEquals(1, m.sdk)
        assertTrue(m.id.matches(Regex("rom-test-game-[0-9a-f]{6}")))
        val dir = File(games, m.id)
        assertEquals(template, File(dir, "index.html").readText())
        assertTrue(File(dir, "rom.bin").readBytes().contentEquals(rom.readBytes()))
        assertTrue(File(dir, "manifest.json").readText().contains("\"name\": \"Test Game\"") || File(dir, "manifest.json").readText().contains("Test Game"))
        assertTrue(File(games, ".tmp").listFiles().orEmpty().isEmpty())
    }

    @Test fun sameFileReplacesItselfDifferentFilesNeverCollide() {
        val a1 = RomPackage.install(file("Game.nes", nes(fill = 1)), "Game.nes", RomKind.NES, games, "v1")
        val a2 = RomPackage.install(file("Game.nes", nes(fill = 1)), "Game.nes", RomKind.NES, games, "v2")
        assertEquals(a1.id, a2.id)
        assertEquals("v2", File(File(games, a1.id), "index.html").readText())
        val b = RomPackage.install(file("Game2.nes", nes(fill = 2)), "Game.nes", RomKind.NES, games, "v1")   // same name, other content
        assertNotEquals(a1.id, b.id)
        assertEquals(2, games.listFiles().orEmpty().count { !it.name.startsWith(".") })
    }

    @Test fun idsCanNeverCollideWithBuiltInGames() {
        val m = RomPackage.install(file("snake.gb", gb()), "snake.gb", RomKind.GAME_BOY, games, "x")
        assertTrue(m.id.startsWith("rom-"))
        assertFalse(m.id == "snake")
    }
}
