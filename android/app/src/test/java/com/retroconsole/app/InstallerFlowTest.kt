package com.retroconsole.app

import android.net.Uri
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import com.retroconsole.app.store.InstallException

/** Import a file -> it shows up in the library and the menu JSON -> it can be launched -> it can be removed. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = RetroApp::class)
class InstallerFlowTest {
    private val graph get() = (RuntimeEnvironment.getApplication() as RetroApp).graph
    private val dir get() = RuntimeEnvironment.getApplication().cacheDir

    private fun zip(name: String, vararg entries: Pair<String, String>): Uri {
        val f = File(dir, name)
        ZipOutputStream(f.outputStream()).use { z -> for ((n, c) in entries) { z.putNextEntry(ZipEntry(n)); z.write(c.toByteArray()); z.closeEntry() } }
        return Uri.fromFile(f)
    }

    @Test fun importZipThenLaunchThenRemove() = runBlocking {
        val manifest = """{"id":"flow-test","name":"Flow Test","version":"1.0.0","sdk":1,"category":"puzzle","color":"#29adff","description":"d",
            "icon":{"palette":{"X":"#ff0000"},"rows":["XXXXXXXX","X......X","X......X","X......X","X......X","X......X","X......X","XXXXXXXX"]}}"""
        val game = graph.installer.installFromUri(zip("flow.zip", "manifest.json" to manifest, "index.html" to "<html></html>"))
        assertEquals("flow-test", game.id)
        assertTrue(graph.library.isInstalled("flow-test"))

        // it appears in the JSON the console menu reads, flagged as not built-in and new
        val games = JSONObject(graph.library.libraryJson("en")).getJSONArray("games")
        val entry = (0 until games.length()).map { games.getJSONObject(it) }.first { it.getString("id") == "flow-test" }
        assertFalse(entry.getBoolean("builtin"))
        assertTrue(entry.getBoolean("isNew"))
        assertEquals("https://appassets.androidplatform.net/installed/flow-test/index.html", entry.getString("url"))

        graph.console.launch("flow-test")
        assertEquals("flow-test", graph.console.game.value?.id)

        graph.installer.uninstall("flow-test")
        assertFalse(graph.library.isInstalled("flow-test"))
    }

    @Test fun importSingleHtmlRunsInCompatMode() = runBlocking {
        val f = File(dir, "Space Doodle.html").apply { writeText("<html><body>hi</body></html>") }
        val game = graph.installer.installFromUri(Uri.fromFile(f))
        assertEquals("space-doodle", game.id)
        assertTrue(game.manifest.compat)
        assertNotNull(graph.library.find("space-doodle"))
        graph.installer.uninstall("space-doodle")
        assertNull(graph.library.find("space-doodle"))
    }

    @Test fun builtInGamesCannotBeReplacedOrRemoved() = runBlocking {
        val manifest = """{"id":"snake","name":"Evil Snake","version":"9.0.0","sdk":1,"category":"arcade","color":"#ff0000"}"""
        try {
            graph.installer.installFromUri(zip("evil.zip", "manifest.json" to manifest, "index.html" to "x"))
            fail("should be rejected")
        } catch (e: InstallException) { assertEquals(InstallException.Code.ID_RESERVED, e.code) }
        graph.installer.uninstall("snake")
        assertTrue(graph.library.find("snake")!!.builtin)
    }

    @Test fun garbageFileIsRejectedWithoutResidue() = runBlocking {
        val f = File(dir, "junk.zip").apply { writeBytes(ByteArray(2000) { it.toByte() }) }
        try { graph.installer.installFromUri(Uri.fromFile(f)); fail("should be rejected") } catch (_: InstallException) { }
        assertTrue(graph.library.installed().isEmpty())
    }
}
