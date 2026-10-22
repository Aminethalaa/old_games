package com.retroconsole.app.ui

import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.material3.MaterialTheme
import com.retroconsole.app.AppGraph
import com.retroconsole.app.PendingInstall
import com.retroconsole.app.R
import com.retroconsole.app.console.ConsoleEvent
import com.retroconsole.app.console.ConsoleScreen
import com.retroconsole.app.store.InstallException
import kotlinx.coroutines.launch

enum class Page { CONSOLE, STORE, SETTINGS, TROPHIES }

@Composable
fun RetroRoot(graph: AppGraph, onConsoleVisible: (Boolean) -> Unit) {
    var page by rememberSaveable { mutableStateOf(Page.CONSOLE) }
    var openAdd by rememberSaveable { mutableStateOf(false) }
    val settings by graph.settings.state.collectAsStateWithLifecycle()
    val game by graph.console.game.collectAsStateWithLifecycle()
    val pending by graph.pendingInstall.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        graph.console.events.collect { e ->
            if (e is ConsoleEvent.Open) when (e.target) {
                "store" -> { openAdd = false; page = Page.STORE }
                "import" -> { openAdd = true; page = Page.STORE }
                "trophies" -> page = Page.TROPHIES
                "settings" -> page = Page.SETTINGS
            }
        }
    }
    // an install request that arrives from outside (link, QR, "open with") brings the user to the store
    LaunchedEffect(pending) { if (pending != null && page == Page.CONSOLE) { /* dialog shows over the console */ } }
    LaunchedEffect(page) {
        graph.console.setCovered(page != Page.CONSOLE)
        onConsoleVisible(page == Page.CONSOLE)
    }
    BackHandler(enabled = page != Page.CONSOLE) { page = Page.CONSOLE }
    BackHandler(enabled = page == Page.CONSOLE && game != null) { graph.console.handleBack() }

    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
            when (page) {
                Page.CONSOLE -> ConsoleScreen(graph.console, settings)
                Page.STORE -> StoreScreen(
                    onBack = { page = Page.CONSOLE },
                    onPlay = { id -> page = Page.CONSOLE; graph.console.launch(id) },
                    openAdd = openAdd,
                )
                Page.SETTINGS -> SettingsScreen(onBack = { page = Page.CONSOLE })
                Page.TROPHIES -> TrophiesScreen(onBack = { page = Page.CONSOLE })
            }
        }
    }
    PendingInstallHost(graph)
}

/** Confirms and runs installs that did not come from the verified store (file, link, QR). */
@Composable
fun PendingInstallHost(graph: AppGraph) {
    val ctx = LocalContext.current
    val pending by graph.pendingInstall.collectAsStateWithLifecycle()
    var progress by remember { mutableStateOf<Float?>(null) }
    val scope = rememberCoroutineScope()
    val p = pending ?: return

    val source = when (p) {
        is PendingInstall.FromUrl -> p.url
        is PendingInstall.FromFile -> p.uri.lastPathSegment ?: p.uri.toString()
        is PendingInstall.FromRom -> p.uri.lastPathSegment ?: p.uri.toString()
    }
    val isRom = p is PendingInstall.FromRom
    if (progress == null) {
        AlertDialog(
            onDismissRequest = { graph.pendingInstall.value = null },
            title = { Text(stringResource(if (isRom) R.string.rom_title else R.string.unverified_title)) },
            text = { Text(stringResource(if (isRom) R.string.rom_body else R.string.unverified_body, source)) },
            confirmButton = {
                TextButton(onClick = {
                    scope.launch {
                        progress = 0f
                        try {
                            val g = when (p) {
                                is PendingInstall.FromUrl -> graph.installer.installFromUrl(p.url) { progress = it }
                                is PendingInstall.FromFile -> graph.installer.installFromUri(p.uri) { progress = it }
                                is PendingInstall.FromRom -> graph.installer.importRom(p.uri) { progress = it }
                            }
                            Toast.makeText(ctx, ctx.getString(R.string.msg_installed, g.manifest.name), Toast.LENGTH_LONG).show()
                        } catch (e: InstallException) {
                            Toast.makeText(ctx, ctx.errorText(e), Toast.LENGTH_LONG).show()
                        } finally {
                            progress = null
                            graph.pendingInstall.value = null
                        }
                    }
                }) { Text(stringResource(R.string.install)) }
            },
            dismissButton = { TextButton(onClick = { graph.pendingInstall.value = null }) { Text(stringResource(R.string.cancel)) } },
        )
    } else {
        AlertDialog(
            onDismissRequest = {},
            title = { Text(stringResource(R.string.installing)) },
            text = { LinearProgressIndicator(progress = { (progress ?: 0f).coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) },
            confirmButton = {},
        )
    }
}
