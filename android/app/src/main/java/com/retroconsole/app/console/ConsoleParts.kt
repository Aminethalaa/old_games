package com.retroconsole.app.console

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

internal fun Color.lighten(amount: Float) = lerp(this, Color.White, amount)
internal fun Color.darken(amount: Float) = lerp(this, Color.Black, amount)

/** A round, chunky plastic key. Pressing is reported through [onDown]/[onUp]; [pressed] only drives the look. */
@Composable
fun RoundKey(
    skin: ConsoleSkin,
    size: Dp,
    pressed: Boolean,
    modifier: Modifier = Modifier,
    onDown: () -> Unit = {},
    onUp: () -> Unit = {},
    content: @Composable BoxScope.() -> Unit = {},
) {
    Box(
        modifier
            .size(size)
            .pointerInput(Unit) {
                detectTapGestures(onPress = {
                    onDown()
                    try { tryAwaitRelease() } finally { onUp() }
                })
            },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.fillMaxSize()) { drawKey(skin, pressed, center, this.size.minDimension / 2f) }
        content()
    }
}

private fun DrawScope.drawKey(skin: ConsoleSkin, pressed: Boolean, c: Offset, r: Float, dy: Float = 0f) {
    val sink = if (pressed) r * 0.07f else 0f
    drawCircle(Color.Black.copy(alpha = 0.55f), radius = r * 0.98f, center = Offset(c.x, c.y + r * 0.10f + dy))
    drawCircle(skin.buttonDark, radius = r * 0.97f, center = Offset(c.x, c.y + sink * 0.4f + dy))
    drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(skin.button.lighten(0.35f), skin.button, skin.button.darken(0.08f)),
            center = Offset(c.x - r * 0.25f, c.y - r * 0.3f + sink + dy),
            radius = r * 1.15f,
        ),
        radius = r * 0.86f,
        center = Offset(c.x, c.y - r * 0.05f + sink + dy),
    )
}

/** Small label above a small key, used for ON/OFF, SOUND, HOME, S/P and RESET. */
@Composable
fun FunctionKey(
    skin: ConsoleSkin,
    label: String,
    pressed: Boolean,
    onDown: () -> Unit,
    onUp: () -> Unit,
    modifier: Modifier = Modifier,
    scale: Float = 1f,
) {
    Column(modifier.width(58.dp * scale), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            label,
            color = skin.label.copy(alpha = 0.9f),
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.4.sp,
            maxLines = 1,
        )
        Box(Modifier.height(4.dp))
        RoundKey(skin, 27.dp * scale, pressed, onDown = onDown, onUp = onUp)
    }
}

