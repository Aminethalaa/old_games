package com.retroconsole.app.store

import com.retroconsole.app.data.AppJson
import com.retroconsole.app.data.PixelIcon
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request

/** One downloadable game in the store catalog (store/catalog.json, produced by tools/build_store.py). */
@Serializable
data class CatalogEntry(
    val id: String,
    val name: String,
    val short: String? = null,
    val version: String,
    val category: String = "arcade",
    val color: String = "#ffec27",
    val description: String = "",
    val author: String = "",
    val tags: List<String> = emptyList(),
    val icon: PixelIcon? = null,
    val size: Long = 0,
    val sha256: String,
    /** Absolute URL, or relative to the catalog URL. */
    val url: String,
    val sdk: Int = 1,
    val achievements: Int = 0,
)

@Serializable
data class Catalog(
    val schema: Int = 1,
    val name: String = "",
    val generated: String? = null,
    val games: List<CatalogEntry> = emptyList(),
)

class StoreClient(private val http: OkHttpClient, private val cacheFile: File) {

    fun cached(): Catalog? = runCatching {
        if (cacheFile.exists()) AppJson.decodeFromString<Catalog>(cacheFile.readText()) else null
    }.getOrNull()

    suspend fun fetch(url: String): Catalog = withContext(Dispatchers.IO) {
        val httpUrl = url.toHttpUrlOrNull()
        if (httpUrl == null || !httpUrl.isHttps) throw InstallException(InstallException.Code.NETWORK, "https required")
        val req = Request.Builder().url(httpUrl).header("Cache-Control", "no-cache").build()
        try {
            http.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) throw InstallException(InstallException.Code.NETWORK, "HTTP ${resp.code}")
                val text = resp.body?.string().orEmpty()
                val catalog = try { AppJson.decodeFromString<Catalog>(text) } catch (e: Exception) {
                    throw InstallException(InstallException.Code.NETWORK, "bad catalog: ${e.message}", e)
                }
                runCatching { cacheFile.parentFile?.mkdirs(); cacheFile.writeText(text) }
                catalog
            }
        } catch (e: InstallException) { throw e } catch (e: Exception) {
            throw InstallException(InstallException.Code.NETWORK, e.message ?: e.javaClass.simpleName, e)
        }
    }

    companion object {
        /** Resolves a (possibly relative) pack URL against the catalog URL. */
        fun resolve(catalogUrl: String, entryUrl: String): String =
            catalogUrl.toHttpUrlOrNull()?.resolve(entryUrl)?.toString() ?: entryUrl
    }
}
