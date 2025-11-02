package com.julien.genpwdpro.presentation.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

/**
 * Palette de couleurs pour le thème sombre
 */
private val DarkColorScheme = darkColorScheme(
    primary = PrimaryCyan,
    secondary = SecondaryGrayBlue,
    tertiary = TertiaryGreen,
    background = BackgroundDark,
    surface = SurfaceDark,
    surfaceVariant = SurfaceVariantDark,
    error = ErrorRed,
    onPrimary = Color.White,
    onSecondary = Color.White,
    onTertiary = Color.White,
    onBackground = TextPrimaryDark,
    onSurface = TextPrimaryDark,
    onSurfaceVariant = TextSecondaryDark,
    onError = Color.White
)

/**
 * Palette de couleurs pour le thème clair
 */
private val LightColorScheme = lightColorScheme(
    primary = PrimaryCyanDark,
    secondary = SecondaryGrayBlue,
    tertiary = TertiaryGreen,
    background = BackgroundLight,
    surface = SurfaceLight,
    surfaceVariant = SurfaceVariantLight,
    error = ErrorRed,
    onPrimary = Color.White,
    onSecondary = Color.White,
    onTertiary = Color.White,
    onBackground = TextPrimaryLight,
    onSurface = TextPrimaryLight,
    onSurfaceVariant = TextSecondaryLight,
    onError = Color.White
)

/**
 * Thème de l'application GenPwd Pro
 *
 * # Fonctionnalités
 *
 * ## Thèmes clair et sombre
 * - Suit automatiquement le thème système par défaut
 * - Transitions fluides entre les modes
 * - Palettes de couleurs optimisées pour l'accessibilité (WCAG AA)
 *
 * ## Material You - Couleurs dynamiques (Android 12+)
 * - **Activé par défaut** sur les appareils Android 12+ (API 31+)
 * - Extrait automatiquement les couleurs du fond d'écran de l'utilisateur
 * - Crée une palette harmonieuse qui s'adapte aux préférences visuelles
 * - Fallback automatique vers la palette personnalisée sur Android 11 et antérieur
 * - Utilise `dynamicDarkColorScheme()` et `dynamicLightColorScheme()` de Material3
 *
 * ## Comment ça marche
 * Material You analyse le fond d'écran de l'utilisateur et génère une palette
 * de couleurs cohérente qui s'applique à toute l'application. Cela crée une
 * expérience visuelle personnalisée et harmonieuse avec le reste du système.
 *
 * Sur Android 11 et antérieur, l'application utilise les couleurs personnalisées
 * définies dans Color.kt (cyan, gray-blue, green).
 *
 * @param darkTheme Force le thème sombre (par défaut: suit le système avec isSystemInDarkTheme())
 * @param dynamicColor Active Material You dynamic colors sur Android 12+ (activé par défaut)
 *                     Passez `false` pour forcer l'utilisation de la palette personnalisée
 * @param content Le contenu de l'application
 *
 * @see dynamicDarkColorScheme Documentation Material3 pour couleurs dynamiques
 * @see dynamicLightColorScheme Documentation Material3 pour couleurs dynamiques
 */
@Composable
fun GenPwdProTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true, // Material You activé par défaut
    content: @Composable () -> Unit
) {
    val context = LocalContext.current

    // Utiliser dynamic colors sur Android 12+ (API 31+) si activé
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            if (darkTheme) {
                dynamicDarkColorScheme(context)
            } else {
                dynamicLightColorScheme(context)
            }
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
