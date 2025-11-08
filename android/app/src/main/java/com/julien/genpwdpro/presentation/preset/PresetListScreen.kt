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
import com.julien.genpwdpro.data.models.vault.DecryptedPreset
import kotlinx.coroutines.launch

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
    var searchQuery by remember { mutableStateOf("") }

    // Filtrer les presets selon la recherche
    val filteredSyllablesPresets = remember(uiState.syllablesPresets, searchQuery) {
        if (searchQuery.isBlank()) {
            uiState.syllablesPresets
        } else {
            uiState.syllablesPresets.filter {
                it.name.contains(searchQuery, ignoreCase = true)
            }
        }
    }

    val filteredPassphrasePresets = remember(uiState.passphrasePresets, searchQuery) {
        if (searchQuery.isBlank()) {
            uiState.passphrasePresets
        } else {
            uiState.passphrasePresets.filter {
                it.name.contains(searchQuery, ignoreCase = true)
            }
        }
    }

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
                                    text = "Limite: 15 presets par mode",
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                )
                                Text(
                                    text = "Syllables: ${uiState.syllablesPresets.size}/15 • Passphrase: ${uiState.passphrasePresets.size}/15",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                )
                            }
                        }
                    }
                }

                // Champ de recherche
                item {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Rechercher un preset...") },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = "Rechercher"
                            )
                        },
                        trailingIcon = {
                            if (searchQuery.isNotEmpty()) {
                                IconButton(onClick = { searchQuery = "" }) {
                                    Icon(
                                        imageVector = Icons.Default.Clear,
                                        contentDescription = "Effacer"
                                    )
                                }
                            }
                        },
                        singleLine = true,
                        shape = MaterialTheme.shapes.medium
                    )
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
                            onDelete = { showDeleteDialog = preset },
                            onDuplicate = {
                                viewModel.duplicatePreset(preset)
                                scope.launch {
                                    snackbarHostState.showSnackbar("Preset dupliqué avec succès")
                                }
                            }
                        )
                    }
                }

                // Presets Syllables
                if (filteredSyllablesPresets.isNotEmpty()) {
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
                                text = "${filteredSyllablesPresets.size}/${uiState.syllablesPresets.size}",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    items(filteredSyllablesPresets) { preset ->
                        PresetManagementCard(
                            preset = preset,
                            onSetDefault = { viewModel.setAsDefault(preset.id) },
                            onEdit = { showEditDialog = preset },
                            onDelete = { showDeleteDialog = preset },
                            onDuplicate = {
                                viewModel.duplicatePreset(preset)
                                scope.launch {
                                    snackbarHostState.showSnackbar("Preset dupliqué avec succès")
                                }
                            }
                        )
                    }
                }

                // Presets Passphrase
                if (filteredPassphrasePresets.isNotEmpty()) {
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
                                text = "${filteredPassphrasePresets.size}/${uiState.passphrasePresets.size}",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    items(filteredPassphrasePresets) { preset ->
                        PresetManagementCard(
                            preset = preset,
                            onSetDefault = { viewModel.setAsDefault(preset.id) },
                            onEdit = { showEditDialog = preset },
                            onDelete = { showDeleteDialog = preset },
                            onDuplicate = {
                                viewModel.duplicatePreset(preset)
                                scope.launch {
                                    snackbarHostState.showSnackbar("Preset dupliqué avec succès")
                                }
                            }
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

    // Dialog d'édition
    showEditDialog?.let { preset ->
        var editName by remember { mutableStateOf(preset.name) }
        var editIcon by remember { mutableStateOf(preset.icon) }
        var nameError by remember { mutableStateOf<String?>(null) }

        AlertDialog(
            onDismissRequest = { showEditDialog = null },
            icon = {
                Icon(
                    imageVector = Icons.Default.Edit,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary
                )
            },
            title = { Text("Modifier le preset") },
            text = {
                Column(
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    // Nom du preset
                    OutlinedTextField(
                        value = editName,
                        onValueChange = {
                            editName = it
                            nameError = when {
                                it.isBlank() -> "Le nom ne peut pas être vide"
                                it.length > 50 -> "Le nom ne peut pas dépasser 50 caractères"
                                else -> null
                            }
                        },
                        label = { Text("Nom du preset") },
                        modifier = Modifier.fillMaxWidth(),
                        isError = nameError != null,
                        supportingText = nameError?.let { { Text(it) } },
                        singleLine = true
                    )

                    // Icône
                    OutlinedTextField(
                        value = editIcon,
                        onValueChange = { editIcon = it },
                        label = { Text("Icône (emoji)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        supportingText = { Text("Utilisez un emoji pour représenter ce preset") }
                    )

                    // Aperçu des paramètres (lecture seule)
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(
                                text = "Configuration (non modifiable)",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = preset.settings.toSummary(),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = "Mode: ${preset.generationMode.name}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    if (preset.isSystemPreset) {
                        Text(
                            text = "⚠️ Les presets système ne peuvent pas être modifiés",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val updatedPreset = preset.copy(
                            name = editName.trim(),
                            icon = editIcon.trim(),
                            modifiedAt = System.currentTimeMillis()
                        )
                        viewModel.updatePreset(updatedPreset)
                        showEditDialog = null
                        scope.launch {
                            snackbarHostState.showSnackbar("Preset modifié avec succès")
                        }
                    },
                    enabled = !preset.isSystemPreset && nameError == null && editName.isNotBlank()
                ) {
                    Text("Sauvegarder")
                }
            },
            dismissButton = {
                TextButton(onClick = { showEditDialog = null }) {
                    Text("Annuler")
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
    onDelete: () -> Unit,
    onDuplicate: () -> Unit
) {
    var isExpanded by remember { mutableStateOf(false) }

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
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
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
                Spacer(modifier = Modifier.weight(1f))
                // Bouton pour voir les détails
                TextButton(
                    onClick = { isExpanded = !isExpanded }
                ) {
                    Text(
                        text = if (isExpanded) "Masquer" else "Détails",
                        style = MaterialTheme.typography.labelSmall
                    )
                    Icon(
                        imageVector = if (isExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                        contentDescription = if (isExpanded) "Masquer les détails" else "Voir les détails",
                        modifier = Modifier.size(16.dp)
                    )
                }
            }

            // Section expandable des détails
            androidx.compose.animation.AnimatedVisibility(visible = isExpanded) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                    )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = "Configuration complète",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )

                        DetailRow(label = "Mode", value = preset.generationMode.name)

                        when (preset.generationMode) {
                            GenerationMode.SYLLABLES -> {
                                DetailRow(label = "Longueur", value = "${preset.settings.syllablesLength} caractères")
                                DetailRow(label = "Politique", value = preset.settings.policy.displayName)
                                DetailRow(label = "Chiffres", value = "${preset.settings.digitsCount}")
                                DetailRow(label = "Placement chiffres", value = preset.settings.placeDigits.displayName)
                                DetailRow(label = "Spéciaux", value = "${preset.settings.specialsCount}")
                                DetailRow(label = "Placement spéciaux", value = preset.settings.placeSpecials.displayName)
                                if (preset.settings.customSpecials.isNotEmpty()) {
                                    DetailRow(label = "Spéciaux personnalisés", value = preset.settings.customSpecials)
                                }
                                DetailRow(label = "Casse", value = preset.settings.caseMode.displayName)
                            }
                            GenerationMode.PASSPHRASE -> {
                                DetailRow(label = "Nombre de mots", value = "${preset.settings.passphraseWordCount}")
                                DetailRow(label = "Dictionnaire", value = preset.settings.dictionary.displayName)
                                DetailRow(label = "Séparateur", value = if (preset.settings.passphraseSeparator.isEmpty()) "Aucun" else preset.settings.passphraseSeparator)
                                DetailRow(label = "Capitaliser", value = if (preset.settings.passphraseCapitalize) "Oui" else "Non")
                            }
                            else -> {}
                        }

                        Divider(modifier = Modifier.padding(vertical = 4.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Créé: ${formatDate(preset.createdAt)}",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = "Modifié: ${formatDate(preset.modifiedAt)}",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
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
                        onClick = onDuplicate,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(
                            imageVector = Icons.Default.ContentCopy,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Dupliquer")
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

/**
 * Composable pour afficher une ligne de détail
 */
@Composable
private fun DetailRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f)
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(1.5f)
        )
    }
}

/**
 * Formatte une date en format court
 */
private fun formatDate(timestamp: Long): String {
    val date = java.util.Date(timestamp)
    val format = java.text.SimpleDateFormat("dd/MM/yyyy", java.util.Locale.getDefault())
    return format.format(date)
}
