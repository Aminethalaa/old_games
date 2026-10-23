package com.retroconsole.app

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.os.Looper
import android.view.View
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import com.retroconsole.app.console.ConsoleBody
import com.retroconsole.app.console.ConsoleButton
import com.retroconsole.app.console.ConsoleSkin
import com.retroconsole.app.console.Skins
import com.retroconsole.app.data.Settings
import com.retroconsole.app.ui.RetroTheme
import java.io.File
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Renders the console shell on the JVM and writes PNGs to app/build/screenshots so the look can be reviewed
 * without a device. If tools/test/out/home-menu-color.png exists (made by tools/test/home-shot.cjs) it is used as the LCD.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], application = android.app.Application::class)
class ConsoleScreenshotTest {
    private val outDir = File("build/screenshots").apply { mkdirs() }
    private val lcdShot = File("../../tools/test/out/home-menu-color.png")

    private fun render(qualifiers: String, content: @Composable () -> Unit): Bitmap {
        RuntimeEnvironment.setQualifiers(qualifiers)
        val controller = Robolectric.buildActivity(ComponentActivity::class.java).create()
        controller.get().setContent { RetroTheme { content() } }
        controller.start().resume().visible()
        shadowOf(Looper.getMainLooper()).idle()
        val decor = controller.get().window.decorView
        val dm = RuntimeEnvironment.getApplication().resources.displayMetrics
        val w = dm.widthPixels
        val h = dm.heightPixels
        decor.measure(View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(h, View.MeasureSpec.EXACTLY))
        decor.layout(0, 0, w, h)
        shadowOf(Looper.getMainLooper()).idle()
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        decor.draw(Canvas(bmp))
        return bmp
    }

    private fun shoot(name: String, qualifiers: String, skin: ConsoleSkin, pressed: Set<ConsoleButton> = emptySet(), power: Boolean = true, settings: Settings = Settings(), lcdShot: File = this.lcdShot) {
        val bmp = render(qualifiers) {
            ConsoleBody(skin, power, pressed, settings, { _, _ -> }, { }) {
                if (lcdShot.exists()) {
                    val shot = BitmapFactory.decodeFile(lcdShot.path)
                    Image(shot.asImageBitmap(), null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                }
            }
        }
        File(outDir, "$name.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    /** README hero image: the console with a game running on its LCD. */
    @Test fun hero() = shoot("hero-classic", "w411dp-h914dp-xxhdpi", Skins.Classic, pressed = setOf(ConsoleButton.LEFT), lcdShot = File("../../tools/test/out/block-stack-2-play.png"))

    @Test fun portraitClassic() = shoot("portrait-classic", "w411dp-h914dp-xxhdpi", Skins.Classic)
    @Test fun portraitPressed() = shoot("portrait-pressed", "w411dp-h914dp-xxhdpi", Skins.Classic, pressed = setOf(ConsoleButton.LEFT, ConsoleButton.A))
    @Test fun portraitOff() = shoot("portrait-off", "w411dp-h914dp-xxhdpi", Skins.Classic, power = false)
    @Test fun portraitPurple() = shoot("portrait-purple", "w411dp-h914dp-xxhdpi", Skins.Purple)
    @Test fun portraitAtomic() = shoot("portrait-atomic", "w411dp-h914dp-xxhdpi", Skins.Atomic)
    @Test fun portraitNeon() = shoot("portrait-neon", "w411dp-h914dp-xxhdpi", Skins.Neon)
    @Test fun portraitRacer() = shoot("portrait-racer", "w411dp-h914dp-xxhdpi", Skins.Racer)
    @Test fun portraitShort() = shoot("portrait-short", "w360dp-h640dp-xhdpi", Skins.Classic)
    @Test fun landscape() = shoot("landscape", "w914dp-h411dp-xxhdpi", Skins.Classic)
    @Test fun leftHanded() = shoot("portrait-lefty", "w411dp-h914dp-xxhdpi", Skins.Classic, settings = Settings(leftHanded = true))
}
