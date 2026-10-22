# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class kotlinx.serialization.json.** { kotlinx.serialization.KSerializer serializer(...); }
-keep,includedescriptorclasses class com.retroconsole.app.**$$serializer { *; }
-keepclassmembers class com.retroconsole.app.** { *** Companion; }
-keepclasseswithmembers class com.retroconsole.app.** { kotlinx.serialization.KSerializer serializer(...); }
# JavaScript bridge used by the LCD WebView
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
-dontwarn org.slf4j.**
