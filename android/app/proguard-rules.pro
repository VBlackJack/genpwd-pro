# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

#===============================================================================
# OPTIMIZATION SETTINGS
#===============================================================================
# Enable aggressive optimization
-optimizationpasses 5
-dontusemixedcaseclassnames
-verbose

# Allow R8 to optimize and inline
-allowaccessmodification
-mergeinterfacesaggressively

#===============================================================================
# GENP WD PRO - SELECTIVE KEEP RULES
#===============================================================================
# Only keep what's absolutely necessary

# Ensure runtime annotations/generic signatures are preserved for reflection and DI
-keepattributes *Annotation*,Signature

# Keep data models for JSON serialization
-keep class com.julien.genpwdpro.data.models.** { *; }
-keep class com.julien.genpwdpro.data.local.entity.** { *; }

# Keep ViewModels (accessed by Hilt)
-keep class * extends androidx.lifecycle.ViewModel {
    public <init>(...);
}
-keepnames @dagger.hilt.android.lifecycle.HiltViewModel class *

# Keep Application class
-keep class com.julien.genpwdpro.GenPwdProApplication { *; }

# Keep MainActivity (entry point)
-keep class com.julien.genpwdpro.presentation.MainActivity { *; }

# Keep Widget Provider (registered in manifest)
-keep class com.julien.genpwdpro.presentation.widget.PasswordWidget { *; }

# Allow shrinking of generators, use cases, and utilities
# (They are private implementation details)
-assumenosideeffects class com.julien.genpwdpro.domain.generators.**
-assumenosideeffects class com.julien.genpwdpro.domain.usecases.**

#===============================================================================
# GSON
#===============================================================================
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod

# Keep Gson TypeAdapters
-keep class * implements com.google.gson.TypeAdapter
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# Prevent stripping of generic signatures
-keepattributes Signature

# TODO: Enable when kotlinx.serialization is adopted
#-keep class kotlinx.serialization.** { *; }
#-keepclassmembers class * { @kotlinx.serialization.SerialName <fields>; }

#===============================================================================
# HILT / DAGGER
#===============================================================================
-dontwarn com.google.errorprone.annotations.**
-dontwarn dagger.**
-dontwarn javax.inject.**

# Keep Hilt generated classes
-keep class dagger.** { *; }
-keep interface dagger.** { *; }
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }
-keep class * extends dagger.hilt.android.internal.managers.ViewComponentManager$FragmentContextWrapper { *; }

# Keep Hilt entry points
-keep @dagger.hilt.android.HiltAndroidApp class * { *; }
-keep @dagger.hilt.InstallIn class * { *; }

#===============================================================================
# ROOM DATABASE
#===============================================================================
-keep class androidx.room.** { *; }
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-dontwarn androidx.room.paging.**
-dontwarn androidx.room.**
-keep class androidx.sqlite.db.SupportSQLiteOpenHelper$Callback { *; }
-keep class androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory { *; }

#==============================================================================
# WORKMANAGER
#==============================================================================
-keep class androidx.work.Configuration { *; }
-keep class androidx.work.WorkerParameters { *; }
-keep class androidx.work.ListenableWorker { *; }
-keep class androidx.work.impl.foreground.SystemForegroundService { *; }
-keep class androidx.hilt.work.HiltWorkerFactory { *; }
-keep class com.julien.genpwdpro.workers.** { *; }
-dontwarn androidx.work.**

#==============================================================================
# SQLCIPHER
#==============================================================================
-keep class net.sqlcipher.** { *; }
-dontwarn net.sqlcipher.**

#==============================================================================
# AUTOFILL SERVICE
#==============================================================================
-keep class com.julien.genpwdpro.autofill.GenPwdAutofillService { *; }
-keep class com.julien.genpwdpro.autofill.** { *; }

#===============================================================================
# KOTLIN
#===============================================================================
-keep class kotlin.** { *; }
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.**
-keepclassmembers class **$WhenMappings {
    <fields>;
}
-keepclassmembers class kotlin.Metadata {
    public <methods>;
}
-assumenosideeffects class kotlin.jvm.internal.Intrinsics {
    public static void checkNotNull(java.lang.Object);
    public static void checkNotNull(java.lang.Object, java.lang.String);
    public static void checkParameterIsNotNull(java.lang.Object, java.lang.String);
}

#===============================================================================
# COROUTINES
#===============================================================================
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.coroutines.** {
    volatile <fields>;
}

#===============================================================================
# COMPOSE
#===============================================================================
-keep class androidx.compose.** { *; }
-dontwarn androidx.compose.**

# Keep Compose stable classes
-keep class androidx.compose.runtime.** { *; }
-keep class androidx.compose.ui.** { *; }
-keep interface androidx.compose.runtime.Composer
-keepclassmembers class androidx.compose.runtime.** {
    public <methods>;
}

# Keep @Composable functions (reflection)
-keepclasseswithmembers class * {
    @androidx.compose.runtime.Composable <methods>;
}

#===============================================================================
# REMOVE LOGGING IN RELEASE
#===============================================================================
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
    public static *** w(...);
    public static *** e(...);
}
-assumenosideeffects class okhttp3.logging.HttpLoggingInterceptor$Logger {
    public void log(java.lang.String);
}
-assumenosideeffects class okhttp3.logging.HttpLoggingInterceptor {
    public okhttp3.logging.HttpLoggingInterceptor setLevel(okhttp3.logging.HttpLoggingInterceptor$Level);
}

#===============================================================================
# ENCRYPTED SHARED PREFS
#===============================================================================
-keep class androidx.security.crypto.** { *; }
-dontwarn androidx.security.crypto.**

#===============================================================================
# GENERAL ANDROID
#===============================================================================
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep custom views
-keep public class * extends android.view.View {
    public <init>(android.content.Context);
    public <init>(android.content.Context, android.util.AttributeSet);
    public <init>(android.content.Context, android.util.AttributeSet, int);
    public void set*(...);
}

# Keep Parcelables
-keepclassmembers class * implements android.os.Parcelable {
    public static final ** CREATOR;
}

# Keep enums
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

#===============================================================================
# APACHE HTTP CLIENT (Google Drive API dependency)
#===============================================================================
# Ignore missing javax.naming classes (not available on Android)
-dontwarn javax.naming.**
-dontwarn org.ietf.jgss.**
-dontwarn org.apache.http.**
