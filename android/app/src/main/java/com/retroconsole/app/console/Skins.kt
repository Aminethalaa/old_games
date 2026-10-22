package com.retroconsole.app.console

import androidx.annotation.StringRes
import androidx.compose.ui.graphics.Color
import com.retroconsole.app.R

/** Visual theme of the plastic shell. Add a skin here and it shows up in Settings automatically. */
data class ConsoleSkin(
    val id: String,
    @StringRes val nameRes: Int,
    val bodyTop: Color,
    val bodyBottom: Color,
    val bezel: Color,
    val ridgeTop: Color,
    val ridgeBottom: Color,
    val button: Color,
    val buttonDark: Color,
    val label: Color,
    val decal: Color,
    val model: String,
    val brand: String,
    val tagline: String,
    val aLabel: String = "ROTATE",
    val bLabel: String = "DROP",
)

object Skins {
    val Classic = ConsoleSkin(
        id = "classic", nameRes = R.string.skin_classic,
        bodyTop = Color(0xFF2A2A2E), bodyBottom = Color(0xFF141416), bezel = Color(0xFF1C1C1F),
        ridgeTop = Color(0xFF3A3A3F), ridgeBottom = Color(0xFF18181A),
        button = Color(0xFFFFC800), buttonDark = Color(0xFFB88A00),
        label = Color(0xFFF2F2F2), decal = Color(0xFFFFFFFF),
        model = "CLASSIC", brand = "BRICK GAME", tagline = "9999IN1",
    )
    val Purple = ConsoleSkin(
        id = "purple", nameRes = R.string.skin_purple,
        bodyTop = Color(0xFF7A4FD0), bodyBottom = Color(0xFF4A2A93), bezel = Color(0xFF2B2140),
        ridgeTop = Color(0xFF8E66DD), ridgeBottom = Color(0xFF4D2D99),
        button = Color(0xFFFF4D8D), buttonDark = Color(0xFFB02A62),
        label = Color(0xFFFFFFFF), decal = Color(0xFFE8DCFF),
        model = "COLOR", brand = "POCKET COLOR", tagline = "9999IN1",
        aLabel = "A", bLabel = "B",
    )
    val Atomic = ConsoleSkin(
        id = "atomic", nameRes = R.string.skin_atomic,
        bodyTop = Color(0xFF3F8CFF), bodyBottom = Color(0xFF1B3F9E), bezel = Color(0xFF101A33),
        ridgeTop = Color(0xFF68A8FF), ridgeBottom = Color(0xFF204AAE),
        button = Color(0xFFF4F7FF), buttonDark = Color(0xFF8E9BC4),
        label = Color(0xFFFFFFFF), decal = Color(0xFFCFE3FF),
        model = "CLEAR", brand = "ATOMIC BRICK", tagline = "9999IN1",
    )
    val Neon = ConsoleSkin(
        id = "neon", nameRes = R.string.skin_neon,
        bodyTop = Color(0xFF14142A), bodyBottom = Color(0xFF07070F), bezel = Color(0xFF0B0B18),
        ridgeTop = Color(0xFF1E1E40), ridgeBottom = Color(0xFF0A0A16),
        button = Color(0xFF19F0FF), buttonDark = Color(0xFF0A8E99),
        label = Color(0xFFFF4DE1), decal = Color(0xFF19F0FF),
        model = "NEON", brand = "NIGHT BRICK", tagline = "9999IN1",
    )
    val Racer = ConsoleSkin(
        id = "racer", nameRes = R.string.skin_racer,
        bodyTop = Color(0xFFE23B3B), bodyBottom = Color(0xFF9E1B1B), bezel = Color(0xFF2A0F0F),
        ridgeTop = Color(0xFFF05A5A), ridgeBottom = Color(0xFFA11E1E),
        button = Color(0xFFFFFFFF), buttonDark = Color(0xFFB9B9B9),
        label = Color(0xFFFFFFFF), decal = Color(0xFFFFE9E9),
        model = "TURBO", brand = "SPEED BRICK", tagline = "9999IN1",
    )

    val all = listOf(Classic, Purple, Atomic, Neon, Racer)
    fun byId(id: String): ConsoleSkin = all.firstOrNull { it.id == id } ?: Classic
}