/** Four yellow keys laid out as a D-pad. One touch area: slide the thumb to switch direction, diagonals press two keys. */
@Composable
fun DPad(
    skin: ConsoleSkin,
    pressed: Set<ConsoleButton>,
    onChange: (ConsoleButton, Boolean) -> Unit,
    modifier: Modifier = Modifier,
    size: Dp = 156.dp,
) {
    Box(
        modifier
            .size(size)
            .pointerInput(Unit) {
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    var active = emptySet<ConsoleButton>()
                    fun apply(pos: Offset) {
                        val next = directionsFor(pos, this@pointerInput.size.width.toFloat(), this@pointerInput.size.height.toFloat())
                        (active - next).forEach { onChange(it, false) }
                        (next - active).forEach { onChange(it, true) }
                        active = next
                    }
                    apply(down.position)
                    down.consume()
                    while (true) {
                        val event = awaitPointerEvent()
                        val change = event.changes.firstOrNull { it.id == down.id } ?: break
                        if (!change.pressed) { change.consume(); break }
                        apply(change.position)
                        change.consume()
                    }
                    active.forEach { onChange(it, false) }
                }
            },
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val c = center
            val key = this.size.minDimension * 0.31f
            val off = this.size.minDimension * 0.335f
            val items = listOf(
                ConsoleButton.UP to Offset(c.x, c.y - off), ConsoleButton.DOWN to Offset(c.x, c.y + off),
                ConsoleButton.LEFT to Offset(c.x - off, c.y), ConsoleButton.RIGHT to Offset(c.x + off, c.y),
            )
            // little crossing plate under the keys
            drawCircle(Color.Black.copy(alpha = 0.35f), radius = off * 0.75f, center = Offset(c.x, c.y + 2f))
            for ((b, pos) in items) drawKey(skin, b in pressed, pos, key / 2f)
            // the tiny "move" glyph in the middle of the pad
            val g = off * 0.28f
            val ink = skin.label.copy(alpha = 0.7f)
            drawLine(ink, Offset(c.x - g, c.y), Offset(c.x + g, c.y), strokeWidth = 2f, cap = StrokeCap.Round)
            drawLine(ink, Offset(c.x, c.y - g), Offset(c.x, c.y + g), strokeWidth = 2f, cap = StrokeCap.Round)
            for ((dx, dy) in listOf(0 to -1, 0 to 1, -1 to 0, 1 to 0)) {
                val tip = Offset(c.x + dx * (g + 4f), c.y + dy * (g + 4f))
                val p = Path().apply {
                    moveTo(tip.x, tip.y)
                    lineTo(tip.x - dx * 5f + dy * 3.5f, tip.y - dy * 5f + dx * 3.5f)
                    lineTo(tip.x - dx * 5f - dy * 3.5f, tip.y - dy * 5f - dx * 3.5f)
                    close()
                }
                drawPath(p, ink)
            }
        }
    }
}

internal fun directionsFor(pos: Offset, w: Float, h: Float): Set<ConsoleButton> {
    val v = Offset(pos.x - w / 2f, pos.y - h / 2f)
    val dist = hypot(v.x, v.y)
    if (dist < w * 0.08f) return emptySet()
    val ax = abs(v.x)
    val ay = abs(v.y)
    val ratio = ax / (ay + 0.001f)
    val out = mutableSetOf<ConsoleButton>()
    if (ratio > 0.42f) out += if (v.x > 0) ConsoleButton.RIGHT else ConsoleButton.LEFT
    if (ratio < 2.4f) out += if (v.y > 0) ConsoleButton.DOWN else ConsoleButton.UP
    return out
}

/** The big ROTATE (A) key with its curved arrow, plus a smaller B key. */
@Composable
fun ActionKeys(
    skin: ConsoleSkin,
    pressed: Set<ConsoleButton>,
    onChange: (ConsoleButton, Boolean) -> Unit,
    modifier: Modifier = Modifier,
    scale: Float = 1f,
) {
    Box(modifier.size(152.dp * scale, 150.dp * scale)) {
        Canvas(Modifier.fillMaxSize()) {
            val u = this.size.width / 152f
            val c = Offset(84f * u, 76f * u)
            val rr = 54f * u
            val ink = skin.label.copy(alpha = 0.95f)
            drawArc(
                ink, startAngle = 196f, sweepAngle = 100f, useCenter = false,
                topLeft = Offset(c.x - rr, c.y - rr), size = Size(rr * 2, rr * 2),
                style = Stroke(width = 3.2f * u, cap = StrokeCap.Round),
            )
            val a = Math.toRadians(296.0)
            val tip = Offset(c.x + (rr * cos(a)).toFloat(), c.y + (rr * sin(a)).toFloat())
            val tx = (-sin(a)).toFloat(); val ty = cos(a).toFloat()
            val nx = -ty; val ny = tx
            val head = Path().apply {
                moveTo(tip.x + tx * 9f * u, tip.y + ty * 9f * u)
                lineTo(tip.x + nx * 6f * u, tip.y + ny * 6f * u)
                lineTo(tip.x - nx * 6f * u, tip.y - ny * 6f * u)
                close()
            }
            drawPath(head, ink)
        }
        Text(
            skin.aLabel,
            color = skin.label,
            fontSize = (9.5f * scale).sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.5.sp,
            modifier = Modifier.offset(112.dp * scale, 36.dp * scale).rotate(58f),
        )
        RoundKey(
            skin, 82.dp * scale, ConsoleButton.A in pressed,
            modifier = Modifier.offset(43.dp * scale, 35.dp * scale),
            onDown = { onChange(ConsoleButton.A, true) }, onUp = { onChange(ConsoleButton.A, false) },
        )
        RoundKey(
            skin, 46.dp * scale, ConsoleButton.B in pressed,
            modifier = Modifier.offset(4.dp * scale, 94.dp * scale),
            onDown = { onChange(ConsoleButton.B, true) }, onUp = { onChange(ConsoleButton.B, false) },
        )
        Text(
            skin.bLabel,
            color = skin.label.copy(alpha = 0.9f),
            fontSize = (8.5f * scale).sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.offset(8.dp * scale, 138.dp * scale),
        )
    }
}

