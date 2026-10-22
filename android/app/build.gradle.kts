import org.gradle.api.file.FileSystemOperations
import javax.inject.Inject

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

/** Copies the shared web content (SDK, console home screen, built-in games) into the APK's assets/web. */
abstract class StageWebTask : DefaultTask() {
    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val webDir: DirectoryProperty

    @get:OutputDirectory
    abstract val outDir: DirectoryProperty

    @get:Inject
    abstract val fs: FileSystemOperations

    @TaskAction
    fun stage() {
        fs.sync {
            from(webDir) {
                include("sdk/**", "shell/**", "emulators/**", "games/builtin/**")
                exclude("**/.DS_Store")
            }
            into(outDir.dir("web"))
        }
    }
}

val versionNumber = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toIntOrNull() ?: 1

// Where the Game Store catalog lives. Override for preview builds: ./gradlew assembleRelease -PstoreUrl=https://.../catalog.json
val storeUrl = (project.findProperty("storeUrl") as String?)?.takeIf { it.startsWith("https://") }
    ?: "https://raw.githubusercontent.com/Aminethalaa/old_games/main/store/catalog.json"

android {
    namespace = "com.retroconsole.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.retroconsole.app"
        minSdk = 24
        targetSdk = 35
        versionCode = versionNumber
        versionName = "1.0.$versionNumber"
        vectorDrawables.useSupportLibrary = true
        buildConfigField("String", "DEFAULT_STORE_URL", "\"$storeUrl\"")
    }

    signingConfigs {
        val ks = System.getenv("RETRO_KEYSTORE")
        if (!ks.isNullOrBlank()) {
            create("release") {
                storeFile = file(ks)
                storePassword = System.getenv("RETRO_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("RETRO_KEY_ALIAS")
                keyPassword = System.getenv("RETRO_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Without a configured keystore the release APK is signed with the debug key so it is still installable.
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }

    testOptions {
        unitTests {
            isIncludeAndroidResources = true
            isReturnDefaultValues = true
        }
    }
    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}

androidComponents {
    onVariants { variant ->
        val stage = tasks.register<StageWebTask>("stageWeb${variant.name.replaceFirstChar { it.uppercase() }}") {
            webDir.set(rootProject.layout.projectDirectory.dir("../web"))
            outDir.set(layout.buildDirectory.dir("generated/webAssets/${variant.name}"))
        }
        variant.sources.assets?.addGeneratedSourceDirectory(stage, StageWebTask::outDir)
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.work.runtime.ktx)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.foundation)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.okhttp)
    implementation(libs.zxing.embedded)

    testImplementation(libs.junit)
    testImplementation(libs.robolectric)
    testImplementation(platform(libs.compose.bom))
    testImplementation(libs.compose.ui.test.junit4)
    debugImplementation(libs.compose.ui.test.manifest)
}

// Robolectric reads the bundled web content from the merged assets, so make sure they exist before unit tests run.
tasks.matching { it.name == "testDebugUnitTest" || it.name == "testReleaseUnitTest" }.configureEach {
    dependsOn(if (name.contains("Release")) "mergeReleaseAssets" else "mergeDebugAssets")
}
