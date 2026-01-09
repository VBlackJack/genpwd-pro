plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.devtools.ksp")
    id("com.google.dagger.hilt.android")
    id("kotlin-parcelize")
}

android {
    namespace = "com.julien.genpwdpro"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.julien.genpwdpro"
        minSdk = 24
        targetSdk = 34
        versionCode = 41
        versionName = "3.0.1"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        release {
            // TODO: Re-enable minification after R8 ConcurrentModificationException is resolved
            isMinifyEnabled = false
            isShrinkResources = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isDebuggable = true
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += listOf(
            "-opt-in=androidx.compose.material3.ExperimentalMaterial3Api",
            "-opt-in=androidx.compose.material.ExperimentalMaterialApi",
            "-opt-in=androidx.compose.animation.ExperimentalAnimationApi"
        )
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    // KDF Configuration constants
    defaultConfig.apply {
        buildConfigField("String", "DEFAULT_KDF_ALGORITHM", "\"SCRYPT\"")
        buildConfigField("int", "SCRYPT_COST", "32768") // 2^15, moderate security
        buildConfigField("int", "SCRYPT_BLOCK_SIZE", "8")
        buildConfigField("int", "SCRYPT_PARALLELIZATION", "1")
        buildConfigField("int", "SCRYPT_KEY_LENGTH", "32") // 256-bit key
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"  // Updated for Kotlin 1.9.24 compatibility + Strong Skipping mode
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
            excludes += "/META-INF/DEPENDENCIES"
            excludes += "/META-INF/LICENSE"
            excludes += "/META-INF/LICENSE.txt"
            excludes += "/META-INF/license.txt"
            excludes += "/META-INF/NOTICE"
            excludes += "/META-INF/NOTICE.txt"
            excludes += "/META-INF/notice.txt"
            excludes += "/META-INF/ASL2.0"
            // Exclude non-Android native libraries (macOS, Windows, Linux desktop)
            excludes += "lib/**/darwin/**"
            excludes += "lib/**/linux-x86_64/**"
            excludes += "lib/**/win32-x86_64/**"
        }
    }

    lint {
        // Use baseline to track existing issues without blocking builds
        baseline = file("lint-baseline.xml")

        // Disable problematic checks that are already handled
        disable += setOf(
            "NewApi",              // API level checks - many false positives with @RequiresApi
            "MissingTranslation",  // Allow missing translations for some languages
            "ExtraTranslation"     // Allow extra translations
        )

        // Don't abort build on errors (we're using baseline)
        abortOnError = false

        // Check all warnings
        checkAllWarnings = true

        // Show full report in console
        textReport = true
    }

    // Enable unit tests for Sprint S3 Release Candidate
    testOptions {
        unitTests {
            isIncludeAndroidResources = true
            isReturnDefaultValues = true
        }
    }

    // Configure APK output file names with version
    applicationVariants.all {
        outputs.all {
            val outputImpl = this as com.android.build.gradle.internal.api.BaseVariantOutputImpl
            val variantName = name
            val versionName = defaultConfig.versionName
            outputImpl.outputFileName = "genpwd-pro-v${versionName}-${variantName}.apk"
        }
    }
}

