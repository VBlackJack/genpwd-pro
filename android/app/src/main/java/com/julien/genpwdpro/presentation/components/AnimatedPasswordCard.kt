package com.julien.genpwdpro.presentation.components

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import com.julien.genpwdpro.data.models.PasswordResult

/**
 * Carte de mot de passe avec animations avancées
 *
 * Animations incluses:
 * - Entrée avec spring animation
 * - Pulse animation lors de la copie
 * - Shake animation lors d'erreur
 * - Glow effect pour les mots de passe forts
 */

/**
 * PasswordCard avec animations d'entrée et de pulse
 */
@Composable
fun AnimatedPasswordCard(
    result: PasswordResult,
    onCopy: () -> Unit,
    onToggleMask: () -> Unit,
    modifier: Modifier = Modifier,
    showPulse: Boolean = false
) {
    // Animation d'entrée avec spring
    var visible by remember { mutableStateOf(false) }

    LaunchedEffect(result.id) {
        visible = true
    }

    // Spring animation pour l'entrée
    val scale by animateFloatAsState(
        targetValue = if (visible) 1f else 0.8f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        ),
        label = "scale"
    )

    val alpha by animateFloatAsState(
        targetValue = if (visible) 1f else 0f,
        animationSpec = tween(durationMillis = 300),
        label = "alpha"
    )

    // Pulse animation lors de la copie
    val pulseScale by animateFloatAsState(
        targetValue = if (showPulse) 1.05f else 1f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessHigh
        ),
        label = "pulse"
    )

    Box(
        modifier = modifier
            .scale(scale * pulseScale)
            .graphicsLayer { this.alpha = alpha }
    ) {
        PasswordCard(
            result = result,
            onCopy = onCopy,
            onToggleMask = onToggleMask
        )
    }
}

/**
 * PasswordCard avec effet de glow pour les mots de passe très forts
 */
@Composable
fun GlowingPasswordCard(
    result: PasswordResult,
    onCopy: () -> Unit,
    onToggleMask: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isVeryStrong = result.entropy > 100.0

    // Animation de glow pulsante
    val infiniteTransition = rememberInfiniteTransition(label = "glow")
    val glowAlpha by infiniteTransition.animateFloat(
        initialValue = 0.3f,
        targetValue = 0.7f,
        animationSpec = infiniteRepeatable(
            animation = tween(1500, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "glowAlpha"
    )

    Box(modifier = modifier) {
        // Effet de glow en arrière-plan pour les mots de passe très forts
        if (isVeryStrong) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(2.dp)
                    .graphicsLayer { alpha = glowAlpha },
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)
                )
            ) {
                Spacer(modifier = Modifier.height(120.dp))
            }
        }

        PasswordCard(
            result = result,
            onCopy = onCopy,
            onToggleMask = onToggleMask
        )
    }
}

/**
 * Animation de shake pour les erreurs
 */
@Composable
fun ShakeablePasswordCard(
    result: PasswordResult,
    onCopy: () -> Unit,
    onToggleMask: () -> Unit,
    shouldShake: Boolean,
    modifier: Modifier = Modifier
) {
    val shakeOffset by animateFloatAsState(
        targetValue = if (shouldShake) 0f else 1f,
        animationSpec = repeatable(
            iterations = 3,
            animation = tween(50),
            repeatMode = RepeatMode.Reverse
        ),
        label = "shake"
    )

    Box(
        modifier = modifier.graphicsLayer {
            translationX = if (shouldShake) {
                (shakeOffset * 10f) * if (shakeOffset > 0.5f) 1 else -1
            } else 0f
        }
    ) {
        PasswordCard(
            result = result,
            onCopy = onCopy,
            onToggleMask = onToggleMask
        )
    }
}

/**
 * Carte avec animation de flip pour toggle mask
 */
@Composable
fun FlippablePasswordCard(
    result: PasswordResult,
    onCopy: () -> Unit,
    onToggleMask: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isMasked by remember { mutableStateOf(result.isMasked) }

    // Animation de rotation pour le flip
    val rotation by animateFloatAsState(
        targetValue = if (isMasked) 0f else 180f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessMedium
        ),
        label = "flip"
    )

    Box(
        modifier = modifier.graphicsLayer {
            rotationY = rotation
            cameraDistance = 12f * density
        }
    ) {
        PasswordCard(
            result = result,
            onCopy = onCopy,
            onToggleMask = {
                isMasked = !isMasked
                onToggleMask()
            }
        )
    }
}

/**
 * Slide-in animation pour l'apparition des cartes
 */
@OptIn(ExperimentalAnimationApi::class)
@Composable
fun SlideInPasswordCard(
    result: PasswordResult,
    onCopy: () -> Unit,
    onToggleMask: () -> Unit,
    modifier: Modifier = Modifier,
    delayMillis: Int = 0
) {
    var visible by remember { mutableStateOf(false) }

    LaunchedEffect(result.id) {
        kotlinx.coroutines.delay(delayMillis.toLong())
        visible = true
    }

    AnimatedVisibility(
        visible = visible,
        enter = slideInHorizontally(
            initialOffsetX = { fullWidth -> fullWidth },
            animationSpec = spring(
                dampingRatio = Spring.DampingRatioMediumBouncy,
                stiffness = Spring.StiffnessMedium
            )
        ) + fadeIn(),
        exit = slideOutHorizontally() + fadeOut()
    ) {
        PasswordCard(
            result = result,
            onCopy = onCopy,
            onToggleMask = onToggleMask,
            modifier = modifier
        )
    }
}

/**
 * Expansion animation pour le contenu de la carte
 */
@OptIn(ExperimentalAnimationApi::class)
@Composable
fun ExpandablePasswordCard(
    result: PasswordResult,
    onCopy: () -> Unit,
    onToggleMask: () -> Unit,
    expanded: Boolean,
    onExpandToggle: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier) {
        PasswordCard(
            result = result,
            onCopy = onCopy,
            onToggleMask = onToggleMask
        )

        AnimatedVisibility(
            visible = expanded,
            enter = expandVertically(
                animationSpec = spring(
                    dampingRatio = Spring.DampingRatioMediumBouncy,
                    stiffness = Spring.StiffnessMedium
                )
            ) + fadeIn(),
            exit = shrinkVertically() + fadeOut()
        ) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Détails du mot de passe",
                        style = MaterialTheme.typography.titleSmall
                    )
                    Text(
                        text = "Longueur: ${result.password.length} caractères",
                        style = MaterialTheme.typography.bodySmall
                    )
                    Text(
                        text = "Mode: ${result.mode}",
                        style = MaterialTheme.typography.bodySmall
                    )
                    Text(
                        text = "Force: ${result.strength}",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }
    }
}
