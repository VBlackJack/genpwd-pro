package com.julien.genpwdpro.presentation.theme

import android.content.Context
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Gestionnaire de thèmes avancé
 * Supporte les thèmes personnalisés, Material You, et les préférences utilisateur
 */

/**
 * Modes de thème disponibles
 */
enum class ThemeMode {
    SYSTEM,     // Suit le système
    LIGHT,      // Toujours clair
    DARK,       // Toujours sombre
    AUTO        // Automatique selon l'heure
}

/**
 * Thèmes prédéfinis
 */
enum class ThemePreset {
    DEFAULT,        // Cyan/Gray-Blue/Green (actuel)
    OCEAN,          // Bleu océan
    FOREST,         // Vert forêt
    SUNSET,         // Orange/Rouge
    LAVENDER,       // Violet/Lavande
    MONOCHROME,     // Noir et blanc
    CYBERPUNK,      // Néon cyan/magenta
    NORD,           // Nord theme
    DRACULA,        // Dracula theme
    CUSTOM          // Personnalisé par l'utilisateur
}

/**
 * Configuration de thème personnalisé
 */
data class CustomTheme(
    val name: String,
    val lightColors: ColorScheme,
    val darkColors: ColorScheme
)

/**
 * Préférences de thème
 */
data class ThemePreferences(
    val mode: ThemeMode = ThemeMode.SYSTEM,
    val preset: ThemePreset = ThemePreset.DEFAULT,
    val useMaterialYou: Boolean = true,
    val useHighContrast: Boolean = false,
    val customPrimaryLight: String? = null,
    val customPrimaryDark: String? = null
)

private val Context.themeDataStore by preferencesDataStore(name = "theme_preferences")

/**
 * Gestionnaire de thèmes avec persistance
 */
@Singleton
class ThemeManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val THEME_MODE_KEY = stringPreferencesKey("theme_mode")
    private val THEME_PRESET_KEY = stringPreferencesKey("theme_preset")
    private val USE_MATERIAL_YOU_KEY = stringPreferencesKey("use_material_you")
    private val USE_HIGH_CONTRAST_KEY = stringPreferencesKey("use_high_contrast")

    /**
     * Flow des préférences de thème
     */
    val themePreferences: Flow<ThemePreferences> = context.themeDataStore.data.map { prefs ->
        ThemePreferences(
            mode = try {
                ThemeMode.valueOf(prefs[THEME_MODE_KEY] ?: ThemeMode.SYSTEM.name)
            } catch (e: Exception) {
                ThemeMode.SYSTEM
            },
            preset = try {
                ThemePreset.valueOf(prefs[THEME_PRESET_KEY] ?: ThemePreset.DEFAULT.name)
            } catch (e: Exception) {
                ThemePreset.DEFAULT
            },
            useMaterialYou = prefs[USE_MATERIAL_YOU_KEY]?.toBoolean() ?: true,
            useHighContrast = prefs[USE_HIGH_CONTRAST_KEY]?.toBoolean() ?: false
        )
    }

    /**
     * Met à jour le mode de thème
     */
    suspend fun setThemeMode(mode: ThemeMode) {
        context.themeDataStore.edit { prefs ->
            prefs[THEME_MODE_KEY] = mode.name
        }
    }

    /**
     * Met à jour le preset de thème
     */
    suspend fun setThemePreset(preset: ThemePreset) {
        context.themeDataStore.edit { prefs ->
            prefs[THEME_PRESET_KEY] = preset.name
        }
    }

    /**
     * Active/désactive Material You
     */
    suspend fun setMaterialYou(enabled: Boolean) {
        context.themeDataStore.edit { prefs ->
            prefs[USE_MATERIAL_YOU_KEY] = enabled.toString()
        }
    }

    /**
     * Active/désactive le contraste élevé
     */
    suspend fun setHighContrast(enabled: Boolean) {
        context.themeDataStore.edit { prefs ->
            prefs[USE_HIGH_CONTRAST_KEY] = enabled.toString()
        }
    }

    /**
     * Obtient le ColorScheme pour un preset donné
     */
    fun getColorScheme(preset: ThemePreset, isDark: Boolean): ColorScheme {
        return when (preset) {
            ThemePreset.DEFAULT -> if (isDark) defaultDarkColors else defaultLightColors
            ThemePreset.OCEAN -> if (isDark) oceanDarkColors else oceanLightColors
            ThemePreset.FOREST -> if (isDark) forestDarkColors else forestLightColors
            ThemePreset.SUNSET -> if (isDark) sunsetDarkColors else sunsetLightColors
            ThemePreset.LAVENDER -> if (isDark) lavenderDarkColors else lavenderLightColors
            ThemePreset.MONOCHROME -> if (isDark) monochromeDarkColors else monochromeLightColors
            ThemePreset.CYBERPUNK -> if (isDark) cyberpunkDarkColors else cyberpunkLightColors
            ThemePreset.NORD -> if (isDark) nordDarkColors else nordLightColors
            ThemePreset.DRACULA -> if (isDark) draculaDarkColors else draculaLightColors
            ThemePreset.CUSTOM -> if (isDark) defaultDarkColors else defaultLightColors
        }
    }
}

