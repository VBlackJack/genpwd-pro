package com.julien.genpwdpro.presentation.components

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.julien.genpwdpro.data.models.Placement
import com.julien.genpwdpro.data.models.Settings

/**
 * Section configuration des caractères (chiffres, spéciaux, placement)
 */
@Composable
fun CharactersSection(
    settings: Settings,
    onSettingsChange: (Settings) -> Unit,
    onOpenPlacementSheet: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Groupe: Quantité de caractères
        Card(
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
            )
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Nombre de chiffres
                SettingsSlider(
                    label = "Chiffres",
                    value = settings.digitsCount,
                    valueRange = Settings.MIN_DIGITS..Settings.MAX_DIGITS,
                    onValueChange = { onSettingsChange(settings.copy(digitsCount = it)) },
                    icon = Icons.Default.Tag
                )

                // Nombre de spéciaux
                SettingsSlider(
                    label = "Spéciaux",
                    value = settings.specialsCount,
                    valueRange = Settings.MIN_SPECIALS..Settings.MAX_SPECIALS,
                    onValueChange = { onSettingsChange(settings.copy(specialsCount = it)) },
                    icon = Icons.Default.Star
                )
            }
        }

        // Caractères spéciaux personnalisés
        OutlinedTextField(
            value = settings.customSpecials,
            onValueChange = { onSettingsChange(settings.copy(customSpecials = it)) },
            label = { Text("Spéciaux personnalisés") },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Edit,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary
                )
            },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            placeholder = { Text("_+-=.@#%") },
            supportingText = { Text("Laisser vide pour utiliser les caractères par défaut") }
        )

        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)

        // Groupe: Placement
        Text(
            text = "Placement des caractères",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.primary
        )

        // Placement des chiffres
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Tag,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(18.dp)
                )
                Text(
                    text = "Placement chiffres",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
            }
            PlacementDropdown(
                selectedPlacement = settings.digitsPlacement,
                onPlacementSelected = { onSettingsChange(settings.copy(digitsPlacement = it)) },
                onOpenVisual = onOpenPlacementSheet
            )
        }

        // Placement des spéciaux
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Star,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(18.dp)
                )
                Text(
                    text = "Placement spéciaux",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
            }
            PlacementDropdown(
                selectedPlacement = settings.specialsPlacement,
                onPlacementSelected = { onSettingsChange(settings.copy(specialsPlacement = it)) },
                onOpenVisual = onOpenPlacementSheet
            )
        }
    }
}

@Composable
private fun PlacementDropdown(
    selectedPlacement: Placement,
    onPlacementSelected: (Placement) -> Unit,
    onOpenVisual: () -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded }
    ) {
        OutlinedTextField(
            value = getPlacementLabel(selectedPlacement),
            onValueChange = {},
            readOnly = true,
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
            colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors()
        )

        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            Placement.values().forEach { placement ->
                DropdownMenuItem(
                    text = { Text(getPlacementLabel(placement)) },
                    leadingIcon = {
                        Icon(
                            imageVector = getPlacementIcon(placement),
                            contentDescription = null,
                            tint = if (placement == selectedPlacement)
                                MaterialTheme.colorScheme.primary
                            else
                                MaterialTheme.colorScheme.onSurface
                        )
                    },
                    onClick = {
                        if (placement == Placement.VISUAL) {
                            onOpenVisual()
                        } else {
                            onPlacementSelected(placement)
                        }
                        expanded = false
                    }
                )
            }
        }
    }
}

private fun getPlacementIcon(placement: Placement): ImageVector = when (placement) {
    Placement.START -> Icons.Default.FirstPage
    Placement.END -> Icons.Default.LastPage
    Placement.MIDDLE -> Icons.Default.VerticalAlignCenter
    Placement.RANDOM -> Icons.Default.Shuffle
    Placement.VISUAL -> Icons.Default.Visibility
}

private fun getPlacementLabel(placement: Placement): String = when (placement) {
    Placement.START -> "Début"
    Placement.END -> "Fin"
    Placement.MIDDLE -> "Milieu"
    Placement.RANDOM -> "Aléatoire"
    Placement.VISUAL -> "🎯 Visuel"
}
