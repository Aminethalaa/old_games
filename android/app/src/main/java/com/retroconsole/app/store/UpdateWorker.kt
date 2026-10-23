package com.retroconsole.app.store

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.retroconsole.app.RetroApp
import com.retroconsole.app.data.compareVersions
import java.util.concurrent.TimeUnit

/** Background auto-update: on Wi-Fi, installs newer versions of already-installed store games. */
class UpdateWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        val graph = (applicationContext as RetroApp).graph
        val settings = graph.settings.value
        if (!settings.autoUpdate) return Result.success()
        return try {
            val catalog = graph.storeClient.fetch(settings.storeUrl)
            for (entry in catalog.games) {
                val current = graph.library.installedVersion(entry.id) ?: continue
                if (graph.library.find(entry.id)?.builtin == true) continue
                if (compareVersions(entry.version, current) > 0) {
                    runCatching { graph.installer.installEntry(entry, settings.storeUrl) }
                }
            }
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    companion object {
        private const val NAME = "retro-store-auto-update"

        fun schedule(context: Context, enabled: Boolean) {
            val wm = WorkManager.getInstance(context)
            if (!enabled) { wm.cancelUniqueWork(NAME); return }
            val req = PeriodicWorkRequestBuilder<UpdateWorker>(12, TimeUnit.HOURS)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.UNMETERED).setRequiresBatteryNotLow(true).build())
                .build()
            wm.enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.UPDATE, req)
        }
    }
}