dependencies {
    // Core library desugaring for Java 8+ APIs on older Android versions
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.0.4")

    implementation(project(":core-vault"))
    implementation(project(":storage"))
    implementation(project(":providers-api"))
    implementation(project(":sync-engine"))
    implementation(project(":provider-drive"))
    implementation(project(":provider-dropbox"))
    implementation(project(":provider-graph"))
    implementation(project(":provider-webdav"))

    // Core Android
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.6.2")
    implementation("androidx.lifecycle:lifecycle-process:2.6.2")
    implementation("androidx.activity:activity-compose:1.8.1")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")

    // Compose
    implementation(platform("androidx.compose:compose-bom:2023.10.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3:1.3.1")
    implementation("androidx.compose.material3:material3-window-size-class:1.3.1")
    implementation("androidx.compose.material:material:1.5.4")
    implementation("androidx.compose.material:material-icons-extended:1.5.4")

    // Accompanist (Pager for onboarding)
    implementation("com.google.accompanist:accompanist-pager:0.32.0")
    implementation("com.google.accompanist:accompanist-pager-indicators:0.32.0")

    // ViewModel & Navigation
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.6.2")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.6.2")
    implementation("androidx.navigation:navigation-compose:2.7.5")

    // Hilt for DI
    implementation("com.google.dagger:hilt-android:2.48")
    ksp("com.google.dagger:hilt-android-compiler:2.48")
    implementation("androidx.hilt:hilt-navigation-compose:1.1.0")

    // Room Database
    implementation("androidx.room:room-runtime:2.6.0")
    implementation("androidx.room:room-ktx:2.6.0")
    ksp("androidx.room:room-compiler:2.6.0")

    // DataStore
    implementation("androidx.datastore:datastore-preferences:1.0.0")

    // WorkManager for background tasks (auto-lock in doze mode)
    implementation("androidx.work:work-runtime-ktx:2.9.0")
    implementation("androidx.hilt:hilt-work:1.1.0")
    ksp("androidx.hilt:hilt-compiler:1.1.0")

    // DocumentFile for Storage Access Framework (SAF)
    implementation("androidx.documentfile:documentfile:1.0.1")

    // Biometric Authentication
    implementation("androidx.biometric:biometric:1.1.0")

    // Credentials API for Passkeys/WebAuthn
    implementation("androidx.credentials:credentials:1.2.2")
    implementation("androidx.credentials:credentials-play-services-auth:1.2.2")

    // JSON parsing
    implementation("com.google.code.gson:gson:2.10.1")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")

    // Cryptography
    // Lazysodium for Argon2id (Android ARM compatible - replaces argon2-jvm)
    implementation("com.goterl:lazysodium-android:5.1.0@aar")
    implementation("net.java.dev.jna:jna:5.13.0@aar")
    implementation("commons-codec:commons-codec:1.16.0") // Base32 for TOTP

    // Tink Crypto for AES-GCM
    implementation("com.google.crypto.tink:tink-android:1.12.0")

    // SQLCipher for encrypted Room database
    implementation("net.zetetic:android-database-sqlcipher:4.5.4")

    // Scrypt KDF
    implementation("com.lambdaworks:scrypt:1.4.0")

    // Google Drive API for Cloud Sync
    implementation("com.google.android.gms:play-services-auth:20.7.0")
    implementation("com.google.apis:google-api-services-drive:v3-rev20230520-2.0.0")
    implementation("com.google.http-client:google-http-client-android:1.43.3")
    implementation("com.google.api-client:google-api-client-android:2.2.0")

    // WorkManager for Auto-Sync
    implementation("androidx.work:work-runtime-ktx:2.9.0")
    implementation("androidx.hilt:hilt-work:1.1.0")
    ksp("androidx.hilt:hilt-compiler:1.1.0")

    // Encrypted SharedPreferences for secure credential storage
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // OkHttp for HTTP/REST APIs (WebDAV, pCloud, ProtonDrive)
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // Retrofit for REST APIs (pCloud, ProtonDrive)
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")

    // Optional: Microsoft Graph SDK for OneDrive (requires Azure app config)
    // implementation("com.microsoft.graph:microsoft-graph:5.+")
    // implementation("com.microsoft.identity.client:msal:4.+")

    // CameraX for QR scanning
    implementation("androidx.camera:camera-camera2:1.3.1")
    implementation("androidx.camera:camera-lifecycle:1.3.1")
    implementation("androidx.camera:camera-view:1.3.1")

    // ML Kit Barcode Scanning
    implementation("com.google.mlkit:barcode-scanning:17.2.0")

    // KeePass KDBX support
    implementation("org.bouncycastle:bcprov-jdk15on:1.70")

    // Testing
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlin:kotlin-test:1.9.20")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3")
    testImplementation("io.mockk:mockk:1.13.8")

    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
    androidTestImplementation(platform("androidx.compose:compose-bom:2023.10.01"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
