package com.retroconsole.app.ui

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.retroconsole.app.PendingInstall
import com.retroconsole.app.R
import com.retroconsole.app.RetroApp
import com.retroconsole.app.data.Categories
import com.retroconsole.app.store.CatalogEntry
import com.retroconsole.app.store.InstallException
import kotlinx.coroutines.launch

internal fun Context.errorText(e: InstallException): String = getString(
    when (e.code) {
        InstallException.Code.TOO_LARGE -> R.string.err_too_large
        InstallException.Code.BAD_ARCHIVE -> R.string.err_bad_archive
        InstallException.Code.UNSAFE_PATH, InstallException.Code.BAD_FILE_TYPE -> R.string.err_unsafe
        InstallException.Code.NO_INDEX -> R.string.err_no_index
        InstallException.Code.BAD_MANIFEST, InstallException.Code.ID_MISMATCH -> R.string.err_manifest
        InstallException.Code.ID_RESERVED -> R.string.err_reserved
        InstallException.Code.CHECKSUM -> R.string.err_checksum
        InstallException.Code.UNSUPPORTED_SDK -> R.string.err_sdk
        InstallException.Code.NETWORK -> R.string.err_network
        InstallException.Code.IO -> R.string.err_io
    },
)

internal fun categoryLabelRes(category: String): Int = when (category) {
    "classic" -> R.string.cat_classic
    "arcade" -> R.string.cat_arcade
    "puzzle" -> R.string.cat_puzzle
    "action" -> R.string.cat_action
    else -> R.string.cat_other
}

internal fun formatSize(bytes: Long): String = when {
    bytes <= 0 -> ""
    bytes < 1024 * 1024 -> "${(bytes + 1023) / 1024} KB"
    else -> "%.1f MB".format(bytes / 1048576.0)
}

private enum class Filter { ALL, INSTALLED, UPDATES, CLASSIC, ARCADE, PUZZLE, ACTION }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StoreScreen(onBack: () -> Unit, onPlay: (String) -> Unit, openAdd: Boolean, vm: StoreViewModel = viewModel()) {
    val ctx = LocalContext.current
    val graph = (ctx.applicationContext as RetroApp).graph
    val catalog by vm.catalog.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    val offline by vm.offline.collectAsStateWithLifecycle()
    val progress by vm.progress.collectAsStateWithLifecycle()
    val installed by vm.installed.collectAsStateWithLifecycle()
    val installChanges by graph.installer.changes.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    var filter by rememberSaveable { mutableStateOf(Filter.ALL) }
    var query by rememberSaveable { mutableStateOf("") }
    var showAdd by rememberSaveable { mutableStateOf(openAdd) }
    var showLink by rememberSaveable { mutableStateOf(false) }
    var confirmRemove by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(installChanges) { vm.reloadInstalled() }
    LaunchedEffect(Unit) {
        vm.messages.collect { m ->
            val text = when (m) {
                is StoreMessage.Installed -> ctx.getString(R.string.msg_installed, m.name)
                is StoreMessage.Removed -> ctx.getString(R.string.msg_removed, m.name)
                is StoreMessage.Failed -> ctx.errorText(m.error)
                is StoreMessage.CatalogError -> ctx.getString(R.string.msg_catalog_error)
                is StoreMessage.AllDone -> ctx.getString(R.string.msg_all_done, m.count)
            }
            snackbar.showSnackbar(text)
        }
    }

