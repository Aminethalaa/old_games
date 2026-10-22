package com.retroconsole.app.console

import android.view.HapticFeedbackConstants
import android.view.ViewGroup
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.retroconsole.app.R
import com.retroconsole.app.data.Settings
import androidx.compose.ui.res.stringResource
import kotlin.math.min

/** Stateful wrapper: wires the shell to the [ConsoleController]. */
@Composable
fun ConsoleScreen(console: ConsoleController, settings: Settings, modifier: Modifier = Modifier) {
    val power by console.power.collectAsStateWithLifecycle()
    val pressed by console.pressed.collectAsStateWithLifecycle()
    val view = LocalView.current
    ConsoleBody(
        skin = Skins.byId(settings.skin),
        power = power,
        pressed = pressed,
        settings = settings,
        onButton = { b, down ->
            if (down && settings.vibrate) view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
            console.press(b, down)
        },
        onFunction = { fn ->
            if (settings.vibrate) view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
            when (fn) {
                ConsoleFunction.POWER -> console.togglePower()
                ConsoleFunction.SOUND -> console.toggleSound()
                ConsoleFunction.HOME -> console.home()
                ConsoleFunction.RESET -> console.reset()
            }
        },
        modifier = modifier,
        lcd = { LcdSurface(console) },
    )
}

enum class ConsoleFunction { POWER, SOUND, HOME, RESET }

/** Hosts the console's WebView inside Compose (the view is shared and re-parented, never recreated). */
@Composable
fun LcdSurface(console: ConsoleController, modifier: Modifier = Modifier) {
    val generation by console.lcdGeneration.collectAsStateWithLifecycle()
    key(generation) {
        AndroidView(
            factory = {
                val wv = console.lcd.webView
                (wv.parent as? ViewGroup)?.removeView(wv)
                wv
            },
            modifier = modifier.fillMaxSize(),
        )
    }
}

/**
 * The plastic shell. Stateless so it can be previewed/tested with any [lcd] content.
 * The whole thing is designed on a 360 x 770 dp canvas (portrait) or 700 x 376 dp (landscape) and uniformly scaled.
 */
@Composable
fun ConsoleBody(
    skin: ConsoleSkin,
    power: Boolean,
    pressed: Set<ConsoleButton>,
    settings: Settings,
    onButton: (ConsoleButton, Boolean) -> Unit,
    onFunction: (ConsoleFunction) -> Unit,
    modifier: Modifier = Modifier,
    lcd: @Composable () -> Unit,
) {
    BoxWithConstraints(modifier.fillMaxSize().background(Color(0xFF07080C)), contentAlignment = Alignment.Center) {
        val base = LocalDensity.current
        val land = maxWidth > maxHeight * 1.05f
        val s = (if (land) min(maxHeight.value / 376f, maxWidth.value / 700f) else min(maxWidth.value / 360f, maxHeight.value / 770f)).coerceAtLeast(0.3f)
        val designW = min(maxWidth.value / s, if (land) 900f else 420f)
        val designH = maxHeight.value / s
        // The shell is a physical object: never mirror it for right-to-left languages.
        CompositionLocalProvider(
            LocalDensity provides Density(base.density * s, base.fontScale),
            LocalLayoutDirection provides LayoutDirection.Ltr,
        ) {
            val shape = RoundedCornerShape(topStart = 34.dp, topEnd = 34.dp, bottomStart = 46.dp, bottomEnd = 46.dp)
            Box(
                Modifier
                    .size(designW.dp, designH.dp)
                    .clip(shape)
                    .background(Brush.verticalGradient(listOf(skin.bodyTop, skin.bodyBottom)))
                    .border(2.dp, Color.White.copy(alpha = 0.07f), shape),
            ) {
                // soft light streak along the top edge, like moulded plastic
                Box(
                    Modifier.fillMaxWidth().height(120.dp)
                        .background(Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.07f), Color.Transparent))),
                )
                if (land) LandscapeLayout(skin, power, pressed, settings, onButton, onFunction, lcd)
                else PortraitLayout(skin, power, pressed, settings, onButton, onFunction, lcd)
            }
        }
    }
}

@Composable
private fun Bezel(skin: ConsoleSkin, power: Boolean, modifier: Modifier = Modifier, lcd: @Composable () -> Unit) {
    val outer = RoundedCornerShape(18.dp)
    Box(
        modifier
            .size(292.dp, 348.dp)
            .clip(outer)
            .background(Brush.verticalGradient(listOf(skin.bezel.lighten(0.08f), skin.bezel)))
            .border(2.dp, Color.White.copy(alpha = 0.08f), outer),
        contentAlignment = Alignment.Center,
    ) {
        val inner = RoundedCornerShape(8.dp)
        Box(
            Modifier.size(272.dp, 328.dp).clip(inner).background(Color(0xFF0B0E14)).border(2.dp, Color.Black.copy(alpha = 0.7f), inner),
        ) {
            lcd()
            if (!power) {
                Box(
                    Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Color(0xFF1A1D24), Color(0xFF0D0F14), Color(0xFF181B22)))),
                )
            }
            // glass reflection
            Box(
                Modifier.fillMaxSize().background(
                    Brush.linearGradient(
                        0f to Color.White.copy(alpha = 0.10f), 0.35f to Color.White.copy(alpha = 0.02f),
                        0.36f to Color.Transparent, 1f to Color.White.copy(alpha = 0.03f),
                    ),
                ),
            )
        }
    }
}

