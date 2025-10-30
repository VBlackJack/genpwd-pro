package com.julien.genpwdpro.presentation.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.julien.genpwdpro.data.models.PasswordStrength

/**
 * Indicateur visuel de la force d'un mot de passe
 *
 * Affiche une icône colorée, un label et la valeur d'entropie
 * avec des animations fluides
 *
 * @param entropy Valeur d'entropie en bits
 * @param strength Force calculée du mot de passe
 * @param modifier Modificateur Compose
 * @param showEntropyValue Afficher la valeur numérique (défaut: true)
 */
@Composable
fun PasswordStrengthIndicator(
    entropy: Double,
    strength: PasswordStrength,
    modifier: Modifier = Modifier,
    showEntropyValue: Boolean = true
) {
    val (color, label, icon) = getStrengthProperties(strength)

    // Animation de couleur
    val animatedColor by animateColorAsState(
        targetValue = color,
        animationSpec = tween(durationMillis = 300),
        label = "colorAnimation"
    )

    // Animation de scale pour l'icône
    val scale by animateFloatAsState(
        targetValue = 1f,
        animationSpec = tween(durationMillis = 300),
        label = "scaleAnimation"
    )

    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Icône animée
        Icon(
            imageVector = icon,
            contentDescription = "Force: $label",
            tint = animatedColor,
            modifier = Modifier.size(20.dp)
        )

        // Label de force
        Text(
            text = label,
            color = animatedColor,
            fontWeight = FontWeight.Bold,
            style = MaterialTheme.typography.bodyMedium
        )

        // Valeur d'entropie (optionnel)
        if (showEntropyValue) {
            Text(
                text = "(${entropy.toInt()} bits)",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}

/**
 * Indicateur compact de force (icône uniquement)
 */
@Composable
fun PasswordStrengthIcon(
    strength: PasswordStrength,
    modifier: Modifier = Modifier,
    size: Int = 16
) {
    val (color, label, icon) = getStrengthProperties(strength)

    val animatedColor by animateColorAsState(
        targetValue = color,
        animationSpec = tween(durationMillis = 300),
        label = "iconColorAnimation"
    )

    Icon(
        imageVector = icon,
        contentDescription = "Force: $label",
        tint = animatedColor,
        modifier = modifier.size(size.dp)
    )
}

/**
 * Badge de force avec fond coloré
 */
@Composable
fun PasswordStrengthBadge(
    strength: PasswordStrength,
    modifier: Modifier = Modifier
) {
    val (color, label, _) = getStrengthProperties(strength)

    val animatedColor by animateColorAsState(
        targetValue = color,
        animationSpec = tween(durationMillis = 300),
        label = "badgeColorAnimation"
    )

    androidx.compose.material3.Surface(
        modifier = modifier,
        shape = MaterialTheme.shapes.small,
        color = animatedColor.copy(alpha = 0.15f)
    ) {
        Text(
            text = label,
            color = animatedColor,
            fontWeight = FontWeight.Bold,
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

/**
 * Retourne les propriétés visuelles pour un niveau de force
 */
private fun getStrengthProperties(
    strength: PasswordStrength
): Triple<Color, String, ImageVector> {
    return when (strength) {
        PasswordStrength.WEAK -> Triple(
            Color(0xFFFF6B6B), // Rouge clair
            "Faible",
            Icons.Default.Lock
        )
        PasswordStrength.MEDIUM -> Triple(
            Color(0xFFF59E0B), // Orange
            "Moyen",
            Icons.Default.Security
        )
        PasswordStrength.STRONG -> Triple(
            Color(0xFF10B981), // Vert
            "Fort",
            Icons.Default.Security
        )
        PasswordStrength.VERY_STRONG -> Triple(
            Color(0xFF15BEFF), // Cyan
            "Très Fort",
            Icons.Default.Shield
        )
    }
}

/**
 * Indicateur détaillé avec description
 */
@Composable
fun PasswordStrengthDetails(
    entropy: Double,
    strength: PasswordStrength,
    modifier: Modifier = Modifier
) {
    val (color, label, icon) = getStrengthProperties(strength)
    val description = getStrengthDescription(strength)

    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        // Indicateur principal
        PasswordStrengthIndicator(
            entropy = entropy,
            strength = strength,
            showEntropyValue = true
        )

        // Description
        Text(
            text = description,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall
        )
    }
}

/**
 * Retourne une description textuelle pour un niveau de force
 */
private fun getStrengthDescription(strength: PasswordStrength): String {
    return when (strength) {
        PasswordStrength.WEAK -> "Cassable en quelques heures. Faible protection."
        PasswordStrength.MEDIUM -> "Cassable en quelques jours. Protection basique."
        PasswordStrength.STRONG -> "Cassable en plusieurs années. Bonne protection."
        PasswordStrength.VERY_STRONG -> "Cassable en plusieurs siècles. Excellente protection."
    }
}

/**
 * Barre de force segmentée (style "force meter")
 * Alternative moderne à la barre de progression linéaire
 */
@Composable
fun SegmentedStrengthBar(
    strength: PasswordStrength,
    modifier: Modifier = Modifier
) {
    val segments = 4
    val (color, _, _) = getStrengthProperties(strength)

    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        repeat(segments) { index ->
            val isActive = index < strength.ordinal + 1

            // Animation de la hauteur pour effet dynamique
            val height by animateDpAsState(
                targetValue = if (isActive) 8.dp else 6.dp,
                animationSpec = tween(durationMillis = 300),
                label = "segmentHeight"
            )

            val animatedColor by animateColorAsState(
                targetValue = if (isActive) color else MaterialTheme.colorScheme.surfaceVariant,
                animationSpec = tween(durationMillis = 300),
                label = "segmentColor"
            )

            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(height)
                    .clip(RoundedCornerShape(3.dp))
                    .background(animatedColor)
            )
        }
    }
}
