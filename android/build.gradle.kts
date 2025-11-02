import com.github.benmanes.gradle.versions.updates.DependencyUpdatesTask

// Top-level build file
buildscript {
    extra.apply {
        set("compose_version", "1.5.4")
        set("kotlin_version", "1.9.24")
        // Kotlin/Compose pairing per official matrix: https://developer.android.com/jetpack/compose/compiler#kotlin_compatibility
    }
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("com.android.tools.build:gradle:8.5.1")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.24")
        classpath("com.google.dagger:hilt-android-gradle-plugin:2.48")
    }
}

plugins {
    id("com.android.application") version "8.5.1" apply false
    id("com.android.library") version "8.5.1" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "1.9.24" apply false
    id("com.google.devtools.ksp") version "1.9.24-1.0.20" apply false
    id("com.google.dagger.hilt.android") version "2.48" apply false
    id("org.jlleitschuh.gradle.ktlint") version "11.6.1" apply false
    id("io.gitlab.arturbosch.detekt") version "1.23.4" apply false
    id("androidx.baselineprofile") version "1.3.0" apply false
    id("com.github.ben-manes.versions") version "0.49.0"
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

tasks.register("clean", Delete::class) {
    delete(rootProject.buildDir)
}

tasks.register("refreshBaselineProfile") {
    description = "Generates the baseline profile artifacts via the baselineprofile module."
    dependsOn(":baselineprofile:generateBaselineProfile")
}

tasks.register("check") {
    group = "verification"
    description = "Runs Android lint, Detekt, and ktlint checks across modules."
    dependsOn(
        ":app:lint",
        ":app:detekt",
        ":app:ktlintCheck",
        ":vault-domain:check"
    )
}

tasks.withType<DependencyUpdatesTask>().configureEach {
    checkForGradleUpdate = false
    outputFormatter = "json,plain"
    outputDir = "${project.buildDir}/reports/dependencyUpdates"
    reportfileName = "report"

    resolutionStrategy {
        componentSelection {
            all {
                val candidateVersion = candidate.version.lowercase()
                val rejectKeywords = listOf("alpha", "beta", "rc", "cr", "m", "preview", "snapshot", "dev")
                if (rejectKeywords.any { candidateVersion.contains(it) }) {
                    reject("Rejecting unstable candidate version")
                }
            }
        }
    }
}
