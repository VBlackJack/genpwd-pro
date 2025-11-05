package com.julien.genpwdpro.presentation.animations

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.TransformOrigin

/**
 * Animations et transitions personnalisées pour l'application
 * Améliore l'expérience utilisateur avec des animations fluides et modernes
 */
object TransitionAnimations {

    /**
     * Durées standard des animations (suivant Material Design)
     */
    object Durations {
        const val FAST = 150
        const val MEDIUM = 300
        const val SLOW = 500
    }

    /**
     * Easing curves personnalisées
     */
    object Easing {
        val standard = CubicBezierEasing(0.4f, 0.0f, 0.2f, 1.0f)
        val decelerate = CubicBezierEasing(0.0f, 0.0f, 0.2f, 1.0f)
        val accelerate = CubicBezierEasing(0.4f, 0.0f, 1.0f, 1.0f)
        val emphasized = CubicBezierEasing(0.2f, 0.0f, 0.0f, 1.0f)
    }

    /**
     * Transition de slide fade pour les écrans
     */
    fun slideInFromRight(): EnterTransition {
        return slideInHorizontally(
            initialOffsetX = { fullWidth -> fullWidth },
            animationSpec = tween(
                durationMillis = Durations.MEDIUM,
                easing = Easing.emphasized
            )
        ) + fadeIn(
            animationSpec = tween(
                durationMillis = Durations.MEDIUM,
                easing = Easing.decelerate
            )
        )
    }

    fun slideOutToLeft(): ExitTransition {
        return slideOutHorizontally(
            targetOffsetX = { fullWidth -> -fullWidth },
            animationSpec = tween(
                durationMillis = Durations.MEDIUM,
                easing = Easing.emphasized
            )
        ) + fadeOut(
            animationSpec = tween(
                durationMillis = Durations.MEDIUM,
                easing = Easing.accelerate
            )
        )
    }

    fun slideInFromLeft(): EnterTransition {
        return slideInHorizontally(
            initialOffsetX = { fullWidth -> -fullWidth },
            animationSpec = tween(
                durationMillis = Durations.MEDIUM,
                easing = Easing.emphasized
            )
        ) + fadeIn(
            animationSpec = tween(
                durationMillis = Durations.MEDIUM,
                easing = Easing.decelerate
            )
        )
    }

    fun slideOutToRight(): ExitTransition {
        return slideOutHorizontally(
            targetOffsetX = { fullWidth -> fullWidth },
            animationSpec = tween(
                durationMillis = Durations.MEDIUM,
                easing = Easing.emphasized
            )
        ) + fadeOut(
            animationSpec = tween(
                durationMillis = Durations.MEDIUM,
                easing = Easing.accelerate
            )
        )
    }

    /**
     * Transition de scale fade pour les dialogs et menus
     */
    fun scaleIn(transformOrigin: TransformOrigin = TransformOrigin.Center): EnterTransition {
        return scaleIn(
            initialScale = 0.8f,
            transformOrigin = transformOrigin,
            animationSpec = tween(
                durationMillis = Durations.MEDIUM,
                easing = Easing.emphasized
            )
        ) + fadeIn(
            animationSpec = tween(
                durationMillis = Durations.FAST,
                easing = Easing.decelerate
            )
        )
    }

    fun scaleOut(transformOrigin: TransformOrigin = TransformOrigin.Center): ExitTransition {
        return scaleOut(
            targetScale = 0.8f,
            transformOrigin = transformOrigin,
            animationSpec = tween(
                durationMillis = Durations.MEDIUM,
                easing = Easing.accelerate
            )
        ) + fadeOut(
            animationSpec = tween(
                durationMillis = Durations.FAST,
                easing = Easing.accelerate
            )
        )
    }

    /**
     * Transition verticale pour les bottom sheets
     */
    fun slideInFromBottom(): EnterTransition {
        return slideInVertically(
            initialOffsetY = { fullHeight -> fullHeight },
            animationSpec = tween(
                durationMillis = Durations.MEDIUM,
                easing = Easing.emphasized
            )
        ) + fadeIn(
            animationSpec = tween(
                durationMillis = Durations.FAST,
                easing = Easing.decelerate
            )
        )
    }

    fun slideOutToBottom(): ExitTransition {
        return slideOutVertically(
            targetOffsetY = { fullHeight -> fullHeight },
            animationSpec = tween(
                durationMillis = Durations.MEDIUM,
                easing = Easing.accelerate
            )
        ) + fadeOut(
            animationSpec = tween(
                durationMillis = Durations.FAST,
                easing = Easing.accelerate
            )
        )
    }

    /**
     * Transition verticale pour les top bars
     */
    fun slideInFromTop(): EnterTransition {
        return slideInVertically(
            initialOffsetY = { fullHeight -> -fullHeight },
            animationSpec = tween(
                durationMillis = Durations.MEDIUM,
                easing = Easing.emphasized
            )
        ) + fadeIn(
            animationSpec = tween(
                durationMillis = Durations.FAST,
                easing = Easing.decelerate
            )
        )
    }

    fun slideOutToTop(): ExitTransition {
        return slideOutVertically(
            targetOffsetY = { fullHeight -> -fullHeight },
            animationSpec = tween(
                durationMillis = Durations.MEDIUM,
                easing = Easing.accelerate
            )
        ) + fadeOut(
            animationSpec = tween(
                durationMillis = Durations.FAST,
                easing = Easing.accelerate
            )
        )
    }

