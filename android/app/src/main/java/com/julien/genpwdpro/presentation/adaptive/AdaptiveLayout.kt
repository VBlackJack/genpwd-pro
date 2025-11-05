package com.julien.genpwd-pro.presentation.adaptive

import androidx.compose.foundation.layout.*
import androidx.compose.material3.windowsizeclass.WindowSizeClass
import androidx.compose.material3.windowsizeclass.WindowWidthSizeClass
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Système de layout adaptatif pour tablettes et écrans pliables
 * Supporte les différentes tailles d'écran selon Material Design 3
 */

/**
 * Type d'appareil détecté
 */
enum class DeviceType {
    PHONE,          // Smartphones standard
    TABLET,         // Tablettes
    FOLDABLE,       // Appareils pliables
    LARGE_TABLET    // Grandes tablettes (10"+)
}

/**
 * Orientation de l'écran
 */
enum class ScreenOrientation {
    PORTRAIT,
    LANDSCAPE
}

/**
 * Configuration adaptative basée sur la taille de l'écran
 */
data class AdaptiveConfig(
    val deviceType: DeviceType,
    val orientation: ScreenOrientation,
    val windowSizeClass: WindowWidthSizeClass,
    val screenWidthDp: Int,
    val screenHeightDp: Int,
    val useTwoPane: Boolean,
    val useCompactLayout: Boolean,
    val contentPadding: PaddingValues,
    val gridColumns: Int,
    val maxContentWidth: Dp
)

/**
 * Hook pour obtenir la configuration adaptative actuelle
 */
@Composable
fun rememberAdaptiveConfig(): AdaptiveConfig {
    val configuration = LocalConfiguration.current
    val screenWidthDp = configuration.screenWidthDp
    val screenHeightDp = configuration.screenHeightDp

    return remember(screenWidthDp, screenHeightDp) {
        val orientation = if (screenWidthDp > screenHeightDp) {
            ScreenOrientation.LANDSCAPE
        } else {
            ScreenOrientation.PORTRAIT
        }

        val deviceType = when {
            screenWidthDp >= 900 -> DeviceType.LARGE_TABLET
            screenWidthDp >= 600 -> DeviceType.TABLET
            screenWidthDp >= 480 && orientation == ScreenOrientation.LANDSCAPE -> DeviceType.FOLDABLE
            else -> DeviceType.PHONE
        }

        val windowSizeClass = when {
            screenWidthDp < 600 -> WindowWidthSizeClass.Compact
            screenWidthDp < 840 -> WindowWidthSizeClass.Medium
            else -> WindowWidthSizeClass.Expanded
        }

        val useTwoPane = when (deviceType) {
            DeviceType.PHONE -> false
            DeviceType.FOLDABLE -> orientation == ScreenOrientation.LANDSCAPE
            DeviceType.TABLET -> orientation == ScreenOrientation.LANDSCAPE
            DeviceType.LARGE_TABLET -> true
        }

        val useCompactLayout = deviceType == DeviceType.PHONE

        val contentPadding = when (deviceType) {
            DeviceType.PHONE -> PaddingValues(16.dp)
            DeviceType.FOLDABLE -> PaddingValues(horizontal = 24.dp, vertical = 16.dp)
            DeviceType.TABLET -> PaddingValues(horizontal = 32.dp, vertical = 24.dp)
            DeviceType.LARGE_TABLET -> PaddingValues(horizontal = 48.dp, vertical = 32.dp)
        }

        val gridColumns = when (deviceType) {
            DeviceType.PHONE -> if (orientation == ScreenOrientation.PORTRAIT) 1 else 2
            DeviceType.FOLDABLE -> if (orientation == ScreenOrientation.PORTRAIT) 2 else 3
            DeviceType.TABLET -> if (orientation == ScreenOrientation.PORTRAIT) 2 else 3
            DeviceType.LARGE_TABLET -> if (orientation == ScreenOrientation.PORTRAIT) 3 else 4
        }

        val maxContentWidth = when (deviceType) {
            DeviceType.PHONE -> 600.dp
            DeviceType.FOLDABLE -> 840.dp
            DeviceType.TABLET -> 1200.dp
            DeviceType.LARGE_TABLET -> 1600.dp
        }

        AdaptiveConfig(
            deviceType = deviceType,
            orientation = orientation,
            windowSizeClass = windowSizeClass,
            screenWidthDp = screenWidthDp,
            screenHeightDp = screenHeightDp,
            useTwoPane = useTwoPane,
            useCompactLayout = useCompactLayout,
            contentPadding = contentPadding,
            gridColumns = gridColumns,
            maxContentWidth = maxContentWidth
        )
    }
}

/**
 * Layout adaptatif pour master-detail
 * Affiche une liste et un détail côte à côte sur tablettes
 */
@Composable
fun AdaptiveMasterDetail(
    showDetail: Boolean,
    onBackFromDetail: () -> Unit,
    masterContent: @Composable () -> Unit,
    detailContent: @Composable () -> Unit
) {
    val config = rememberAdaptiveConfig()

    if (config.useTwoPane) {
        // Mode deux panneaux pour tablettes
        Row(modifier = Modifier.fillMaxSize()) {
            // Master pane (liste)
            Box(
                modifier = Modifier
                    .weight(0.4f)
                    .fillMaxHeight()
            ) {
                masterContent()
            }

            // Detail pane
            Box(
                modifier = Modifier
                    .weight(0.6f)
                    .fillMaxHeight()
            ) {
                if (showDetail) {
                    detailContent()
                }
            }
        }
    } else {
        // Mode simple panneau pour téléphones
        if (showDetail) {
            detailContent()
        } else {
            masterContent()
        }
    }
}