/** Lightning-bolt decal that sits beside the screen. */
@Composable
fun BoltDecal(color: Color, modifier: Modifier = Modifier, flip: Boolean = false) {
    Canvas(modifier) {
        val w = this.size.width
        val h = this.size.height
        val pts = listOf(0.62f to 0.0f, 0.04f to 0.52f, 0.40f to 0.52f, 0.22f to 1.0f, 0.98f to 0.40f, 0.58f to 0.40f, 0.86f to 0.0f)
        val p = Path()
        pts.forEachIndexed { i, (x, y) ->
            val px = (if (flip) 1f - x else x) * w
            if (i == 0) p.moveTo(px, y * h) else p.lineTo(px, y * h)
        }
        p.close()
        drawPath(p, color)
    }
}

/** Raised curved band between the screen and the keys (the hump in the original shell). */
@Composable
fun RidgeBand(skin: ConsoleSkin, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        val w = this.size.width
        val h = this.size.height
        val p = Path().apply {
            moveTo(0f, h)
            lineTo(0f, h * 0.62f)
            cubicTo(w * 0.16f, h * 0.62f, w * 0.20f, h * 0.06f, w * 0.38f, h * 0.06f)
            lineTo(w * 0.62f, h * 0.06f)
            cubicTo(w * 0.80f, h * 0.06f, w * 0.84f, h * 0.62f, w, h * 0.62f)
            lineTo(w, h)
            close()
        }
        drawPath(p, Brush.verticalGradient(listOf(skin.ridgeTop, skin.ridgeBottom)))
        drawPath(p, skin.decal.copy(alpha = 0.10f), style = Stroke(width = 2f, join = StrokeJoin.Round))
        // soft shadow under the ridge
        drawRect(
            Brush.verticalGradient(listOf(Color.Black.copy(alpha = 0.35f), Color.Transparent), startY = h - 14f, endY = h),
            topLeft = Offset(0f, h - 14f), size = Size(w, 14f),
        )
    }
}

