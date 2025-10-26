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
 * Supporte :
 * - Thèmes clair et sombre avec transition fluide
 * - Material You dynamic colors sur Android 12+ (S)
 *
 * @param darkTheme Force le thème sombre (par défaut: suit le système)
 * @param dynamicColor Active les couleurs dynamiques Android 12+ (activé par défaut si disponible)
 * @param content Le contenu de l'application
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
