package com.retroconsole.app.store

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import com.retroconsole.app.data.GameLibrary
import com.retroconsole.app.data.InstalledGame
import com.retroconsole.app.data.ProgressStore
import java.io.File
import java.io.IOException
import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request

/** Downloads / imports game packages, verifies them and installs them into `filesDir/games/<id>`. */
class GameInstaller(
    private val context: Context,
    private val http: OkHttpClient,
    private val library: GameLibrary,
    private val progress: ProgressStore,
) {
    private val lock = Mutex()
    private val _changes = MutableStateFlow(0)
    /** Bumps after every install/uninstall so the console menu can reload. */
    val changes: StateFlow<Int> = _changes.asStateFlow()

    private val cacheDir get() = File(context.cacheDir, "downloads").apply { mkdirs() }

    /** Verified install from the store catalog (SHA-256 must match). */
    suspend fun installEntry(entry: CatalogEntry, catalogUrl: String, onProgress: (Float) -> Unit = {}): InstalledGame {
        val url = StoreClient.resolve(catalogUrl, entry.url)
        val file = File(cacheDir, "${entry.id}-${System.nanoTime()}.zip")
        try {
            val sha = download(url, file, GamePackage.MAX_ZIP_BYTES, onProgress)
            if (!sha.equals(entry.sha256, ignoreCase = true)) throw InstallException(InstallException.Code.CHECKSUM, sha)
            return finishZip(file, expectedId = entry.id, fallbackName = entry.name)
        } finally { file.delete() }
    }

    /** Unverified install from a direct link to a .zip / .html (the UI asks the user to confirm first). */
    suspend fun installFromUrl(url: String, onProgress: (Float) -> Unit = {}): InstalledGame {
        val name = url.toHttpUrlOrNull()?.pathSegments?.lastOrNull { it.isNotBlank() } ?: "imported-game"
        val file = File(cacheDir, "dl-${System.nanoTime()}.bin")
        try {
            download(url, file, GamePackage.MAX_ZIP_BYTES, onProgress)
            return finishAny(file, name)
        } finally { file.delete() }
    }

    /** Unverified install from a file the user picked (Storage Access Framework / "open with"). */
    suspend fun installFromUri(uri: Uri, onProgress: (Float) -> Unit = {}): InstalledGame = withContext(Dispatchers.IO) {
        val name = displayName(uri) ?: "imported-game"
        val file = File(cacheDir, "import-${System.nanoTime()}.bin")
        try {
            val input = context.contentResolver.openInputStream(uri) ?: throw InstallException(InstallException.Code.IO, "cannot open")
            input.use { src ->
                file.outputStream().use { out ->
                    val buf = ByteArray(32 * 1024)
                    var total = 0L
                    while (true) {
                        val n = src.read(buf)
                        if (n < 0) break
                        total += n
                        if (total > GamePackage.MAX_ZIP_BYTES) throw InstallException(InstallException.Code.TOO_LARGE)
                        out.write(buf, 0, n)
                    }
                }
            }
            onProgress(1f)
            finishAny(file, name)
        } finally { file.delete() }
    }

    /**
     * "Import my own game": a NES / Game Boy game file the user picked. Nothing is downloaded or bundled by the app;
     * the file is copied into app storage and shown as a new tile on the console menu.
     */
    suspend fun importRom(uri: Uri, onProgress: (Float) -> Unit = {}): InstalledGame = withContext(Dispatchers.IO) {
        val name = displayName(uri) ?: "game"
        val file = File(cacheDir, "rom-${System.nanoTime()}.bin")
        try {
            val input = context.contentResolver.openInputStream(uri) ?: throw InstallException(InstallException.Code.IO, "cannot open")
            input.use { src ->
                file.outputStream().use { out ->
                    val buf = ByteArray(64 * 1024)
                    var total = 0L
                    while (true) {
                        val n = src.read(buf)
                        if (n < 0) break
                        total += n
                        if (total > RomPackage.MAX_ROM_BYTES) throw InstallException(InstallException.Code.TOO_LARGE)
                        out.write(buf, 0, n)
                    }
                }
            }
            onProgress(0.6f)
            val kind = RomPackage.detect(file, name) ?: throw InstallException(InstallException.Code.UNSUPPORTED_GAME_FILE, name)
            val template = try {
                context.assets.open("web/emulators/${kind.coreDir}/rom-index.html").bufferedReader().use { it.readText() }
            } catch (e: IOException) { throw InstallException(InstallException.Code.IO, "emulator missing", e) }
            lock.withLock {
                val m = RomPackage.install(file, name, kind, library.gamesRoot, template)
                _changes.value = _changes.value + 1
                onProgress(1f)
                InstalledGame(m, builtin = false, installedAt = System.currentTimeMillis())
            }
        } finally { file.delete() }
    }

    fun uninstall(id: String) {
        if (id in library.builtinIds()) return
        File(library.gamesRoot, id).deleteRecursively()
        progress.forget(id)
        _changes.value = _changes.value + 1
    }

    private suspend fun finishAny(file: File, name: String): InstalledGame = withContext(Dispatchers.IO) {
        // "PK" magic. (InputStream.readNBytes needs API 33, so read the header by hand.)
        val head = ByteArray(4)
        val got = file.inputStream().use { it.read(head) }
        val isZip = got == 4 && head[0] == 'P'.code.toByte() && head[1] == 'K'.code.toByte()
        if (isZip) finishZip(file, expectedId = null, fallbackName = name)
        else lock.withLock {
            val m = GamePackage.installHtml(file, library.gamesRoot, library.builtinIds(), name)
            _changes.value = _changes.value + 1
            InstalledGame(m, builtin = false, installedAt = System.currentTimeMillis())
        }
    }

    private suspend fun finishZip(file: File, expectedId: String?, fallbackName: String): InstalledGame = withContext(Dispatchers.IO) {
        lock.withLock {
            val m = GamePackage.installZip(file, library.gamesRoot, library.builtinIds(), expectedId, fallbackName)
            _changes.value = _changes.value + 1
            InstalledGame(m, builtin = false, installedAt = System.currentTimeMillis())
        }
    }

    private suspend fun download(url: String, dest: File, maxBytes: Long, onProgress: (Float) -> Unit): String = withContext(Dispatchers.IO) {
        val httpUrl = url.toHttpUrlOrNull()
        if (httpUrl == null || !httpUrl.isHttps) throw InstallException(InstallException.Code.NETWORK, "https required")
        val digest = MessageDigest.getInstance("SHA-256")
        try {
            http.newCall(Request.Builder().url(httpUrl).build()).execute().use { resp ->
                if (!resp.isSuccessful) throw InstallException(InstallException.Code.NETWORK, "HTTP ${resp.code}")
                val body = resp.body ?: throw InstallException(InstallException.Code.NETWORK, "empty body")
                val length = body.contentLength()
                if (length > maxBytes) throw InstallException(InstallException.Code.TOO_LARGE, "$length")
                var read = 0L
                body.byteStream().use { input ->
                    dest.outputStream().use { out ->
                        val buf = ByteArray(32 * 1024)
                        while (true) {
                            val n = input.read(buf)
                            if (n < 0) break
                            read += n
                            if (read > maxBytes) throw InstallException(InstallException.Code.TOO_LARGE, "stream")
                            digest.update(buf, 0, n)
                            out.write(buf, 0, n)
                            if (length > 0) onProgress((read.toFloat() / length).coerceIn(0f, 1f))
                        }
                    }
                }
                onProgress(1f)
            }
        } catch (e: InstallException) { throw e } catch (e: IOException) {
            throw InstallException(InstallException.Code.NETWORK, e.message ?: "io", e)
        }
        digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun displayName(uri: Uri): String? = runCatching {
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        } ?: uri.lastPathSegment
    }.getOrNull()
}
