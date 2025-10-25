package com.julien.genpwdpro.presentation.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * Bottom sheet pour le placement visuel des caractères
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlacementBottomSheet(
    digitsPosition: Int,
    specialsPosition: Int,
    onDigitsPositionChange: (Int) -> Unit,
    onSpecialsPositionChange: (Int) -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        modifier = modifier,
        containerColor = MaterialTheme.colorScheme.surface
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            // Titre
            Text(
                text = "Placement visuel",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )

            // Position des chiffres
            PlacementSlider(
                label = "Position des chiffres",
                position = digitsPosition,
                onPositionChange = onDigitsPositionChange,
                color = MaterialTheme.colorScheme.primary
            )

            Divider()

            // Position des spéciaux
            PlacementSlider(
                label = "Position des spéciaux",
                position = specialsPosition,
                onPositionChange = onSpecialsPositionChange,
                color = MaterialTheme.colorScheme.secondary
            )

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
            steps = 9, // 10% increments
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
