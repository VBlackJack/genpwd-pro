package com.julien.genpwdpro.presentation.components

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.StarOutline
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Bouton pour marquer/démarquer un élément comme favori
 * Avec animation de pulsation au clic
 */
@Composable
fun FavoriteButton(
    isFavorite: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier,
    size: Int = 24
) {
    var isAnimating by remember { mutableStateOf(false) }

    // Animation de scale au clic
    val scale by animateFloatAsState(
        targetValue = if (isAnimating) 1.3f else 1f,
        animationSpec = tween(durationMillis = 200),
        finishedListener = { isAnimating = false },
        label = "favoriteScale"
    )

    IconButton(
        onClick = {
            isAnimating = true
            onToggle()
        },
        modifier = modifier.scale(scale)
    ) {
        Icon(
            imageVector = if (isFavorite) Icons.Filled.Star else Icons.Outlined.StarOutline,
            contentDescription = if (isFavorite) "Retirer des favoris" else "Ajouter aux favoris",
            tint = if (isFavorite) Color(0xFFFFD700) else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.then(
                if (size != 24) Modifier.scale(size / 24f) else Modifier
            )
        )
    }
}

/**
 * Badge "Favori" pour affichage dans les listes
 */
@Composable
fun FavoriteBadge(
    modifier: Modifier = Modifier
) {
    AssistChip(
        onClick = { },
        label = { Text("Favori", style = MaterialTheme.typography.labelSmall) },
        leadingIcon = {
            Icon(
                imageVector = Icons.Filled.Star,
                contentDescription = null,
                tint = Color(0xFFFFD700),
                modifier = Modifier.then(Modifier.scale(0.8f))
            )
        },
        colors = AssistChipDefaults.assistChipColors(
            containerColor = Color(0xFFFFD700).copy(alpha = 0.15f),
            labelColor = Color(0xFFFFD700),
            leadingIconContentColor = Color(0xFFFFD700)
        ),
        modifier = modifier
    )
}

/**
 * Icône étoile simple (sans bouton) pour affichage compact
 */
@Composable
fun FavoriteIcon(
    isFavorite: Boolean,
    onToggle: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    size: Int = 16
) {
    val interactionSource = remember { MutableInteractionSource() }

    Icon(
        imageVector = if (isFavorite) Icons.Filled.Star else Icons.Outlined.StarOutline,
        contentDescription = if (isFavorite) "Favori" else "Non favori",
        tint = if (isFavorite) Color(0xFFFFD700) else MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier
            .then(
                onToggle?.let {
                    Modifier.clickable(
                        interactionSource = interactionSource,
                        indication = null
                    ) { it() }
                } ?: Modifier
            )
    )
}
