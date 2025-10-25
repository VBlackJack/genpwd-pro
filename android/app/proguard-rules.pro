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

#===============================================================================
# HILT / DAGGER
#===============================================================================
-dontwarn com.google.errorprone.annotations.**

# Keep Hilt generated classes
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }
-keep class * extends dagger.hilt.android.internal.managers.ViewComponentManager$FragmentContextWrapper { *; }

# Keep Hilt entry points
-keep @dagger.hilt.android.HiltAndroidApp class * { *; }
-keep @dagger.hilt.InstallIn class * { *; }

#===============================================================================
# ROOM DATABASE
#===============================================================================
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-dontwarn androidx.room.paging.**

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