/**
 * Thèmes prédéfinis - DEFAULT (actuel)
 */
private val defaultLightColors = lightColorScheme(
    primary = PrimaryCyanDark,
    secondary = SecondaryGrayBlue,
    tertiary = TertiaryGreen,
    background = BackgroundLight,
    surface = SurfaceLight,
    error = ErrorRed
)

private val defaultDarkColors = darkColorScheme(
    primary = PrimaryCyan,
    secondary = SecondaryGrayBlue,
    tertiary = TertiaryGreen,
    background = BackgroundDark,
    surface = SurfaceDark,
    error = ErrorRed
)

/**
 * Thème OCEAN (bleu océan)
 */
private val oceanLightColors = lightColorScheme(
    primary = Color(0xFF0077BE),
    secondary = Color(0xFF00B4D8),
    tertiary = Color(0xFF90E0EF),
    background = Color(0xFFF8F9FA),
    surface = Color(0xFFFFFFFF),
    error = Color(0xFFBA1A1A)
)

private val oceanDarkColors = darkColorScheme(
    primary = Color(0xFF48CAE4),
    secondary = Color(0xFF00B4D8),
    tertiary = Color(0xFF90E0EF),
    background = Color(0xFF001219),
    surface = Color(0xFF003249),
    error = Color(0xFFFF6B6B)
)

/**
 * Thème FOREST (vert forêt)
 */
private val forestLightColors = lightColorScheme(
    primary = Color(0xFF2D6A4F),
    secondary = Color(0xFF52B788),
    tertiary = Color(0xFF95D5B2),
    background = Color(0xFFF8FAF9),
    surface = Color(0xFFFFFFFF),
    error = Color(0xFFBA1A1A)
)

private val forestDarkColors = darkColorScheme(
    primary = Color(0xFF74C69D),
    secondary = Color(0xFF52B788),
    tertiary = Color(0xFF95D5B2),
    background = Color(0xFF081C15),
    surface = Color(0xFF1B4332),
    error = Color(0xFFFF6B6B)
)

/**
 * Thème SUNSET (orange/rouge)
 */
private val sunsetLightColors = lightColorScheme(
    primary = Color(0xFFD62828),
    secondary = Color(0xFFF77F00),
    tertiary = Color(0xFFFCAB10),
    background = Color(0xFFFAF9F6),
    surface = Color(0xFFFFFFFF),
    error = Color(0xFFBA1A1A)
)

private val sunsetDarkColors = darkColorScheme(
    primary = Color(0xFFFF6B6B),
    secondary = Color(0xFFF77F00),
    tertiary = Color(0xFFFCAB10),
    background = Color(0xFF1A0E0E),
    surface = Color(0xFF2D1B1B),
    error = Color(0xFFFFB4AB)
)

/**
 * Thème LAVENDER (violet/lavande)
 */
private val lavenderLightColors = lightColorScheme(
    primary = Color(0xFF7209B7),
    secondary = Color(0xFFB5179E),
    tertiary = Color(0xFFF72585),
    background = Color(0xFFFAF8FC),
    surface = Color(0xFFFFFFFF),
    error = Color(0xFFBA1A1A)
)