/**
 * Layout adaptatif pour grille
 */
@Composable
fun <T> AdaptiveGrid(
    items: List<T>,
    modifier: Modifier = Modifier,
    itemContent: @Composable (T) -> Unit
) {
    val config = rememberAdaptiveConfig()

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(config.contentPadding),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        items.chunked(config.gridColumns).forEach { rowItems ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                rowItems.forEach { item ->
                    Box(modifier = Modifier.weight(1f)) {
                        itemContent(item)
                    }
                }
                // Remplir les espaces vides
                repeat(config.gridColumns - rowItems.size) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

/**
 * Container avec largeur maximale pour le contenu
 * Centré sur les grands écrans
 */
@Composable
fun AdaptiveContentContainer(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    val config = rememberAdaptiveConfig()

    Box(
        modifier = modifier.fillMaxSize()
    ) {
        Box(
            modifier = Modifier
                .widthIn(max = config.maxContentWidth)
                .fillMaxHeight()
        ) {
            content()
        }
    }
}

/**
 * Espacement adaptatif selon la taille de l'écran
 */
object AdaptiveSpacing {
    @Composable
    fun small(): Dp {
        val config = rememberAdaptiveConfig()
        return when (config.deviceType) {
            DeviceType.PHONE -> 8.dp
            DeviceType.FOLDABLE -> 12.dp
            DeviceType.TABLET -> 16.dp
            DeviceType.LARGE_TABLET -> 20.dp
        }
    }

    @Composable
    fun medium(): Dp {
        val config = rememberAdaptiveConfig()
        return when (config.deviceType) {
            DeviceType.PHONE -> 16.dp
            DeviceType.FOLDABLE -> 20.dp
            DeviceType.TABLET -> 24.dp
            DeviceType.LARGE_TABLET -> 32.dp
        }
    }

    @Composable
    fun large(): Dp {
        val config = rememberAdaptiveConfig()
        return when (config.deviceType) {
            DeviceType.PHONE -> 24.dp
            DeviceType.FOLDABLE -> 32.dp
            DeviceType.TABLET -> 40.dp
            DeviceType.LARGE_TABLET -> 48.dp
        }
    }
}

/**
 * Tailles de texte adaptatives
 */
object AdaptiveTextSize {
    @Composable
    fun scaleFactor(): Float {
        val config = rememberAdaptiveConfig()
        return when (config.deviceType) {
            DeviceType.PHONE -> 1.0f
            DeviceType.FOLDABLE -> 1.05f
            DeviceType.TABLET -> 1.1f
            DeviceType.LARGE_TABLET -> 1.15f
        }
    }
}

/**
 * Navigation adaptative
 * Rail de navigation pour tablettes, bottom bar pour téléphones
 */
enum class NavigationType {
    BOTTOM_NAVIGATION,
    NAVIGATION_RAIL,
    PERMANENT_NAVIGATION_DRAWER
}

@Composable
fun getNavigationType(): NavigationType {
    val config = rememberAdaptiveConfig()
    return when (config.windowSizeClass) {
        WindowWidthSizeClass.Compact -> NavigationType.BOTTOM_NAVIGATION
        WindowWidthSizeClass.Medium -> NavigationType.NAVIGATION_RAIL
        else -> NavigationType.PERMANENT_NAVIGATION_DRAWER
    }
}

/**
 * Extension pour appliquer un padding adaptatif
 */
fun Modifier.adaptivePadding(): Modifier = this.then(
    Modifier.padding(16.dp) // Sera remplacé par le padding adaptatif
)

/**
 * Détection des écrans pliables
 */
@Composable
fun isFoldableDevice(): Boolean {
    val config = rememberAdaptiveConfig()
    return config.deviceType == DeviceType.FOLDABLE
}

/**
 * Largeur de colonne adaptative pour les formulaires
 */
@Composable
fun getFormColumnWidth(): Dp {
    val config = rememberAdaptiveConfig()
    return when (config.deviceType) {
        DeviceType.PHONE -> Dp.Infinity
        DeviceType.FOLDABLE -> 500.dp
        DeviceType.TABLET -> 600.dp
        DeviceType.LARGE_TABLET -> 700.dp
    }
}

/**
 * Nombre de colonnes pour LazyVerticalGrid
 */
@Composable
fun getGridColumnCount(): Int {
    val config = rememberAdaptiveConfig()
    return config.gridColumns
}

/**
 * Support pour les gestes spécifiques aux pliables
 */
data class FoldableState(
    val isFolded: Boolean,
    val foldPosition: Float,
    val isTableTopMode: Boolean
)

@Composable
fun rememberFoldableState(): FoldableState {
    // Pour l'instant, retourne un état par défaut
    // À implémenter avec WindowManager pour détecter l'état réel des pliables
    return remember {
        FoldableState(
            isFolded = false,
            foldPosition = 0.5f,
            isTableTopMode = false
        )
    }
}
