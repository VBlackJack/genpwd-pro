package com.julien.genpwdpro.presentation.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * Bottom sheet pour le placement visuel des caractères
 * Optimized: Uses remember to prevent unnecessary recompositions
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlacementBottomSheet(
    digitsPositions: List<Int>,
    specialsPositions: List<Int>,
    digitsCount: Int,
    specialsCount: Int,
    onDigitsPositionsChange: (List<Int>) -> Unit,
    onSpecialsPositionsChange: (List<Int>) -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    val scrollState = androidx.compose.foundation.rememberScrollState()

    // Optimize: Memoize adjusted positions to prevent recomputation
    val adjustedDigitsPositions = remember(digitsPositions, digitsCount) {
        adjustPositionsList(digitsPositions, digitsCount)
    }

    val adjustedSpecialsPositions = remember(specialsPositions, specialsCount) {
        adjustPositionsList(specialsPositions, specialsCount)
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        modifier = modifier,
        containerColor = MaterialTheme.colorScheme.surface
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = Constants.MAX_BOTTOM_SHEET_HEIGHT)
                .verticalScroll(scrollState)
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            // Titre
            Text(
                text = "Placement visuel",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )

            // Positions des chiffres (un slider par chiffre)
            if (digitsCount > 0) {
                PlacementSection(
                    title = "Chiffres ($digitsCount)",
                    positions = adjustedDigitsPositions,
                    onPositionsChange = onDigitsPositionsChange,
                    color = MaterialTheme.colorScheme.primary,
                    labelPrefix = "Chiffre"
                )
            }

            if (digitsCount > 0 && specialsCount > 0) {
                HorizontalDivider()
            }

            // Positions des spéciaux (un slider par spécial)
            if (specialsCount > 0) {
                PlacementSection(
                    title = "Spéciaux ($specialsCount)",
                    positions = adjustedSpecialsPositions,
                    onPositionsChange = onSpecialsPositionsChange,
                    color = MaterialTheme.colorScheme.secondary,
                    labelPrefix = "Spécial"
                )
            }

            // Explication
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            ) {
                Text(
                    text = "💡 Déplacez le curseur pour choisir la position (0% = début, 100% = fin)",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.padding(12.dp)
                )
            }

            // Bouton fermer
            Button(
                onClick = onDismiss,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Appliquer")
            }
        }
    }
}

/**
 * Reusable placement section component
 * Extracts duplicate code for digits and specials sections
 */
@Composable
private fun PlacementSection(
    title: String,
    positions: List<Int>,
    onPositionsChange: (List<Int>) -> Unit,
    color: androidx.compose.ui.graphics.Color,
    labelPrefix: String,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = color
        )

        positions.forEachIndexed { index, position ->
            PlacementSlider(
                label = "$labelPrefix ${index + 1}",
                position = position,
                onPositionChange = { newPos ->
                    val newPositions = positions.toMutableList()
                    newPositions[index] = newPos
                    onPositionsChange(newPositions)
                },
                color = color
            )
        }
    }
}

/**
 * Adjust positions list to match target count
 * Extracts duplicate logic for digits and specials
 */
private fun adjustPositionsList(
    positions: List<Int>,
    targetCount: Int,
    defaultValue: Int = Constants.DEFAULT_POSITION_PERCENT
): List<Int> = when {
    positions.size < targetCount ->
        positions + List(targetCount - positions.size) { defaultValue }
    positions.size > targetCount ->
        positions.take(targetCount)
    else ->
        positions
}

@Composable
private fun PlacementSlider(
    label: String,
    position: Int,
    onPositionChange: (Int) -> Unit,
    color: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium
            )
            Badge(
                containerColor = color.copy(alpha = 0.2f),
                contentColor = color
            ) {
                Text(
                    text = "$position%",
                    style = MaterialTheme.typography.labelLarge,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                )
            }
        }

        Slider(
            value = position.toFloat(),
            onValueChange = { onPositionChange(it.toInt()) },
            valueRange = 0f..100f,
            steps = Constants.SLIDER_STEPS, // 10% increments
            colors = SliderDefaults.colors(
                thumbColor = color,
                activeTrackColor = color,
                inactiveTrackColor = color.copy(alpha = 0.3f)
            )
        )

        // Labels de position
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Début",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = "Milieu",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = "Fin",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Constants for PlacementBottomSheet
 * Extracts magic numbers for better maintainability
 */
private object Constants {
    const val DEFAULT_POSITION_PERCENT = 50
    val MAX_BOTTOM_SHEET_HEIGHT = 600.dp
    const val SLIDER_STEPS = 9 // 10% increments (0, 10, 20, ..., 100)
}
