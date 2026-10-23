package com.retroconsole.app.console

import java.net.URLConnection

/** Pure helpers for serving local web content to the LCD WebView (unit-tested without Android). */
object WebPaths {
    private val MIME = mapOf(
        "html" to "text/html", "htm" to "text/html", "js" to "text/javascript", "mjs" to "text/javascript", "json" to "application/json",
        "css" to "text/css", "png" to "image/png", "jpg" to "image/jpeg", "jpeg" to "image/jpeg", "gif" to "image/gif", "webp" to "image/webp",
        "svg" to "image/svg+xml", "ico" to "image/x-icon", "ogg" to "audio/ogg", "mp3" to "audio/mpeg", "wav" to "audio/wav", "m4a" to "audio/mp4",
        "ttf" to "font/ttf", "otf" to "font/otf", "woff" to "font/woff", "woff2" to "font/woff2", "txt" to "text/plain", "md" to "text/plain", "wasm" to "application/wasm",
    )

    /** Games run offline in a sandbox: only same-origin resources, no frames/plugins/forms. */
    const val CSP = "default-src 'self' blob: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:; " +
        "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; " +
        "connect-src 'self' data: blob:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'"

    fun mimeOf(path: String): String {
        val ext = path.substringAfterLast('.', "").lowercase()
        return MIME[ext] ?: URLConnection.guessContentTypeFromName(path) ?: "application/octet-stream"
    }

    /** Normalises a request path; returns null for anything that tries to escape its folder. */
    fun cleanPath(path: String): String? {
        val p = path.trimStart('/').ifEmpty { "index.html" }
        if (p.contains("..") || p.contains('\\') || p.contains('\u0000')) return null
        return if (p.endsWith("/")) p + "index.html" else p
    }
}
