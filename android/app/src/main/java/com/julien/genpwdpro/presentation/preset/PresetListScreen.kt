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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.julien.genpwdpro.data.models.GenerationMode
import com.julien.genpwdpro.data.repository.VaultRepository.DecryptedPreset

/**
 * Écran de gestion des presets
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PresetListScreen(
    vaultId: String,
    onNavigateBack: () -> Unit,
    viewModel: PresetViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    var showDeleteDialog by remember { mutableStateOf<DecryptedPreset?>(null) }
    var showEditDialog by remember { mutableStateOf<DecryptedPreset?>(null) }

    // Charger les presets
    LaunchedEffect(vaultId) {
        viewModel.loadPresets(vaultId)
    }

    // Afficher les erreurs
    LaunchedEffect(uiState.error) {
        uiState.error?.let { error ->
            snackbarHostState.showSnackbar(error)
            viewModel.clearError()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Gestion des Presets",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "${uiState.presets.size} preset(s) disponible(s)",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Retour"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors()
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        if (uiState.isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Info card
                item {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer
                        )
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.Info,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                            Column {
                                Text(
                                    text = "Limite: 3 presets par mode",
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                )
                                Text(
                                    text = "Syllables: ${uiState.syllablesPresets.size}/3 • Passphrase: ${uiState.passphrasePresets.size}/3",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                )
                            }
                        }
                    }
                }

                // Preset par défaut
                uiState.defaultPreset?.let { preset ->
                    item {
                        Text(
                            text = "PRESET PAR DÉFAUT",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(start = 4.dp)
                        )
                    }
                    item {
                        PresetManagementCard(
                            preset = preset,
                            onSetDefault = { /* Already default */ },
                            onEdit = { showEditDialog = preset },
                            onDelete = { showDeleteDialog = preset }
                        )
                    }
                }

                // Presets Syllables
                if (uiState.syllablesPresets.isNotEmpty()) {
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "SYLLABLES",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.padding(start = 4.dp)
                            )
                            Text(
                                text = "${uiState.syllablesPresets.size}/3",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    items(uiState.syllablesPresets) { preset ->
                        PresetManagementCard(
                            preset = preset,
                            onSetDefault = { viewModel.setAsDefault(preset.id) },
                            onEdit = { showEditDialog = preset },
                            onDelete = { showDeleteDialog = preset }
                        )
                    }
                }

                // Presets Passphrase
                if (uiState.passphrasePresets.isNotEmpty()) {
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "PASSPHRASE",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.padding(start = 4.dp)
                            )
                            Text(
                                text = "${uiState.passphrasePresets.size}/3",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    items(uiState.passphrasePresets) { preset ->
                        PresetManagementCard(
                            preset = preset,
                            onSetDefault = { viewModel.setAsDefault(preset.id) },
                            onEdit = { showEditDialog = preset },
                            onDelete = { showDeleteDialog = preset }
                        )
                    }
                }

                // Empty state
                if (uiState.presets.size <= 1) {
                    item {
                        EmptyPresetsState()
                    }
                }

                // Espace pour le bottom padding
                item {
                    Spacer(modifier = Modifier.height(16.dp))
                }
            }
        }
    }

    // Dialog de suppression
    showDeleteDialog?.let { preset ->
        AlertDialog(
            onDismissRequest = { showDeleteDialog = null },
            icon = {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error
                )
            },
            title = { Text("Supprimer le preset ?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Voulez-vous vraiment supprimer le preset :")
                    Text(
                        text = "${preset.icon} ${preset.name}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    if (preset.isSystemPreset) {
                        Text(
                            text = "⚠️ Les presets système ne peuvent pas être supprimés",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.deletePreset(preset.id)
                        showDeleteDialog = null
                        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch {
                            snackbarHostState.showSnackbar("Preset supprimé")
                        }
                    },
                    enabled = !preset.isSystemPreset,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text("Supprimer")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = null }) {
                    Text("Annuler")
                }
            }
        )
    }

    // Dialog d'édition (à implémenter)
    showEditDialog?.let { preset ->
        // TODO: Implémenter le dialog d'édition
        AlertDialog(
            onDismissRequest = { showEditDialog = null },
            title = { Text("Édition de preset") },
            text = {
                Text("Fonctionnalité en cours de développement...")
            },
            confirmButton = {
                TextButton(onClick = { showEditDialog = null }) {
                    Text("OK")
                }
            }
        )
    }
}

/**
 * Card de gestion d'un preset
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PresetManagementCard(
    preset: DecryptedPreset,
    onSetDefault: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Header avec icône et nom
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = preset.icon,
                        style = MaterialTheme.typography.headlineMedium
                    )
                    Column {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = preset.name,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            if (preset.isDefault) {
                                Icon(
                                    imageVector = Icons.Default.Star,
                                    contentDescription = "Par défaut",
                                    modifier = Modifier.size(16.dp),
                                    tint = MaterialTheme.colorScheme.primary
                                )
                            }
                            if (preset.isSystemPreset) {
                                Icon(
                                    imageVector = Icons.Default.Lock,
                                    contentDescription = "Système",
                                    modifier = Modifier.size(16.dp),
                                    tint = MaterialTheme.colorScheme.outline
                                )
                            }
                        }
                        Text(
                            text = preset.settings.toSummary(),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }

            // Statistiques
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                StatChip(
                    icon = Icons.Default.PlayArrow,
                    label = "Utilisé ${preset.usageCount} fois"
                )
                preset.lastUsedAt?.let {
                    val timeAgo = getTimeAgo(it)
                    StatChip(
                        icon = Icons.Default.AccessTime,
                        label = "Il y a $timeAgo"
                    )
                }
            }

            Divider()

            // Actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (!preset.isDefault) {
                    OutlinedButton(
                        onClick = onSetDefault,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Star,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Défaut")
                    }
                }
                if (!preset.isSystemPreset) {
                    OutlinedButton(
                        onClick = onEdit,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Edit,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Éditer")
                    }
                    OutlinedButton(
                        onClick = onDelete,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = MaterialTheme.colorScheme.error
                        )
                    ) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Supprimer")
                    }
                }
            }
        }
    }
}

/**
 * Chip de statistique
 */
@Composable
private fun StatChip(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String
) {
    Surface(
        shape = MaterialTheme.shapes.small,
        color = MaterialTheme.colorScheme.surfaceVariant
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(14.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * État vide
 */
@Composable
private fun EmptyPresetsState() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(48.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "🎨",
                style = MaterialTheme.typography.displayMedium
            )
            Text(
                text = "Créez des presets personnalisés",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Configurez vos paramètres dans le générateur puis sauvegardez-les comme preset pour un accès rapide",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
        }
    }
}

/**
 * Calcule le temps écoulé depuis une date
 */
private fun getTimeAgo(timestamp: Long): String {
    val now = System.currentTimeMillis()
    val diff = now - timestamp
    val seconds = diff / 1000
    val minutes = seconds / 60
    val hours = minutes / 60
    val days = hours / 24

    return when {
        days > 0 -> "$days jour${if (days > 1) "s" else ""}"
        hours > 0 -> "$hours heure${if (hours > 1) "s" else ""}"
        minutes > 0 -> "$minutes min"
        else -> "quelques secondes"
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
