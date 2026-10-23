package com.retroconsole.app

import android.app.Application
import android.net.Uri
import com.retroconsole.app.console.ConsoleController
import com.retroconsole.app.data.GameLibrary
import com.retroconsole.app.data.ProgressStore
import com.retroconsole.app.data.SettingsStore
import com.retroconsole.app.store.GameInstaller
import com.retroconsole.app.store.StoreClient
import com.retroconsole.app.store.UpdateWorker
import com.retroconsole.app.util.Haptics
import java.io.File
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.flow.MutableStateFlow
import okhttp3.OkHttpClient

/** A game package the user opened via link, QR code or a file, waiting for their confirmation. */
sealed interface PendingInstall {
    data class FromUrl(val url: String) : PendingInstall
    data class FromFile(val uri: Uri) : PendingInstall
    /** A NES / Game Boy game file the user already owns ('Import my own game'). */
    data class FromRom(val uri: Uri) : PendingInstall
}

/** Tiny hand-rolled service locator; everything here lives as long as the process. */
class AppGraph(app: Application) {
    val settings = SettingsStore(app)
    val progress = ProgressStore(app)
    val library = GameLibrary(app, progress)
    val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build()
    val storeClient = StoreClient(http, File(app.cacheDir, "catalog.json"))
    val installer = GameInstaller(app, http, library, progress)
    val haptics = Haptics(app, settings)
    val pendingInstall = MutableStateFlow<PendingInstall?>(null)
    /** Created on first use: background work (auto-update) must not pay for a WebView. */
    val console: ConsoleController by lazy { ConsoleController(app, this) }
}

class RetroApp : Application() {
    lateinit var graph: AppGraph
        private set

    override fun onCreate() {
        super.onCreate()
        graph = AppGraph(this)
        // WorkManager is unavailable in some unit-test environments; auto-update is best effort anyway.
        runCatching { UpdateWorker.schedule(this, graph.settings.value.autoUpdate) }
    }
}