    val pickFile = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) graph.pendingInstall.value = PendingInstall.FromFile(uri)
    }
    val scan = rememberLauncherForActivityResult(ScanContract()) { result ->
        val text = result.contents ?: return@rememberLauncherForActivityResult
        val url = if (text.startsWith("retrogame://")) Uri.parse(text).getQueryParameter("url") else text
        if (url != null && url.startsWith("https://")) graph.pendingInstall.value = PendingInstall.FromUrl(url)
        else scope.launch { snackbar.showSnackbar(ctx.getString(R.string.err_network)) }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.store_title), fontFamily = PixelFont, fontSize = 14.sp) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, stringResource(R.string.back)) } },
                actions = {
                    IconButton(onClick = { vm.refresh() }) { Icon(Icons.Default.Refresh, stringResource(R.string.refresh)) }
                    IconButton(onClick = { showAdd = true }) { Icon(Icons.Default.Add, stringResource(R.string.add_game)) }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
            )
        },
    ) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            if (loading) LinearProgressIndicator(Modifier.fillMaxWidth())

            val all = catalog?.games.orEmpty()
            val todo = all.count { vm.statusOf(it) != GameStatus.INSTALLED }
            if (all.isNotEmpty()) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            if (offline) stringResource(R.string.store_offline) else stringResource(R.string.store_games_count, all.size),
                            color = if (offline) RetroColors.Red else MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp,
                        )
                    }
                    Button(onClick = { vm.installAll() }, enabled = todo > 0 && progress.isEmpty()) {
                        Text(if (todo > 0) stringResource(R.string.store_install_all, todo) else stringResource(R.string.store_all_installed))
                    }
                }
            }

            OutlinedTextField(
                value = query, onValueChange = { query = it }, singleLine = true,
                placeholder = { Text(stringResource(R.string.store_search)) },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
            )
            LazyRow(contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(Filter.values().toList()) { f ->
                    FilterChip(
                        selected = filter == f, onClick = { filter = f },
                        label = {
                            Text(
                                when (f) {
                                    Filter.ALL -> stringResource(R.string.filter_all)
                                    Filter.INSTALLED -> stringResource(R.string.filter_installed)
                                    Filter.UPDATES -> stringResource(R.string.filter_updates)
                                    Filter.CLASSIC -> stringResource(R.string.cat_classic)
                                    Filter.ARCADE -> stringResource(R.string.cat_arcade)
                                    Filter.PUZZLE -> stringResource(R.string.cat_puzzle)
                                    Filter.ACTION -> stringResource(R.string.cat_action)
                                },
                            )
                        },
                    )
                }
            }

            val q = query.trim().lowercase()
            val catalogIds = all.map { it.id }.toSet()
            val entries = all.filter { e ->
                (q.isEmpty() || e.name.lowercase().contains(q) || e.tags.any { it.contains(q) } || e.description.lowercase().contains(q)) &&
                    when (filter) {
                        Filter.ALL -> true
                        Filter.INSTALLED -> vm.statusOf(e) != GameStatus.NOT_INSTALLED
                        Filter.UPDATES -> vm.statusOf(e) == GameStatus.UPDATE
                        Filter.CLASSIC -> e.category == "classic"
                        Filter.ARCADE -> e.category == "arcade"
                        Filter.PUZZLE -> e.category == "puzzle"
                        Filter.ACTION -> e.category == "action"
                    }
            }.sortedWith(compareBy({ Categories.rank(it.category) }, { it.name }))
            // games that are installed but not in the catalog (built-in, imported, side-loaded)
            val local = if (filter == Filter.INSTALLED || filter == Filter.ALL && q.isNotEmpty()) {
                installed.values.filter { it.id !in catalogIds && (q.isEmpty() || it.manifest.name.lowercase().contains(q)) }.sortedBy { it.manifest.name }
            } else emptyList()

            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (all.isEmpty() && !loading) {
                    item { EmptyStore(offline) { vm.refresh() } }
                }
                items(entries, key = { it.id }) { e ->
                    StoreCard(
                        entry = e, status = vm.statusOf(e), progress = progress[e.id],
                        onInstall = { vm.install(e) }, onPlay = { onPlay(e.id) }, onRemove = { confirmRemove = e.id },
                    )
                }
                items(local, key = { "local-" + it.id }) { g ->
                    LocalCard(g.manifest.name, g.manifest.description, g.manifest.icon, g.manifest.color, g.builtin, onPlay = { onPlay(g.id) }, onRemove = { confirmRemove = g.id })
                }
            }
        }
    }

    if (showAdd) {
        AlertDialog(
            onDismissRequest = { showAdd = false },
            title = { Text(stringResource(R.string.add_game)) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(stringResource(R.string.add_game_hint), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    OutlinedButton(onClick = { showAdd = false; pickFile.launch(arrayOf("application/zip", "application/x-zip-compressed", "application/octet-stream", "text/html")) }, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.add_from_file)) }
                    OutlinedButton(onClick = { showAdd = false; showLink = true }, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.add_from_link)) }
                    OutlinedButton(onClick = {
                        showAdd = false
                        scan.launch(ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE).setPrompt(ctx.getString(R.string.add_scan_prompt)).setBeepEnabled(false).setOrientationLocked(false))
                    }, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.add_scan_qr)) }
                }
            },
            confirmButton = { TextButton(onClick = { showAdd = false }) { Text(stringResource(R.string.cancel)) } },
        )
    }
    if (showLink) {
        var link by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showLink = false },
            title = { Text(stringResource(R.string.add_from_link)) },
            text = {
                OutlinedTextField(
                    value = link, onValueChange = { link = it }, singleLine = true,
                    placeholder = { Text("https://…/game.zip") }, modifier = Modifier.fillMaxWidth(),
                )
            },
            confirmButton = {
                TextButton(
                    enabled = link.trim().startsWith("https://"),
                    onClick = { graph.pendingInstall.value = PendingInstall.FromUrl(link.trim()); showLink = false },
                ) { Text(stringResource(R.string.install)) }
            },
            dismissButton = { TextButton(onClick = { showLink = false }) { Text(stringResource(R.string.cancel)) } },
        )
    }
    confirmRemove?.let { id ->
        val name = installed[id]?.manifest?.name ?: id
        AlertDialog(
            onDismissRequest = { confirmRemove = null },
            title = { Text(stringResource(R.string.remove_title, name)) },
            text = { Text(stringResource(R.string.remove_body)) },
            confirmButton = { TextButton(onClick = { vm.uninstall(id); confirmRemove = null }) { Text(stringResource(R.string.btn_remove), color = RetroColors.Red) } },
            dismissButton = { TextButton(onClick = { confirmRemove = null }) { Text(stringResource(R.string.cancel)) } },
        )
    }
}

