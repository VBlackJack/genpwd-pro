package com.julien.genpwdpro.presentation.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.layout.*
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.FractionalThreshold
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.rememberSwipeableState
import androidx.compose.material.swipeable
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.julien.genpwdpro.data.models.PasswordResult
import kotlin.math.roundToInt
import kotlinx.coroutines.delay

/**
 * Carte de mot de passe avec geste de swipe pour supprimer
 *
 * Fonctionnalités:
 * - Swipe vers la gauche pour révéler l'action de suppression
 * - Swipe complet (threshold) déclenche la suppression
 * - Animation de disparition après suppression
 * - Retour élastique si swipe incomplet
 */

enum class SwipeDirection {
    LEFT,
    RIGHT,
    NEUTRAL
}

@OptIn(ExperimentalMaterialApi::class)
@Composable
fun SwipeablePasswordCard(
    result: PasswordResult,
    onCopy: () -> Unit,
    onToggleMask: () -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier
) {
    val swipeableState = rememberSwipeableState(initialValue = SwipeDirection.NEUTRAL)
    val density = LocalDensity.current
    val swipeThreshold = with(density) { 200.dp.toPx() }
    val coroutineScope = rememberCoroutineScope()

    var isDeleted by remember { mutableStateOf(false) }

    // Déclencher la suppression lorsque le swipe atteint le threshold
    LaunchedEffect(swipeableState.currentValue) {
        if (swipeableState.currentValue == SwipeDirection.LEFT) {
            isDeleted = true
            delay(300) // Attendre l'animation de disparition
            onDelete()
        }
    }

    val anchors = mapOf(
        0f to SwipeDirection.NEUTRAL,
        -swipeThreshold to SwipeDirection.LEFT
    )

    AnimatedVisibility(
        visible = !isDeleted,
        exit = shrinkVertically(animationSpec = tween(300)) + fadeOut()
    ) {
        Box(
            modifier = modifier
                .fillMaxWidth()
        ) {
            // Arrière-plan de suppression (révélé lors du swipe)
            SwipeBackground(
                revealProgress = if (swipeableState.offset.value < 0) {
                    -swipeableState.offset.value / swipeThreshold
                } else {
                    0f
                }
            )

            // Carte principale swipeable
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .offset { IntOffset(swipeableState.offset.value.roundToInt(), 0) }
                    .swipeable(
                        state = swipeableState,
                        anchors = anchors,
                        thresholds = { _, _ -> FractionalThreshold(0.5f) },
                        orientation = Orientation.Horizontal
                    )
            ) {
                PasswordCard(
                    result = result,
                    onCopy = onCopy,
                    onToggleMask = onToggleMask
                )
            }
        }
    }
}

/**
 * Arrière-plan révélé lors du swipe avec icône de suppression
 */
@Composable
private fun SwipeBackground(
    revealProgress: Float,
    modifier: Modifier = Modifier
) {
    val alpha by animateFloatAsState(
        targetValue = revealProgress.coerceIn(0f, 1f),
        label = "backgroundAlpha"
    )

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(140.dp)
            .background(Color.Red.copy(alpha = 0.1f + (alpha * 0.2f)))
            .alpha(alpha),
        contentAlignment = Alignment.CenterEnd
    ) {
        Row(
            modifier = Modifier.padding(end = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Delete,
                contentDescription = "Supprimer",
                tint = Color.Red,
                modifier = Modifier.size(32.dp)
            )
            if (revealProgress > 0.7f) {
                Text(
                    text = "Supprimer",
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.Red
                )
            }
        }
    }
}

/**
 * Carte avec swipe bi-directionnel (gauche et droite)
 */
