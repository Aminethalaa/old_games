package com.retroconsole.app.console

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewFeature
import com.retroconsole.app.BuildConfig
import com.retroconsole.app.data.LcdHost
import java.io.ByteArrayInputStream
import java.io.File
import java.io.IOException

/** What the web side (SDK / home screen) can ask of the native shell. All callbacks arrive on the main thread. */
interface LcdBridgeListener {
    /** JSON handed to `RetroNative.getInit()` for the page that is loading (current game or home). */
    fun initJson(): String
    /** JSON handed to `RetroNative.getLibrary()` (home screen). */
    fun libraryJson(): String
    fun onMessage(type: String, payload: org.json.JSONObject)
}

/**
 * The console "screen": one WebView that shows the home menu or a game.
 * Everything it loads is served locally through [WebViewAssetLoader]; every other request is blocked
 * and a strict Content-Security-Policy is attached to all local documents.
 */
@SuppressLint("SetJavaScriptEnabled")
class LcdView(context: Context, private val listener: LcdBridgeListener) {
    private val main = Handler(Looper.getMainLooper())
    private var compatMode = false

    val webView: WebView = WebView(context)

    init {
        val loader = buildLoader(context)
        webView.apply {
            setBackgroundColor(Color.parseColor("#0B0E14"))
            overScrollMode = WebView.OVER_SCROLL_NEVER
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            isLongClickable = false
            setOnLongClickListener { true }
            isHapticFeedbackEnabled = false
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccess = false
                allowContentAccess = false
                mediaPlaybackRequiresUserGesture = false
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
                javaScriptCanOpenWindowsAutomatically = false
                setSupportMultipleWindows(false)
                cacheMode = WebSettings.LOAD_NO_CACHE
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                useWideViewPort = true
                loadWithOverviewMode = false
                // The SDK draws 5-7px pixel text; WebView's default 8px minimum font size would silently enlarge it.
                minimumFontSize = 1
                minimumLogicalFontSize = 1
                textZoom = 100
            }
            // Games choose their own colours: never let the system "dark mode" recolour the LCD.
            @Suppress("DEPRECATION")
            runCatching {
                when {
                    WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING) -> WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, false)
                    WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK) -> WebSettingsCompat.setForceDark(settings, WebSettingsCompat.FORCE_DARK_OFF)
                }
            }
            WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
            addJavascriptInterface(Bridge(), "RetroNative")
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                    return loader.shouldInterceptRequest(request.url) ?: blocked(request.url.host == LcdHost.DOMAIN)
                }

                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                    request.url.host != LcdHost.DOMAIN

                override fun onPageFinished(view: WebView, url: String?) {
                    if (compatMode) view.evaluateJavascript(COMPAT_JS, null)
                }

                override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                    main.post { listener.onMessage("render-gone", org.json.JSONObject()) }
                    return true
                }
            }
        }
    }

    /** @param selectId game id the menu cursor should start on (the game that was just played). */
    fun loadHome(boot: Boolean, selectId: String? = null) {
        compatMode = false
        val q = buildList {
            if (boot) add("boot=1")
            if (!selectId.isNullOrEmpty() && Regex("^[a-z0-9-]{1,41}$").matches(selectId)) add("last=$selectId")
        }
        webView.loadUrl("https://${LcdHost.DOMAIN}/shell/home.html" + if (q.isEmpty()) "" else "?" + q.joinToString("&"))
    }

    fun loadGame(url: String, compat: Boolean) {
        compatMode = compat
        webView.loadUrl(url)
    }

    fun blank() {
        compatMode = false
        webView.loadUrl("about:blank")
    }

    fun button(name: String, down: Boolean) {
        val js = if (compatMode) "window.__retroKey&&__retroKey('$name',$down)" else "window.Retro&&Retro._n.button('$name',$down)"
        webView.evaluateJavascript(js, null)
    }

    fun cmd(name: String, arg: Any? = null) {
        val a = when (arg) { null -> "null"; is String -> "'${arg.replace("'", "")}'"; else -> arg.toString() }
        webView.evaluateJavascript("window.Retro&&Retro._n.cmd('$name',$a)", null)
    }

    fun onResume() { webView.onResume() }
    fun onPause() { webView.onPause() }
    fun destroy() { webView.destroy() }

    private inner class Bridge {
        @JavascriptInterface fun getInit(): String = listener.initJson()
        @JavascriptInterface fun getLibrary(): String = listener.libraryJson()

        @JavascriptInterface
        fun postMessage(json: String) {
            if (json.length > 400_000) return
            val obj = try { org.json.JSONObject(json) } catch (e: Exception) { return }
            val type = obj.optString("type")
            if (type.isEmpty()) return
            main.post { listener.onMessage(type, obj) }
        }
    }

    companion object {
        private fun response(path: String, data: java.io.InputStream): WebResourceResponse {
            val mime = WebPaths.mimeOf(path)
            val headers = HashMap<String, String>()
            headers["Cache-Control"] = "no-cache"
            if (mime == "text/html") headers["Content-Security-Policy"] = WebPaths.CSP
            val textual = mime.startsWith("text/") || mime == "application/json" || mime == "text/javascript" || mime == "image/svg+xml"
            return WebResourceResponse(mime, if (textual) "utf-8" else null, 200, "OK", headers, data)
        }

        private fun blocked(local: Boolean): WebResourceResponse =
            WebResourceResponse("text/plain", "utf-8", if (local) 404 else 403, if (local) "Not Found" else "Blocked", emptyMap(), ByteArrayInputStream(ByteArray(0)))

        private class AssetsHandler(private val ctx: Context, private val base: String) : WebViewAssetLoader.PathHandler {
            override fun handle(path: String): WebResourceResponse? {
                val p = WebPaths.cleanPath(path) ?: return null
                return try { response(p, ctx.assets.open("$base/$p")) } catch (e: IOException) { null }
            }
        }

        private class FilesHandler(private val root: File) : WebViewAssetLoader.PathHandler {
            override fun handle(path: String): WebResourceResponse? {
                val p = WebPaths.cleanPath(path) ?: return null
                val f = File(root, p)
                return try {
                    val canon = f.canonicalFile
                    if (!canon.path.startsWith(root.canonicalPath + File.separator) || !canon.isFile) null
                    else response(p, canon.inputStream())
                } catch (e: IOException) { null }
            }
        }

        fun buildLoader(ctx: Context): WebViewAssetLoader =
            WebViewAssetLoader.Builder()
                .setDomain(LcdHost.DOMAIN)
                .addPathHandler("/sdk/", AssetsHandler(ctx, "web/sdk"))
                .addPathHandler("/shell/", AssetsHandler(ctx, "web/shell"))
                .addPathHandler("/builtin/", AssetsHandler(ctx, "web/games/builtin"))
                .addPathHandler("/installed/", FilesHandler(File(ctx.filesDir, "games")))
                .build()

        /** Turns console buttons into keyboard events for plain HTML5 games that do not use the Retro SDK. */
        private const val COMPAT_JS = """
(function(){
  if (window.__retroKey) return;
  var MAP = { up:['ArrowUp',38,'ArrowUp'], down:['ArrowDown',40,'ArrowDown'], left:['ArrowLeft',37,'ArrowLeft'], right:['ArrowRight',39,'ArrowRight'],
              a:[' ',32,'Space'], b:['x',88,'KeyX'], start:['Enter',13,'Enter'] };
  window.__retroKey = function(name, down){
    var m = MAP[name]; if(!m) return;
    var ev = new KeyboardEvent(down ? 'keydown':'keyup', {key:m[0], code:m[2], bubbles:true, cancelable:true});
    try { Object.defineProperty(ev,'keyCode',{get:function(){return m[1];}}); Object.defineProperty(ev,'which',{get:function(){return m[1];}}); } catch(e){}
    (document.activeElement || document.body).dispatchEvent(ev);
  };
})();
"""
    }
}