private val lavenderDarkColors = darkColorScheme(
    primary = Color(0xFFBF5EDB),
    secondary = Color(0xFFE0AAFF),
    tertiary = Color(0xFFF72585),
    background = Color(0xFF10002B),
    surface = Color(0xFF240046),
    error = Color(0xFFFF6B6B)
)

/**
 * Thème MONOCHROME (noir et blanc)
 */
private val monochromeLightColors = lightColorScheme(
    primary = Color(0xFF000000),
    secondary = Color(0xFF424242),
    tertiary = Color(0xFF757575),
    background = Color(0xFFFFFFFF),
    surface = Color(0xFFF5F5F5),
    error = Color(0xFF212121)
)

private val monochromeDarkColors = darkColorScheme(
    primary = Color(0xFFFFFFFF),
    secondary = Color(0xFFBDBDBD),
    tertiary = Color(0xFF9E9E9E),
    background = Color(0xFF000000),
    surface = Color(0xFF121212),
    error = Color(0xFFE0E0E0)
)

/**
 * Thème CYBERPUNK (néon cyan/magenta)
 */
private val cyberpunkLightColors = lightColorScheme(
    primary = Color(0xFF00F5FF),
    secondary = Color(0xFFFF006E),
    tertiary = Color(0xFFFFBE0B),
    background = Color(0xFFF0F0F0),
    surface = Color(0xFFFFFFFF),
    error = Color(0xFFFF006E)
)

private val cyberpunkDarkColors = darkColorScheme(
    primary = Color(0xFF00F5FF),
    secondary = Color(0xFFFF006E),
    tertiary = Color(0xFFFFBE0B),
    background = Color(0xFF0A0E27),
    surface = Color(0xFF1A1F3A),
    error = Color(0xFFFF006E)
)

/**
 * Thème NORD
 */
private val nordLightColors = lightColorScheme(
    primary = Color(0xFF5E81AC),
    secondary = Color(0xFF81A1C1),
    tertiary = Color(0xFF88C0D0),
    background = Color(0xFFECEFF4),
    surface = Color(0xFFE5E9F0),
    error = Color(0xFFBF616A)
)

private val nordDarkColors = darkColorScheme(
    primary = Color(0xFF88C0D0),
    secondary = Color(0xFF81A1C1),
    tertiary = Color(0xFF5E81AC),
    background = Color(0xFF2E3440),
    surface = Color(0xFF3B4252),
    error = Color(0xFFBF616A)
)

/**
 * Thème DRACULA
 */
private val draculaLightColors = lightColorScheme(
    primary = Color(0xFFBD93F9),
    secondary = Color(0xFFFF79C6),
    tertiary = Color(0xFF8BE9FD),
    background = Color(0xFFF8F8F2),
    surface = Color(0xFFFFFFFF),
    error = Color(0xFFFF5555)
)

private val draculaDarkColors = darkColorScheme(
    primary = Color(0xFFBD93F9),
    secondary = Color(0xFFFF79C6),
    tertiary = Color(0xFF8BE9FD),
    background = Color(0xFF282A36),
    surface = Color(0xFF44475A),
    error = Color(0xFFFF5555)
)

/**
 * Composable pour appliquer le thème avec les préférences
 */
@Composable
fun EnhancedTheme(
    themePreferences: ThemePreferences,
    content: @Composable () -> Unit
) {
    val systemInDarkTheme = isSystemInDarkTheme()

    val isDarkTheme = when (themePreferences.mode) {
        ThemeMode.SYSTEM -> systemInDarkTheme
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
        ThemeMode.AUTO -> {
            // TODO: Implémenter la détection automatique selon l'heure
            systemInDarkTheme
        }
    }

    // Si Material You est activé et disponible, l'utiliser
    // Sinon, utiliser le preset sélectionné
    GenPwdProTheme(
        darkTheme = isDarkTheme,
        dynamicColor = themePreferences.useMaterialYou,
        content = content
    )
}
