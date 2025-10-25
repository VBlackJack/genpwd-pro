package com.julien.genpwdpro.presentation.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Toggle animé pour changer de thème (Clair/Sombre)
 *
 * Affiche une interface élégante avec icônes soleil/lune
 * et animations fluides
 */
@Composable
fun ThemeToggle(
    isDarkTheme: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier
) {
    val backgroundColor by animateColorAsState(
        targetValue = if (isDarkTheme) Color(0xFF1A2240) else Color(0xFFF1F5F9),
        animationSpec = tween(durationMillis = 300),
        label = "backgroundColor"
    )

    val indicatorColor by animateColorAsState(
        targetValue = if (isDarkTheme) Color(0xFF15BEFF) else Color(0xFF0891C7),
        animationSpec = tween(durationMillis = 300),
        label = "indicatorColor"
    )

    Surface(
        modifier = modifier
            .width(100.dp)
            .height(44.dp)
            .clickable(onClick = onToggle),
        shape = RoundedCornerShape(22.dp),
        color = backgroundColor
    ) {
        Box {
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Icône Soleil (Clair)
                Box(
                    modifier = Modifier
                        .size(36.dp),
                    contentAlignment = Alignment.Center
                ) {
                    val lightAlpha by animateFloatAsState(
                        targetValue = if (!isDarkTheme) 1f else 0.5f,
                        label = "lightAlpha"
                    )
                    val lightScale by animateFloatAsState(
                        targetValue = if (!isDarkTheme) 1.1f else 1f,
                        label = "lightScale"
                    )

                    Icon(
                        imageVector = Icons.Default.LightMode,
                        contentDescription = "Thème clair",
                        tint = if (!isDarkTheme) Color.White else Color.Gray,
                        modifier = Modifier
                            .size(20.dp)
                            .alpha(lightAlpha)
                            .scale(lightScale)
                    )
                }

                // Icône Lune (Sombre)
                Box(
                    modifier = Modifier
                        .size(36.dp),
                    contentAlignment = Alignment.Center
                ) {
                    val darkAlpha by animateFloatAsState(
                        targetValue = if (isDarkTheme) 1f else 0.5f,
                        label = "darkAlpha"
                    )
                    val darkScale by animateFloatAsState(
                        targetValue = if (isDarkTheme) 1.1f else 1f,
                        label = "darkScale"
                    )

                    Icon(
                        imageVector = Icons.Default.DarkMode,
                        contentDescription = "Thème sombre",
                        tint = if (isDarkTheme) Color.White else Color.Gray,
                        modifier = Modifier
                            .size(20.dp)
                            .alpha(darkAlpha)
                            .scale(darkScale)
                    )
                }
            }

            // Indicateur animé
            val offsetX by animateFloatAsState(
                targetValue = if (isDarkTheme) 56f else 4f,
                animationSpec = tween(durationMillis = 300),
                label = "offsetX"
            )

            Box(
                modifier = Modifier
                    .offset(x = offsetX.dp, y = 4.dp)
                    .size(36.dp)
                    .background(
                        color = indicatorColor,
                        shape = RoundedCornerShape(18.dp)
                    )
            )
        }
    }
}

/**
 * Toggle avec label
 */
@Composable
fun ThemeToggleWithLabel(
    isDarkTheme: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(
                text = "Thème de l'application",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = if (isDarkTheme) "Mode sombre" else "Mode clair",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        ThemeToggle(
            isDarkTheme = isDarkTheme,
            onToggle = onToggle
        )
    }
}