@Composable
private fun EmptyStore(offline: Boolean, onRetry: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(if (offline) stringResource(R.string.store_offline_body) else stringResource(R.string.store_empty), color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(12.dp))
        Button(onClick = onRetry) { Text(stringResource(R.string.refresh)) }
    }
}

@Composable
private fun CardFrame(content: @Composable () -> Unit) {
    Box(
        Modifier.fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(14.dp))
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(14.dp))
            .padding(12.dp),
    ) { content() }
}

@Composable
private fun StoreCard(entry: CatalogEntry, status: GameStatus, progress: Float?, onInstall: () -> Unit, onPlay: () -> Unit, onRemove: () -> Unit) {
    CardFrame {
        Row(verticalAlignment = Alignment.CenterVertically) {
            PixelIconView(entry.icon, entry.color, 58.dp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(entry.name, fontWeight = FontWeight.Bold, fontSize = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    listOf(stringResource(categoryLabelRes(entry.category)), "v${entry.version}", formatSize(entry.size)).filter { it.isNotBlank() }.joinToString("  •  "),
                    fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(entry.description, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.85f))
            }
            Spacer(Modifier.width(8.dp))
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                when {
                    progress != null -> Box(contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(progress = { progress.coerceIn(0.02f, 1f) }, modifier = Modifier.size(40.dp), strokeWidth = 3.dp)
                        Text("${(progress * 100).toInt()}", fontSize = 10.sp)
                    }
                    status == GameStatus.NOT_INSTALLED -> Button(onClick = onInstall, contentPadding = PaddingValues(horizontal = 14.dp)) { Text(stringResource(R.string.btn_install)) }
                    status == GameStatus.UPDATE -> {
                        Button(onClick = onInstall, contentPadding = PaddingValues(horizontal = 14.dp)) { Text(stringResource(R.string.btn_update)) }
                        TextButton(onClick = onRemove) { Icon(Icons.Default.Delete, stringResource(R.string.btn_remove), Modifier.size(18.dp)) }
                    }
                    else -> {
                        OutlinedButton(onClick = onPlay, contentPadding = PaddingValues(horizontal = 12.dp), border = BorderStroke(1.dp, RetroColors.Green)) {
                            Icon(Icons.Default.PlayArrow, null, Modifier.size(18.dp), tint = RetroColors.Green)
                            Text(stringResource(R.string.btn_play), color = RetroColors.Green)
                        }
                        TextButton(onClick = onRemove) { Icon(Icons.Default.Delete, stringResource(R.string.btn_remove), Modifier.size(18.dp)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun LocalCard(name: String, description: String, icon: com.retroconsole.app.data.PixelIcon?, color: String, builtin: Boolean, onPlay: () -> Unit, onRemove: () -> Unit) {
    CardFrame {
        Row(verticalAlignment = Alignment.CenterVertically) {
            PixelIconView(icon, color, 58.dp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(name, fontWeight = FontWeight.Bold, fontSize = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(stringResource(if (builtin) R.string.label_builtin else R.string.label_imported), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (description.isNotBlank()) Text(description, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            OutlinedButton(onClick = onPlay, contentPadding = PaddingValues(horizontal = 12.dp), border = BorderStroke(1.dp, RetroColors.Green)) {
                Icon(Icons.Default.PlayArrow, null, Modifier.size(18.dp), tint = RetroColors.Green)
                Text(stringResource(R.string.btn_play), color = RetroColors.Green)
            }
            if (!builtin) TextButton(onClick = onRemove) { Icon(Icons.Default.Delete, stringResource(R.string.btn_remove), Modifier.size(18.dp)) }
        }
    }
}
