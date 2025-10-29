val androidSdkFromEnv = System.getenv("ANDROID_SDK_ROOT") ?: System.getenv("ANDROID_HOME")
if (!androidSdkFromEnv.isNullOrBlank()) {
    System.setProperty("sdk.dir", androidSdkFromEnv)
}

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "GenPwd Pro"
include(":app")
include(":baselineprofile")
