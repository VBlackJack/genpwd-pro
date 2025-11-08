package com.julien.genpwdpro.presentation.preset

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.julien.genpwdpro.data.models.GenerationMode
import com.julien.genpwdpro.data.models.vault.DecryptedPreset

/**
 * Composant de sélection de preset
 * Affiche un bouton qui ouvre un BottomSheet avec la liste des presets
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PresetSelector(
    currentPreset: DecryptedPreset?,
    presets: List<DecryptedPreset>,
    onPresetSelected: (DecryptedPreset) -> Unit,
    onCreatePreset: () -> Unit,
    onEditPreset: ((DecryptedPreset) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    var showBottomSheet by remember { mutableStateOf(false) }

    // Bouton de sélection du preset actuel
    OutlinedButton(
        onClick = { showBottomSheet = true },
        modifier = modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = currentPreset?.icon ?: "🔐",
                    style = MaterialTheme.typography.titleMedium
                )
                Text(
                    text = currentPreset?.name ?: "Sélectionner un preset",
                    style = MaterialTheme.typography.bodyLarge
                )
                if (currentPreset?.isDefault == true) {
                    Icon(
                        imageVector = Icons.Default.Star,
                        contentDescription = "Par défaut",
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }
            Icon(
                imageVector = Icons.Default.ArrowDropDown,
                contentDescription = "Ouvrir sélecteur"
            )
        }
    }

    // BottomSheet de sélection
    if (showBottomSheet) {
        ModalBottomSheet(
            onDismissRequest = { showBottomSheet = false }
        ) {
            PresetListContent(
                presets = presets,
                currentPresetId = currentPreset?.id,
                onPresetSelected = {
                    onPresetSelected(it)
                    showBottomSheet = false
                },
                onCreatePreset = {
                    onCreatePreset()
                    showBottomSheet = false
                },
                onEditPreset = onEditPreset?.let { callback ->
                    { preset ->
                        callback(preset)
                        showBottomSheet = false
                    }
                }
            )
        }
    }
}

/**
 * Contenu de la liste des presets
 */
@Composable
private fun PresetListContent(
    presets: List<DecryptedPreset>,
    currentPresetId: String?,
    onPresetSelected: (DecryptedPreset) -> Unit,
    onCreatePreset: () -> Unit,
    onEditPreset: ((DecryptedPreset) -> Unit)? = null
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(max = 500.dp)
            .padding(bottom = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // En-tête
        item {
            Text(
                text = "Sélectionner un preset",
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )
        }

        // Preset par défaut en premier
        val defaultPreset = presets.firstOrNull { it.isDefault }
        if (defaultPreset != null) {
            item {
                PresetItem(
                    preset = defaultPreset,
                    isSelected = defaultPreset.id == currentPresetId,
                    onClick = { onPresetSelected(defaultPreset) },
                    onEdit = onEditPreset?.let { { onEditPreset(defaultPreset) } }
                )
            }
            item {
                Divider(modifier = Modifier.padding(horizontal = 16.dp))
            }
        }

        // Presets Syllables
        val syllablesPresets = presets.filter {
            it.generationMode == GenerationMode.SYLLABLES && !it.isSystemPreset
        }
        if (syllablesPresets.isNotEmpty()) {
            item {
                Text(
                    text = "Syllables",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                )
            }
            items(syllablesPresets) { preset ->
                PresetItem(
                    preset = preset,
                    isSelected = preset.id == currentPresetId,
                    onClick = { onPresetSelected(preset) },
                    onEdit = onEditPreset?.let { { onEditPreset(preset) } }
                )
            }
        }

        // Presets Passphrase
        val passphrasePresets = presets.filter {
            it.generationMode == GenerationMode.PASSPHRASE && !it.isSystemPreset
        }
        if (passphrasePresets.isNotEmpty()) {
            item {
                Text(
                    text = "Passphrase",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                )
            }
            items(passphrasePresets) { preset ->
                PresetItem(
                    preset = preset,
                    isSelected = preset.id == currentPresetId,
                    onClick = { onPresetSelected(preset) },
                    onEdit = onEditPreset?.let { { onEditPreset(preset) } }
                )
            }
        }

        // Bouton créer preset
        item {
            Divider(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
            TextButton(
                onClick = onCreatePreset,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Créer un preset")
            }
        }
    }
}

/**
 * Item de preset dans la liste
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PresetItem(
    preset: DecryptedPreset,
    isSelected: Boolean,
    onClick: () -> Unit,
    onEdit: (() -> Unit)? = null
) {
    Card(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) {
                MaterialTheme.colorScheme.primaryContainer
            } else {
                MaterialTheme.colorScheme.surface
            }
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                // Icône
                Text(
                    text = preset.icon,
                    style = MaterialTheme.typography.headlineSmall
                )

                // Nom et détails
                Column {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = preset.name,
                            style = MaterialTheme.typography.titleMedium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        if (preset.isDefault) {
                            Icon(
                                imageVector = Icons.Default.Star,
                                contentDescription = "Par défaut",
                                modifier = Modifier.size(14.dp),
                                tint = MaterialTheme.colorScheme.primary
                            )
                        }
                        if (preset.isSystemPreset) {
                            Icon(
                                imageVector = Icons.Default.Lock,
                                contentDescription = "Système",
                                modifier = Modifier.size(14.dp),
                                tint = MaterialTheme.colorScheme.outline
                            )
                        }
                    }

                    // Résumé des paramètres
                    Text(
                        text = preset.settings.toSummary(),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            // Actions
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Bouton éditer (si non-système et callback fourni)
                if (!preset.isSystemPreset && onEdit != null) {
                    FilledTonalIconButton(
                        onClick = onEdit,
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Edit,
                            contentDescription = "Éditer",
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                // Checkmark si sélectionné
                if (isSelected) {
                    Icon(
                        imageVector = Icons.Default.Check,
                        contentDescription = "Sélectionné",
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }
    }
}

/**
 * Extension pour générer un résumé des settings
 */
private fun com.julien.genpwdpro.data.models.Settings.toSummary(): String {
    return when (mode) {
        GenerationMode.SYLLABLES -> {
            "$syllablesLength chars • $digitsCount chiffres • $specialsCount spéciaux"
        }
        GenerationMode.PASSPHRASE -> {
            "$passphraseWordCount mots • ${dictionary.displayName}"
        }
        else -> mode.name
    }
}
