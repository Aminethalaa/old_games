package com.retroconsole.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import com.retroconsole.app.R

val PixelFont = FontFamily(Font(R.font.press_start_2p))

object RetroColors {
    val Yellow = Color(0xFFFFC800)
    val Cyan = Color(0xFF3DE2FF)
    val Green = Color(0xFF00E436)
    val Red = Color(0xFFFF4D6D)
    val Ink = Color(0xFF0B0E14)
    val Panel = Color(0xFF141A28)
    val PanelHi = Color(0xFF1C2336)
    val Line = Color(0xFF2A3550)
    val Dim = Color(0xFF9FB2D0)
}

private val scheme = darkColorScheme(
    primary = RetroColors.Yellow, onPrimary = Color(0xFF241A00),
    secondary = RetroColors.Cyan, onSecondary = Color(0xFF00252B),
    tertiary = RetroColors.Green,
    background = RetroColors.Ink, onBackground = Color(0xFFE8F1FF),
    surface = RetroColors.Panel, onSurface = Color(0xFFE8F1FF),
    surfaceVariant = RetroColors.PanelHi, onSurfaceVariant = RetroColors.Dim,
    outline = RetroColors.Line, error = RetroColors.Red,
)

@Composable
fun RetroTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = scheme, typography = Typography(), content = content)
}
