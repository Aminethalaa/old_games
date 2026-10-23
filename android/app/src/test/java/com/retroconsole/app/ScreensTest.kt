package com.retroconsole.app

import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Looper
import android.view.View
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import com.retroconsole.app.data.AppJson
import com.retroconsole.app.data.GameManifest
import com.retroconsole.app.store.Catalog
import com.retroconsole.app.store.CatalogEntry
import com.retroconsole.app.ui.RetroTheme
import com.retroconsole.app.ui.SettingsScreen
import com.retroconsole.app.ui.StoreScreen
import com.retroconsole.app.ui.TrophiesScreen
import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** Composes the native pages against the real app graph (offline, cached catalog) and writes PNGs to app/build/screenshots. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], application = RetroApp::class)
class ScreensTest {
    private val outDir = File("build/screenshots").apply { mkdirs() }
    private val graph get() = (RuntimeEnvironment.getApplication() as RetroApp).graph

    @Before fun seed() {
        val app = RuntimeEnvironment.getApplication()
        // never touch the network from tests
        graph.settings.update { it.copy(storeUrl = "http://offline.invalid/catalog.json") }
        val roots = listOf("../../web/games/store", "../../web/games/builtin")
        val entries = roots.flatMap { r -> File(r).listFiles().orEmpty().sortedBy { it.name } }.mapNotNull { dir ->
            val mf = File(dir, "manifest.json")
            if (!mf.exists()) null else runCatching {
                val m = AppJson.decodeFromString<GameManifest>(mf.readText())
                CatalogEntry(m.id + "x", m.name, m.short, "1.2.0", m.category, m.color, m.description, m.author, m.tags, m.icon, 41_000, "00", "packs/${m.id}.zip", 1, m.achievements.size)
            }.getOrNull()
        }.take(7)
        File(app.cacheDir, "catalog.json").writeText(AppJson.encodeToString(Catalog.serializer(), Catalog(1, "Test", null, entries)))
        // a bit of progress so the trophies page has content
        graph.progress.submitHiScore("block-stack", 4200)
        graph.progress.unlock("block-stack", "first-line")
        graph.progress.recordLaunch("block-stack")
    }

    private fun render(name: String, qualifiers: String = "w411dp-h914dp-xxhdpi", content: @Composable () -> Unit) {
        RuntimeEnvironment.setQualifiers(qualifiers)
        val c = Robolectric.buildActivity(ComponentActivity::class.java).create()
        c.get().setContent { RetroTheme { content() } }
        c.start().resume().visible()
        repeat(3) { shadowOf(Looper.getMainLooper()).idle() }
        val decor = c.get().window.decorView
        val dm = RuntimeEnvironment.getApplication().resources.displayMetrics
        decor.measure(View.MeasureSpec.makeMeasureSpec(dm.widthPixels, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(dm.heightPixels, View.MeasureSpec.EXACTLY))
        decor.layout(0, 0, dm.widthPixels, dm.heightPixels)
        shadowOf(Looper.getMainLooper()).idle()
        val bmp = Bitmap.createBitmap(dm.widthPixels, dm.heightPixels, Bitmap.Config.ARGB_8888)
        decor.draw(Canvas(bmp))
        File(outDir, "$name.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
        assertTrue(bmp.width > 0)
    }

    @Test fun store() = render("page-store") { StoreScreen(onBack = {}, onPlay = {}, openAdd = false) }
    @Test fun storeAddDialog() = render("page-store-add") { StoreScreen(onBack = {}, onPlay = {}, openAdd = true) }
    @Test fun settings() = render("page-settings") { SettingsScreen(onBack = {}) }
    @Test fun trophies() = render("page-trophies") { TrophiesScreen(onBack = {}) }
}
