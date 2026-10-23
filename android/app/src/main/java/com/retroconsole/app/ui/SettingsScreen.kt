package com.retroconsole.app.ui

import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.os.LocaleListCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.retroconsole.app.BuildConfig
import com.retroconsole.app.R
import com.retroconsole.app.RetroApp
import com.retroconsole.app.console.Skins
import com.retroconsole.app.store.UpdateWorker

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp)) {
        Text(title.uppercase(), fontFamily = PixelFont, fontSize = 10.sp, color = RetroColors.Yellow)
        Spacer(Modifier.height(10.dp))
        Column(
            Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface, RoundedCornerShape(14.dp))
                .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(14.dp)).padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) { content() }
    }
}

@Composable
private fun SwitchRow(label: String, checked: Boolean, hint: String? = null, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().clickable { onChange(!checked) }, verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(label, fontSize = 15.sp)
            if (hint != null) Text(hint, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(checked = checked, onCheckedChange = onChange)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onBack: () -> Unit) {
    val ctx = LocalContext.current
    val graph = (ctx.applicationContext as RetroApp).graph
    val s by graph.settings.state.collectAsStateWithLifecycle()
    var confirmReset by remember { mutableStateOf(false) }
    var urlDraft by remember(s.storeUrl) { mutableStateOf(s.storeUrl) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.settings_title), fontFamily = PixelFont, fontSize = 14.sp) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, stringResource(R.string.back)) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
            )
        },
    ) { pad ->
        Column(Modifier.padding(pad).fillMaxSize().verticalScroll(rememberScrollState())) {
            Section(stringResource(R.string.sec_console)) {
                Text(stringResource(R.string.set_skin), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    for (skin in Skins.all) {
                        Column(Modifier.clickable { graph.settings.update { it.copy(skin = skin.id) } }, horizontalAlignment = Alignment.CenterHorizontally) {
                            Box(
                                Modifier.size(46.dp)
                                    .background(androidx.compose.ui.graphics.Brush.verticalGradient(listOf(skin.bodyTop, skin.bodyBottom)), CircleShape)
                                    .border(if (skin.id == s.skin) 3.dp else 1.dp, if (skin.id == s.skin) RetroColors.Yellow else MaterialTheme.colorScheme.outline, CircleShape),
                                contentAlignment = Alignment.Center,
                            ) { Box(Modifier.size(16.dp).background(skin.button, CircleShape)) }
                            Text(stringResource(skin.nameRes), fontSize = 10.sp, modifier = Modifier.padding(top = 4.dp), maxLines = 1)
                        }
                    }
                }
                Text(stringResource(R.string.set_lcd), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(s.lcd == "color", { graph.settings.update { it.copy(lcd = "color") } }, { Text(stringResource(R.string.lcd_color)) })
                    FilterChip(s.lcd == "gb", { graph.settings.update { it.copy(lcd = "gb") } }, { Text(stringResource(R.string.lcd_gb)) })
                    FilterChip(s.lcd == "brick", { graph.settings.update { it.copy(lcd = "brick") } }, { Text(stringResource(R.string.lcd_brick)) })
                }
                SwitchRow(stringResource(R.string.set_grid), s.grid, stringResource(R.string.set_grid_hint)) { v -> graph.settings.update { it.copy(grid = v) } }
                SwitchRow(stringResource(R.string.set_boot), s.bootAnimation) { v -> graph.settings.update { it.copy(bootAnimation = v) } }
            }

            Section(stringResource(R.string.sec_sound)) {
                SwitchRow(stringResource(R.string.set_sound), s.sound) { v -> graph.settings.update { it.copy(sound = v) } }
                Column {
                    Text(stringResource(R.string.set_volume), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Slider(value = s.volume, onValueChange = { v -> graph.settings.update { it.copy(volume = v) } }, valueRange = 0f..1f)
                }
                SwitchRow(stringResource(R.string.set_vibrate), s.vibrate, stringResource(R.string.set_vibrate_hint)) { v -> graph.settings.update { it.copy(vibrate = v) } }
            }

            Section(stringResource(R.string.sec_controls)) {
                SwitchRow(stringResource(R.string.set_lefty), s.leftHanded) { v -> graph.settings.update { it.copy(leftHanded = v) } }
                Column {
                    Text(stringResource(R.string.set_btn_size), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Slider(value = s.buttonScale, onValueChange = { v -> graph.settings.update { it.copy(buttonScale = v) } }, valueRange = 0.8f..1.2f)
                }
                Text(stringResource(R.string.set_gamepad_hint), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            Section(stringResource(R.string.sec_language)) {
                val options = listOf("system" to R.string.lang_system, "en" to R.string.lang_en, "fr" to R.string.lang_fr, "ar" to R.string.lang_ar)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for ((tag, label) in options) {
                        FilterChip(
                            selected = s.language == tag,
                            onClick = {
                                graph.settings.update { it.copy(language = tag) }
                                AppCompatDelegate.setApplicationLocales(if (tag == "system") LocaleListCompat.getEmptyLocaleList() else LocaleListCompat.forLanguageTags(tag))
                            },
                            label = { Text(stringResource(label), fontSize = 12.sp) },
                        )
                    }
                }
            }

            Section(stringResource(R.string.sec_store)) {
                SwitchRow(stringResource(R.string.set_autoupdate), s.autoUpdate, stringResource(R.string.set_autoupdate_hint)) { v ->
                    graph.settings.update { it.copy(autoUpdate = v) }
                    UpdateWorker.schedule(ctx, v)
                }
                OutlinedTextField(
                    value = urlDraft, onValueChange = { urlDraft = it }, singleLine = true,
                    label = { Text(stringResource(R.string.set_store_url)) }, modifier = Modifier.fillMaxWidth(),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        enabled = urlDraft.trim().startsWith("https://") && urlDraft.trim() != s.storeUrl,
                        onClick = { graph.settings.update { it.copy(storeUrl = urlDraft.trim()) } },
                    ) { Text(stringResource(R.string.save)) }
                    TextButton(onClick = { graph.settings.update { it.copy(storeUrl = BuildConfig.DEFAULT_STORE_URL) } }) { Text(stringResource(R.string.set_store_default)) }
                }
            }

            Section(stringResource(R.string.sec_data)) {
                OutlinedButton(onClick = { confirmReset = true }, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.set_reset_progress)) }
            }

            Section(stringResource(R.string.sec_about)) {
                Text("Retro Console ${BuildConfig.VERSION_NAME}", fontWeight = FontWeight.Bold)
                Text(stringResource(R.string.about_body), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(stringResource(R.string.about_font), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.height(24.dp))
        }
    }

    if (confirmReset) {
        AlertDialog(
            onDismissRequest = { confirmReset = false },
            title = { Text(stringResource(R.string.set_reset_progress)) },
            text = { Text(stringResource(R.string.set_reset_body)) },
            confirmButton = { TextButton(onClick = { graph.progress.clearAll(); confirmReset = false }) { Text(stringResource(R.string.btn_remove), color = RetroColors.Red) } },
            dismissButton = { TextButton(onClick = { confirmReset = false }) { Text(stringResource(R.string.cancel)) } },
        )
    }
}
