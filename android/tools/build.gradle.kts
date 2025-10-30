import org.gradle.api.GradleException
import java.io.File
import java.util.Properties

plugins {
    base
}

tasks.register("doctor") {
    group = "verification"
    description = "Validates that the Android SDK used by the build contains the required components."

    doLast {
        val envSdkRoot = System.getenv("ANDROID_SDK_ROOT")?.takeIf { it.isNotBlank() }
        val envAndroidHome = System.getenv("ANDROID_HOME")?.takeIf { it.isNotBlank() }
        val localPropertiesFile = project.rootProject.file("local.properties")
        val sdkDirFromLocalProperties = if (localPropertiesFile.exists()) {
            Properties().apply {
                localPropertiesFile.inputStream().use { load(it) }
            }["sdk.dir"]?.toString()?.takeIf { it.isNotBlank() }
        } else {
            null
        }
        val sdkDirFromProperties = sdkDirFromLocalProperties
            ?: providers.gradleProperty("sdk.dir").orNull
            ?: providers.systemProperty("sdk.dir").orNull
            ?: envSdkRoot
            ?: envAndroidHome

        println("sdk.dir = ${sdkDirFromProperties ?: "<not set>"}")
        println("ANDROID_SDK_ROOT = ${envSdkRoot ?: "<not set>"}")
        println("ANDROID_HOME = ${envAndroidHome ?: "<not set>"}")

        if (sdkDirFromProperties == null) {
            throw GradleException("Unable to determine sdk.dir. Set ANDROID_SDK_ROOT/ANDROID_HOME or create android/local.properties.")
        }

        val sdkDirCandidate = File(sdkDirFromProperties)
        val sdkDir = if (sdkDirCandidate.isAbsolute) {
            sdkDirCandidate
        } else {
            project.rootProject.projectDir.resolve(sdkDirCandidate.path)
        }
        if (!sdkDir.isDirectory) {
            throw GradleException("Android SDK directory '$sdkDirFromProperties' does not exist or is not a directory.")
        }

        val buildToolsDir = File(sdkDir, "build-tools")
        val buildTools = buildToolsDir.list()?.sorted() ?: emptyList()
        println("Build tools found = ${if (buildTools.isEmpty()) "<none>" else buildTools.joinToString(", ")}")

        val platformsDir = File(sdkDir, "platforms")
        val platforms = platformsDir.list()?.sorted() ?: emptyList()
        println("Platforms found = ${if (platforms.isEmpty()) "<none>" else platforms.joinToString(", ")}")

        val errors = mutableListOf<String>()

        if (!File(sdkDir, "platform-tools").exists()) {
            errors += "Required package platform-tools is missing."
        }

        val requiredBuildTools = listOf("34.0.0")
        requiredBuildTools.forEach { version ->
            if (version !in buildTools) {
                errors += "Required build-tools;$version is missing."
            }
        }

        val requiredPlatforms = listOf("android-35", "android-34")
        requiredPlatforms.forEach { api ->
            if (api !in platforms) {
                errors += "Required platforms;$api is missing."
            }
        }

        if (errors.isNotEmpty()) {
            println()
            errors.forEach { println("- $it") }
            throw GradleException("Android SDK is missing required components. See messages above.")
        }

        println()
        println("Android SDK doctor check completed successfully.")
    }
}
