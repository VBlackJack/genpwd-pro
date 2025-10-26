package com.julien.genpwdpro.presentation.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
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
        // Nombre de chiffres
        SettingsSlider(
            label = "Chiffres",
            value = settings.digitsCount,
            valueRange = Settings.MIN_DIGITS..Settings.MAX_DIGITS,
            onValueChange = { onSettingsChange(settings.copy(digitsCount = it)) }
        )

        // Nombre de spéciaux
        SettingsSlider(
            label = "Spéciaux",
            value = settings.specialsCount,
            valueRange = Settings.MIN_SPECIALS..Settings.MAX_SPECIALS,
            onValueChange = { onSettingsChange(settings.copy(specialsCount = it)) }
        )

        // Caractères spéciaux personnalisés
        OutlinedTextField(
            value = settings.customSpecials,
            onValueChange = { onSettingsChange(settings.copy(customSpecials = it)) },
            label = { Text("Spéciaux personnalisés") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            placeholder = { Text("_+-=.@#%") }
        )

        Divider()

        // Placement des chiffres
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = "Placement chiffres",
                style = MaterialTheme.typography.bodyMedium
            )
            PlacementDropdown(
                selectedPlacement = settings.digitsPlacement,
                onPlacementSelected = { onSettingsChange(settings.copy(digitsPlacement = it)) },
                onOpenVisual = onOpenPlacementSheet
            )
        }

        // Placement des spéciaux
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = "Placement spéciaux",
                style = MaterialTheme.typography.bodyMedium
            )
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

private fun getPlacementLabel(placement: Placement): String = when (placement) {
    Placement.START -> "Début"
    Placement.END -> "Fin"
    Placement.MIDDLE -> "Milieu"
    Placement.RANDOM -> "Aléatoire"
    Placement.VISUAL -> "🎯 Visuel"
}
