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
include(":vault-domain")
include(":core-vault")
include(":storage")
include(":providers-api")
include(":sync-engine")
include(":provider-drive")
include(":provider-dropbox")
include(":provider-graph")
include(":provider-webdav")
include(":tools")
