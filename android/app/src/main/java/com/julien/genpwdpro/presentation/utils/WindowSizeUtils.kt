package com.julien.genpwdpro.presentation.utils

import androidx.compose.material3.windowsizeclass.WindowWidthSizeClass
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Utilitaires pour gérer les différentes tailles d'écran
 * et créer des layouts responsives pour tablettes
 */

/**
 * Classe d'aide pour déterminer le type d'appareil
 */
enum class DeviceType {
    PHONE, // < 600dp
    TABLET, // 600-840dp
    LARGE_TABLET // > 840dp
}

/**
 * Orientation de l'appareil
 */
enum class DeviceOrientation {
    PORTRAIT,
    LANDSCAPE
}

/**
 * Configuration responsive de l'écran
 */
data class ScreenConfig(
    val deviceType: DeviceType,
    val orientation: DeviceOrientation,
    val screenWidthDp: Dp,
    val screenHeightDp: Dp,
    val isCompact: Boolean,
    val isTablet: Boolean,
    val columnCount: Int
) {
    /**
     * Determine si on doit utiliser un layout 2-colonnes
     */
    val useTwoColumnLayout: Boolean
        get() = isTablet && orientation == DeviceOrientation.LANDSCAPE
}

/**
 * Récupère la configuration de l'écran actuel
 */
@Composable
fun rememberScreenConfig(): ScreenConfig {
    val configuration = LocalConfiguration.current
    val density = LocalDensity.current

    val screenWidthDp = configuration.screenWidthDp.dp
    val screenHeightDp = configuration.screenHeightDp.dp

    val deviceType = when {
        screenWidthDp < 600.dp -> DeviceType.PHONE
        screenWidthDp < 840.dp -> DeviceType.TABLET
        else -> DeviceType.LARGE_TABLET
    }

    val orientation = if (configuration.screenWidthDp > configuration.screenHeightDp) {
        DeviceOrientation.LANDSCAPE
    } else {
        DeviceOrientation.PORTRAIT
    }

    val isTablet = deviceType != DeviceType.PHONE
    val isCompact = screenWidthDp < 600.dp

    val columnCount = when {
        deviceType == DeviceType.LARGE_TABLET && orientation == DeviceOrientation.LANDSCAPE -> 3
        isTablet && orientation == DeviceOrientation.LANDSCAPE -> 2
        else -> 1
    }

    return ScreenConfig(
        deviceType = deviceType,
        orientation = orientation,
        screenWidthDp = screenWidthDp,
        screenHeightDp = screenHeightDp,
        isCompact = isCompact,
        isTablet = isTablet,
        columnCount = columnCount
    )
}

/**
 * Determine le padding horizontal adaptatif
 */
@Composable
fun rememberAdaptivePadding(): Dp {
    val config = rememberScreenConfig()
    return when (config.deviceType) {
        DeviceType.PHONE -> 16.dp
        DeviceType.TABLET -> 24.dp
        DeviceType.LARGE_TABLET -> 32.dp
    }
}

/**
 * Determine la largeur maximale du contenu
 */
@Composable
fun rememberContentMaxWidth(): Dp {
    val config = rememberScreenConfig()
    return when (config.deviceType) {
        DeviceType.PHONE -> Dp.Infinity
        DeviceType.TABLET -> 1200.dp
        DeviceType.LARGE_TABLET -> 1400.dp
    }
}

/**
 * Calcule le nombre de colonnes pour une grille
 */
@Composable
fun rememberGridColumnCount(
    minColumnWidth: Dp = 300.dp
): Int {
    val config = rememberScreenConfig()
    val availableWidth = config.screenWidthDp - (rememberAdaptivePadding() * 2)
    return maxOf(1, (availableWidth / minColumnWidth).toInt())
}

/**
 * Détermine si on est en mode compact (petit écran)
 */
@Composable
fun isCompactScreen(): Boolean {
    return rememberScreenConfig().isCompact
}

/**
 * Détermine si on est sur une tablette
 */
@Composable
fun isTablet(): Boolean {
    return rememberScreenConfig().isTablet
}

/**
 * Détermine si on doit utiliser un layout 2-colonnes
 */
@Composable
fun shouldUseTwoColumnLayout(): Boolean {
    return rememberScreenConfig().useTwoColumnLayout
}

/**
 * Extension pour obtenir la taille de fenêtre adaptée
 */
fun WindowWidthSizeClass.toDeviceType(): DeviceType {
    return when (this) {
        WindowWidthSizeClass.Compact -> DeviceType.PHONE
        WindowWidthSizeClass.Medium -> DeviceType.TABLET
        WindowWidthSizeClass.Expanded -> DeviceType.LARGE_TABLET
        else -> DeviceType.PHONE
    }
}

/**
 * Valeurs de breakpoint standards
 */
object Breakpoints {
    val COMPACT = 600.dp
    val MEDIUM = 840.dp
    val EXPANDED = 1200.dp
}

/**
 * Classes de taille d'espacement adaptatives
 */
object AdaptiveSpacing {
    @Composable
    fun small(): Dp = when (rememberScreenConfig().deviceType) {
        DeviceType.PHONE -> 4.dp
        DeviceType.TABLET -> 6.dp
        DeviceType.LARGE_TABLET -> 8.dp
    }

    @Composable
    fun medium(): Dp = when (rememberScreenConfig().deviceType) {
        DeviceType.PHONE -> 8.dp
        DeviceType.TABLET -> 12.dp
        DeviceType.LARGE_TABLET -> 16.dp
    }

    @Composable
    fun large(): Dp = when (rememberScreenConfig().deviceType) {
        DeviceType.PHONE -> 16.dp
        DeviceType.TABLET -> 24.dp
        DeviceType.LARGE_TABLET -> 32.dp
    }

    @Composable
    fun extraLarge(): Dp = when (rememberScreenConfig().deviceType) {
        DeviceType.PHONE -> 24.dp
        DeviceType.TABLET -> 32.dp
        DeviceType.LARGE_TABLET -> 48.dp
    }
}

/**
 * Tailles de texte adaptatives
 */
object AdaptiveTextSize {
    @Composable
    fun scaleFactor(): Float = when (rememberScreenConfig().deviceType) {
        DeviceType.PHONE -> 1.0f
        DeviceType.TABLET -> 1.1f
        DeviceType.LARGE_TABLET -> 1.2f
    }
}
