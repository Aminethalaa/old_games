package com.retroconsole.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.retroconsole.app.data.PixelIcon

private fun parse(hex: String): Color? = runCatching { Color(android.graphics.Color.parseColor(hex)) }.getOrNull()

/** Draws a manifest/catalog [PixelIcon] crisply (nearest-neighbour) on a tinted tile. */
@Composable
fun PixelIconView(icon: PixelIcon?, accent: String, size: Dp, modifier: Modifier = Modifier) {
    val tint = remember(accent) { (parse(accent) ?: RetroColors.Yellow).copy(alpha = 0.16f) }
    val palette = remember(icon) { icon?.palette?.mapValues { parse(it.value) } ?: emptyMap() }
    Box(modifier.size(size).clip(RoundedCornerShape(size / 6)).background(tint)) {
        Canvas(Modifier.size(size)) {
            val rows = icon?.rows
            if (rows.isNullOrEmpty()) {
                val u = this.size.width / 8f
                val c = parse(accent) ?: RetroColors.Yellow
                drawRect(c, Offset(2 * u, 2 * u), Size(4 * u, 4 * u))
                return@Canvas
            }
            val n = rows.size
            val cell = this.size.width * 0.84f / n
            val ox = (this.size.width - cell * n) / 2f
            val oy = (this.size.height - cell * n) / 2f
            for ((y, row) in rows.withIndex()) for ((x, ch) in row.withIndex()) {
                val col = palette[ch.toString()] ?: continue
                // +0.6f overdraw avoids hairline seams between cells on fractional pixel sizes
                drawRect(col, Offset(ox + x * cell, oy + y * cell), Size(cell + 0.6f, cell + 0.6f))
            }
        }
    }
}