@OptIn(ExperimentalMaterialApi::class)
@Composable
fun BiDirectionalSwipeableCard(
    result: PasswordResult,
    onCopy: () -> Unit,
    onToggleMask: () -> Unit,
    onDelete: () -> Unit,
    onFavorite: () -> Unit,
    modifier: Modifier = Modifier
) {
    val swipeableState = rememberSwipeableState(initialValue = SwipeDirection.NEUTRAL)
    val density = LocalDensity.current
    val swipeThreshold = with(density) { 200.dp.toPx() }
    val coroutineScope = rememberCoroutineScope()

    var isDeleted by remember { mutableStateOf(false) }

    // Gestion des actions de swipe
    LaunchedEffect(swipeableState.currentValue) {
        when (swipeableState.currentValue) {
            SwipeDirection.LEFT -> {
                isDeleted = true
                delay(300)
                onDelete()
            }
            SwipeDirection.RIGHT -> {
                onFavorite()
                // Reset après l'action
                swipeableState.animateTo(SwipeDirection.NEUTRAL)
            }
            SwipeDirection.NEUTRAL -> {}
        }
    }

    val anchors = mapOf(
        -swipeThreshold to SwipeDirection.LEFT,
        0f to SwipeDirection.NEUTRAL,
        swipeThreshold to SwipeDirection.RIGHT
    )

    AnimatedVisibility(
        visible = !isDeleted,
        exit = shrinkVertically(animationSpec = tween(300)) + fadeOut()
    ) {
        Box(
            modifier = modifier
                .fillMaxWidth()
        ) {
            // Arrière-plan bi-directionnel
            BiDirectionalSwipeBackground(
                offsetX = swipeableState.offset.value,
                threshold = swipeThreshold
            )

            // Carte principale
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .offset { IntOffset(swipeableState.offset.value.roundToInt(), 0) }
                    .swipeable(
                        state = swipeableState,
                        anchors = anchors,
                        thresholds = { _, _ -> FractionalThreshold(0.5f) },
                        orientation = Orientation.Horizontal
                    )
            ) {
                PasswordCard(
                    result = result,
                    onCopy = onCopy,
                    onToggleMask = onToggleMask
                )
            }
        }
    }
}

/**
 * Arrière-plan bi-directionnel avec actions gauche/droite
 */
@Composable
private fun BiDirectionalSwipeBackground(
    offsetX: Float,
    threshold: Float,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(140.dp)
    ) {
        // Action gauche (Delete)
        if (offsetX < 0) {
            val progress = (-offsetX / threshold).coerceIn(0f, 1f)
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Red.copy(alpha = 0.1f + (progress * 0.2f)))
                    .alpha(progress),
                contentAlignment = Alignment.CenterEnd
            ) {
                Row(
                    modifier = Modifier.padding(end = 24.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = "Supprimer",
                        tint = Color.Red
                    )
                    if (progress > 0.7f) {
                        Text("Supprimer", color = Color.Red)
                    }
                }
            }
        }

        // Action droite (Favorite)
        if (offsetX > 0) {
            val progress = (offsetX / threshold).coerceIn(0f, 1f)
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        MaterialTheme.colorScheme.primary.copy(alpha = 0.1f + (progress * 0.2f))
                    )
                    .alpha(progress),
                contentAlignment = Alignment.CenterStart
            ) {
                Row(
                    modifier = Modifier.padding(start = 24.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (progress > 0.7f) {
                        Text("Favori", color = MaterialTheme.colorScheme.primary)
                    }
                    Icon(
                        imageVector = Icons.Default.Delete, // Remplacer par Star pour favori
                        contentDescription = "Favori",
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }
    }
}

/**
 * Simple carte dismissible avec swipe pour supprimer
 */
@OptIn(ExperimentalMaterialApi::class)
@Composable
fun DismissiblePasswordCard(
    result: PasswordResult,
    onCopy: () -> Unit,
    onToggleMask: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    val swipeableState = rememberSwipeableState(initialValue = 0)
    val density = LocalDensity.current
    val swipeWidth = with(density) { 300.dp.toPx() }

    var isDismissed by remember { mutableStateOf(false) }

    LaunchedEffect(swipeableState.offset.value) {
        if (swipeableState.offset.value <= -swipeWidth * 0.8f) {
            isDismissed = true
            delay(200)
            onDismiss()
        }
    }

    val anchors = mapOf(
        0f to 0,
        -swipeWidth to 1
    )

    AnimatedVisibility(
        visible = !isDismissed,
        exit = fadeOut() + shrinkVertically()
    ) {
        Box(
            modifier = modifier
                .fillMaxWidth()
                .swipeable(
                    state = swipeableState,
                    anchors = anchors,
                    thresholds = { _, _ -> FractionalThreshold(0.8f) },
                    orientation = Orientation.Horizontal
                )
                .offset { IntOffset(swipeableState.offset.value.roundToInt(), 0) }
        ) {
            PasswordCard(
                result = result,
                onCopy = onCopy,
                onToggleMask = onToggleMask
            )
        }
    }
}
