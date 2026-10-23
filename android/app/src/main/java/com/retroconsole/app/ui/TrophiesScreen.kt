package com.retroconsole.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.retroconsole.app.R
import com.retroconsole.app.RetroApp

private fun formatDuration(ms: Long): String {
    val m = ms / 60000
    return if (m < 60) "${m}m" else "${m / 60}h ${m % 60}m"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrophiesScreen(onBack: () -> Unit) {
    val graph = (LocalContext.current.applicationContext as RetroApp).graph
    val rev by graph.progress.revision.collectAsStateWithLifecycle()
    val games = remember(rev) { graph.library.all() }
    val progress = graph.progress

    val totalAch = games.sumOf { it.manifest.achievements.size }
    val unlocked = games.sumOf { g -> g.manifest.achievements.count { it.id in progress.achievements(g.id) } }
    val totalTime = progress.totalPlayTimeMs(games.map { it.id })
    val played = games.count { progress.plays(it.id) > 0 }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.trophies_title), fontFamily = PixelFont, fontSize = 14.sp) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, stringResource(R.string.back)) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
            )
        },
    ) { pad ->
        LazyColumn(Modifier.padding(pad).fillMaxSize(), contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                Row(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface, RoundedCornerShape(14.dp)).padding(14.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
                    Stat("$unlocked/$totalAch", stringResource(R.string.stat_trophies))
                    Stat("$played/${games.size}", stringResource(R.string.stat_played))
                    Stat(formatDuration(totalTime), stringResource(R.string.stat_time))
                }
            }
            items(games, key = { it.id }) { g ->
                val have = progress.achievements(g.id)
                val hi = progress.hiScore(g.id)
                Column(
                    Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface, RoundedCornerShape(14.dp))
                        .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(14.dp)).padding(12.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        PixelIconView(g.manifest.icon, g.manifest.color, 44.dp)
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(g.manifest.name, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            Text(
                                stringResource(R.string.trophy_line, hi, progress.plays(g.id), formatDuration(progress.playTimeMs(g.id))),
                                fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        if (g.manifest.achievements.isNotEmpty()) Text("${g.manifest.achievements.count { it.id in have }}/${g.manifest.achievements.size}", color = RetroColors.Yellow, fontFamily = PixelFont, fontSize = 10.sp)
                    }
                    if (g.manifest.achievements.isNotEmpty()) Spacer(Modifier.height(8.dp))
                    for (a in g.manifest.achievements) {
                        val got = a.id in have
                        Row(Modifier.padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(if (got) "★" else "☆", color = if (got) RetroColors.Yellow else MaterialTheme.colorScheme.outline, fontSize = 16.sp)
                            Spacer(Modifier.width(8.dp))
                            Column {
                                Text(if (got) a.name else "???", fontSize = 13.sp, fontWeight = if (got) FontWeight.Bold else FontWeight.Normal)
                                Text(a.desc, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Stat(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontFamily = PixelFont, fontSize = 14.sp, color = RetroColors.Yellow)
        Text(label, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