    /**
     * Fade simple pour les transitions subtiles
     */
    fun fadeIn(): EnterTransition {
        return fadeIn(
            animationSpec = tween(
                durationMillis = Durations.MEDIUM,
                easing = Easing.decelerate
            )
        )
    }

    fun fadeOut(): ExitTransition {
        return fadeOut(
            animationSpec = tween(
                durationMillis = Durations.MEDIUM,
                easing = Easing.accelerate
            )
        )
    }

    /**
     * Animation d'expansion/contraction
     */
    fun expandVertically(): EnterTransition {
        return expandVertically(
            animationSpec = tween(
                durationMillis = Durations.MEDIUM,
                easing = Easing.emphasized
            )
        ) + fadeIn(
            animationSpec = tween(
                durationMillis = Durations.FAST,
                easing = Easing.decelerate
            )
        )
    }

    fun shrinkVertically(): ExitTransition {
        return shrinkVertically(
            animationSpec = tween(
                durationMillis = Durations.MEDIUM,
                easing = Easing.emphasized
            )
        ) + fadeOut(
            animationSpec = tween(
                durationMillis = Durations.FAST,
                easing = Easing.accelerate
            )
        )
    }

    /**
     * Animation pour les éléments de liste
     */
    fun listItemEnter(index: Int, staggerDelay: Int = 50): EnterTransition {
        val delay = index * staggerDelay
        return fadeIn(
            animationSpec = tween(
                durationMillis = Durations.MEDIUM,
                delayMillis = delay,
                easing = Easing.decelerate
            )
        ) + slideInVertically(
            initialOffsetY = { it / 2 },
            animationSpec = tween(
                durationMillis = Durations.MEDIUM,
                delayMillis = delay,
                easing = Easing.emphasized
            )
        )
    }

    fun listItemExit(): ExitTransition {
        return fadeOut(
            animationSpec = tween(
                durationMillis = Durations.FAST,
                easing = Easing.accelerate
            )
        ) + shrinkVertically(
            animationSpec = tween(
                durationMillis = Durations.FAST,
                easing = Easing.accelerate
            )
        )
    }
}

/**
 * Composable wrapper pour animer l'apparition de contenu
 */
@Composable
fun AnimatedContent(
    visible: Boolean,
    modifier: Modifier = Modifier,
    enter: EnterTransition = TransitionAnimations.fadeIn(),
    exit: ExitTransition = TransitionAnimations.fadeOut(),
    content: @Composable () -> Unit
) {
    AnimatedVisibility(
        visible = visible,
        modifier = modifier,
        enter = enter,
        exit = exit
    ) {
        content()
    }
}

/**
 * Animation de pulsation pour les éléments importants
 */
@Composable
fun PulseAnimation(
    modifier: Modifier = Modifier,
    content: @Composable (scale: Float) -> Unit
) {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val scale = infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.05f,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = 1000,
                easing = TransitionAnimations.Easing.standard
            ),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scale"
    )

    Box(modifier = modifier) {
        content(scale.value)
    }
}

/**
 * Animation de shake pour les erreurs
 */
@Composable
fun ShakeAnimation(
    trigger: Boolean,
    onFinish: () -> Unit = {},
    content: @Composable (offsetX: Float) -> Unit
) {
    val offsetX = remember { Animatable(0f) }

    androidx.compose.runtime.LaunchedEffect(trigger) {
        if (trigger) {
            // Shake pattern
            repeat(3) {
                offsetX.animateTo(
                    targetValue = 10f,
                    animationSpec = tween(50)
                )
                offsetX.animateTo(
                    targetValue = -10f,
                    animationSpec = tween(50)
                )
            }
            offsetX.animateTo(
                targetValue = 0f,
                animationSpec = tween(50)
            )
            onFinish()
        }
    }

    content(offsetX.value)
}

/**
 * Animation de rotation pour les rafraîchissements
 */
@Composable
fun RotateAnimation(
    isRotating: Boolean,
    content: @Composable (rotation: Float) -> Unit
) {
    val rotation = remember { Animatable(0f) }

    androidx.compose.runtime.LaunchedEffect(isRotating) {
        if (isRotating) {
            rotation.animateTo(
                targetValue = 360f,
                animationSpec = infiniteRepeatable(
                    animation = tween(
                        durationMillis = 1000,
                        easing = LinearEasing
                    ),
                    repeatMode = RepeatMode.Restart
                )
            )
        } else {
            rotation.snapTo(0f)
        }
    }

    content(rotation.value)
}

/**
 * Transition pour les shared elements (pour les futures implémentations)
 */
object SharedElementTransitions {
    fun bounds(): ContentTransform {
        return ContentTransform(
            targetContentEnter = TransitionAnimations.fadeIn(),
            initialContentExit = TransitionAnimations.fadeOut(),
            sizeTransform = SizeTransform { _, _ ->
                tween(
                    durationMillis = TransitionAnimations.Durations.MEDIUM,
                    easing = TransitionAnimations.Easing.emphasized
                )
            }
        )
    }
}

/**
 * Spring animations pour les interactions tactiles
 */
object SpringAnimations {
    fun <T> bouncy() = spring<T>(
        dampingRatio = Spring.DampingRatioMediumBouncy,
        stiffness = Spring.StiffnessMedium
    )

    fun <T> gentle() = spring<T>(
        dampingRatio = Spring.DampingRatioLowBouncy,
        stiffness = Spring.StiffnessLow
    )

    fun <T> stiff() = spring<T>(
        dampingRatio = Spring.DampingRatioNoBouncy,
        stiffness = Spring.StiffnessHigh
    )
}
