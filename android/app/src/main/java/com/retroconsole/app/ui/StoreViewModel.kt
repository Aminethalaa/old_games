package com.retroconsole.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.retroconsole.app.RetroApp
import com.retroconsole.app.data.InstalledGame
import com.retroconsole.app.data.compareVersions
import com.retroconsole.app.store.Catalog
import com.retroconsole.app.store.CatalogEntry
import com.retroconsole.app.store.InstallException
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit

enum class GameStatus { NOT_INSTALLED, INSTALLED, UPDATE }

sealed interface StoreMessage {
    data class Installed(val name: String) : StoreMessage
    data class Removed(val name: String) : StoreMessage
    data class Failed(val error: InstallException) : StoreMessage
    data class CatalogError(val detail: String) : StoreMessage
    data class AllDone(val count: Int) : StoreMessage
}

class StoreViewModel(app: Application) : AndroidViewModel(app) {
    private val graph get() = getApplication<RetroApp>().graph

    private val _catalog = MutableStateFlow<Catalog?>(graph.storeClient.cached())
    val catalog: StateFlow<Catalog?> = _catalog.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _offline = MutableStateFlow(false)
    val offline: StateFlow<Boolean> = _offline.asStateFlow()

    /** id -> download progress 0..1 while installing. */
    private val _progress = MutableStateFlow<Map<String, Float>>(emptyMap())
    val progress: StateFlow<Map<String, Float>> = _progress.asStateFlow()

    private val _installed = MutableStateFlow(readInstalled())
    /** Every launchable game, keyed by id (built-in games included). */
    val installed: StateFlow<Map<String, InstalledGame>> = _installed.asStateFlow()

    private val _messages = MutableSharedFlow<StoreMessage>(extraBufferCapacity = 8)
    val messages: SharedFlow<StoreMessage> = _messages.asSharedFlow()

    private val gate = Semaphore(2)

    init { refresh() }

    private fun readInstalled(): Map<String, InstalledGame> = graph.library.all().associateBy { it.id }

    fun reloadInstalled() { _installed.value = readInstalled() }

    fun statusOf(entry: CatalogEntry): GameStatus {
        val have = _installed.value[entry.id] ?: return GameStatus.NOT_INSTALLED
        return if (!have.builtin && compareVersions(entry.version, have.manifest.version) > 0) GameStatus.UPDATE else GameStatus.INSTALLED
    }

    fun refresh() {
        if (_loading.value) return
        viewModelScope.launch {
            _loading.value = true
            try {
                _catalog.value = graph.storeClient.fetch(graph.settings.value.storeUrl)
                _offline.value = false
            } catch (e: InstallException) {
                _offline.value = true
                _messages.tryEmit(StoreMessage.CatalogError(e.detail))
            } finally { _loading.value = false }
        }
    }

    fun install(entry: CatalogEntry) {
        if (_progress.value.containsKey(entry.id)) return
        viewModelScope.launch { doInstall(entry) }
    }

    private suspend fun doInstall(entry: CatalogEntry): Boolean {
        _progress.update { it + (entry.id to 0f) }
        return try {
            gate.withPermit {
                graph.installer.installEntry(entry, graph.settings.value.storeUrl) { p -> _progress.update { it + (entry.id to p) } }
            }
            reloadInstalled()
            _messages.tryEmit(StoreMessage.Installed(entry.name))
            true
        } catch (e: InstallException) {
            _messages.tryEmit(StoreMessage.Failed(e)); false
        } finally { _progress.update { it - entry.id } }
    }

    /** One tap: installs every game that is missing and updates every outdated one. */
    fun installAll() {
        val todo = (_catalog.value?.games ?: return).filter { statusOf(it) != GameStatus.INSTALLED && !_progress.value.containsKey(it.id) }
        if (todo.isEmpty()) return
        viewModelScope.launch {
            val jobs = todo.map { e -> viewModelScope.launch { doInstall(e) } }
            jobs.forEach { it.join() }
            _messages.tryEmit(StoreMessage.AllDone(todo.size))
        }
    }

    fun pendingCount(): Int = _catalog.value?.games?.count { statusOf(it) != GameStatus.INSTALLED } ?: 0

    fun uninstall(id: String) {
        val name = _installed.value[id]?.manifest?.name ?: id
        graph.installer.uninstall(id)
        reloadInstalled()
        _messages.tryEmit(StoreMessage.Removed(name))
    }
}