@Composable
private fun FunctionRow(
    skin: ConsoleSkin,
    pressedFns: Set<ConsoleFunction>,
    pressed: Set<ConsoleButton>,
    onButton: (ConsoleButton, Boolean) -> Unit,
    onFunction: (ConsoleFunction) -> Unit,
    setFn: (ConsoleFunction, Boolean) -> Unit,
    include: List<String>,
    modifier: Modifier = Modifier,
    scale: Float = 1f,
) {
    Row(modifier, horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.Top) {
        for (key in include) when (key) {
            "power" -> FunctionKey(skin, "ON/OFF", ConsoleFunction.POWER in pressedFns, { setFn(ConsoleFunction.POWER, true); onFunction(ConsoleFunction.POWER) }, { setFn(ConsoleFunction.POWER, false) }, scale = scale)
            "sound" -> FunctionKey(skin, stringResource(R.string.key_sound), ConsoleFunction.SOUND in pressedFns, { setFn(ConsoleFunction.SOUND, true); onFunction(ConsoleFunction.SOUND) }, { setFn(ConsoleFunction.SOUND, false) }, scale = scale)
            "home" -> FunctionKey(skin, stringResource(R.string.key_home), ConsoleFunction.HOME in pressedFns, { setFn(ConsoleFunction.HOME, true); onFunction(ConsoleFunction.HOME) }, { setFn(ConsoleFunction.HOME, false) }, scale = scale)
            "start" -> FunctionKey(skin, "S/P", ConsoleButton.START in pressed, { onButton(ConsoleButton.START, true) }, { onButton(ConsoleButton.START, false) }, scale = scale)
            "reset" -> FunctionKey(skin, stringResource(R.string.key_reset), ConsoleFunction.RESET in pressedFns, { setFn(ConsoleFunction.RESET, true); onFunction(ConsoleFunction.RESET) }, { setFn(ConsoleFunction.RESET, false) }, scale = scale)
        }
    }
}

@Composable
private fun PortraitLayout(
    skin: ConsoleSkin, power: Boolean, pressed: Set<ConsoleButton>, settings: Settings,
    onButton: (ConsoleButton, Boolean) -> Unit, onFunction: (ConsoleFunction) -> Unit, lcd: @Composable () -> Unit,
) {
    var fns by remember { mutableStateOf(emptySet<ConsoleFunction>()) }
    val setFn: (ConsoleFunction, Boolean) -> Unit = { f, d -> fns = if (d) fns + f else fns - f }
    val k = settings.buttonScale
    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(Modifier.height(14.dp))
        Row(Modifier.fillMaxWidth().widthIn(max = 360.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            BoltDecal(skin.decal.copy(alpha = 0.92f), Modifier.size(22.dp, 124.dp))
            Spacer(Modifier.width(7.dp))
            Bezel(skin, power, lcd = lcd)
            Spacer(Modifier.width(7.dp))
            BoltDecal(skin.decal.copy(alpha = 0.92f), Modifier.size(22.dp, 124.dp), flip = true)
        }
        Spacer(Modifier.height(5.dp))
        Text(skin.model, color = skin.label, fontSize = 17.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
        Spacer(Modifier.weight(1f))
        RidgeBand(skin, Modifier.fillMaxWidth().height(40.dp))
        Spacer(Modifier.height(6.dp))
        FunctionRow(
            skin, fns, pressed, onButton, onFunction, setFn, listOf("power", "sound", "home", "start", "reset"),
            Modifier.fillMaxWidth().padding(horizontal = 14.dp),
        )
        Spacer(Modifier.height(10.dp))
        val dpad = @Composable { DPad(skin, pressed, onButton, size = (150.dp * k)) }
        val actions = @Composable { ActionKeys(skin, pressed, onButton, scale = k) }
        Row(Modifier.fillMaxWidth().padding(horizontal = 10.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            if (settings.leftHanded) { actions(); dpad() } else { dpad(); actions() }
        }
        Spacer(Modifier.weight(0.6f))
        BrandArea(skin)
        Spacer(Modifier.height(10.dp))
    }
}

@Composable
private fun LandscapeLayout(
    skin: ConsoleSkin, power: Boolean, pressed: Set<ConsoleButton>, settings: Settings,
    onButton: (ConsoleButton, Boolean) -> Unit, onFunction: (ConsoleFunction) -> Unit, lcd: @Composable () -> Unit,
) {
    var fns by remember { mutableStateOf(emptySet<ConsoleFunction>()) }
    val setFn: (ConsoleFunction, Boolean) -> Unit = { f, d -> fns = if (d) fns + f else fns - f }
    val k = settings.buttonScale
    val left: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit = {
        Column(Modifier.fillMaxHeight().weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.SpaceEvenly) {
            FunctionRow(skin, fns, pressed, onButton, onFunction, setFn, listOf("power", "sound", "home"), Modifier.fillMaxWidth())
            if (settings.leftHanded) ActionKeys(skin, pressed, onButton, scale = k) else DPad(skin, pressed, onButton, size = 150.dp * k)
        }
    }
    val right: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit = {
        Column(Modifier.fillMaxHeight().weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.SpaceEvenly) {
            FunctionRow(skin, fns, pressed, onButton, onFunction, setFn, listOf("start", "reset"), Modifier.fillMaxWidth())
            if (settings.leftHanded) DPad(skin, pressed, onButton, size = 150.dp * k) else ActionKeys(skin, pressed, onButton, scale = k)
        }
    }
    Row(Modifier.fillMaxSize().padding(horizontal = 18.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        left()
        Bezel(skin, power, lcd = lcd)
        right()
    }
}