/** "SUPER MOUSE" style mascot drawn with white line art. */
@Composable
fun Mascot(skin: ConsoleSkin, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        val u = this.size.width / 100f
        val ink = skin.decal
        val st = Stroke(width = 2.4f * u, cap = StrokeCap.Round, join = StrokeJoin.Round)
        // cape
        val cape = Path().apply {
            moveTo(40f * u, 50f * u); cubicTo(18f * u, 52f * u, 8f * u, 64f * u, 4f * u, 84f * u)
            cubicTo(16f * u, 74f * u, 26f * u, 74f * u, 38f * u, 78f * u)
        }
        drawPath(cape, ink, style = st)
        // ears + head
        drawCircle(ink, 11f * u, Offset(32f * u, 24f * u), style = st)
        drawCircle(ink, 11f * u, Offset(68f * u, 24f * u), style = st)
        drawCircle(ink, 24f * u, Offset(50f * u, 46f * u), style = st)
        // eyes, nose, mouth
        drawCircle(ink, 3.2f * u, Offset(42f * u, 42f * u))
        drawCircle(ink, 3.2f * u, Offset(58f * u, 42f * u))
        drawCircle(ink, 3.6f * u, Offset(50f * u, 54f * u))
        val mouth = Path().apply { moveTo(43f * u, 60f * u); quadraticTo(50f * u, 67f * u, 57f * u, 60f * u) }
        drawPath(mouth, ink, style = Stroke(width = 2f * u, cap = StrokeCap.Round))
        // whiskers
        for (s in listOf(-1f, 1f)) {
            drawLine(ink, Offset(50f * u + s * 14f * u, 54f * u), Offset(50f * u + s * 30f * u, 50f * u), strokeWidth = 1.6f * u, cap = StrokeCap.Round)
            drawLine(ink, Offset(50f * u + s * 14f * u, 58f * u), Offset(50f * u + s * 30f * u, 62f * u), strokeWidth = 1.6f * u, cap = StrokeCap.Round)
        }
        // little body
        val body = Path().apply { moveTo(40f * u, 68f * u); lineTo(36f * u, 92f * u); moveTo(60f * u, 68f * u); lineTo(66f * u, 90f * u) }
        drawPath(body, ink, style = st)
    }
}

private fun DrawScope.star(c: Offset, r: Float, color: Color) {
    val p = Path()
    for (i in 0 until 8) {
        val ang = Math.toRadians(i * 45.0 - 90.0)
        val rad = if (i % 2 == 0) r else r * 0.35f
        val x = c.x + (rad * cos(ang)).toFloat()
        val y = c.y + (rad * sin(ang)).toFloat()
        if (i == 0) p.moveTo(x, y) else p.lineTo(x, y)
    }
    p.close()
    drawPath(p, color)
}

/** Logo block under the controls: mascot, "BRICK GAME", "9999IN1", stars and a swoosh. */
@Composable
fun BrandArea(skin: ConsoleSkin, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(92.dp)) {
        Mascot(skin, Modifier.align(Alignment.TopStart).offset(x = 26.dp, y = 2.dp).size(68.dp))
        Text(
            "SUPER MOUSE",
            color = skin.label.copy(alpha = 0.9f), fontSize = 7.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center,
            modifier = Modifier.align(Alignment.BottomStart).offset(x = 22.dp, y = (-2).dp).rotate(-4f),
        )
        val title = TextStyle(fontSize = 23.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, letterSpacing = 1.sp)
        val words = skin.brand.split(' ', limit = 2)
        Column(Modifier.align(Alignment.TopEnd).padding(end = 34.dp, top = 6.dp), horizontalAlignment = Alignment.Start) {
            Text(words.first(), style = title, color = skin.decal, modifier = Modifier.rotate(-4f))
            if (words.size > 1) Text(words[1], style = title, color = skin.decal, modifier = Modifier.offset(x = 14.dp, y = (-5).dp).rotate(-4f))
        }
        Canvas(Modifier.fillMaxSize()) {
            val u = density
            val ink = skin.decal
            val sw = Path().apply {
                moveTo(size.width * 0.34f, size.height * 0.80f)
                cubicTo(size.width * 0.46f, size.height * 1.00f, size.width * 0.60f, size.height * 0.62f, size.width * 0.80f, size.height * 0.84f)
            }
            drawPath(sw, ink.copy(alpha = 0.85f), style = Stroke(width = 1.6f * u, pathEffect = PathEffect.dashPathEffect(floatArrayOf(5f * u, 4f * u))))
            star(Offset(size.width * 0.37f, size.height * 0.66f), 4f * u, ink)
            star(Offset(size.width * 0.55f, size.height * 0.88f), 3.4f * u, ink)
            star(Offset(size.width * 0.70f, size.height * 0.92f), 3f * u, ink)
        }
        Text(
            skin.tagline,
            color = skin.label, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp,
            modifier = Modifier.align(Alignment.BottomEnd).padding(end = 36.dp, bottom = 5.dp),
        )
    }
}
