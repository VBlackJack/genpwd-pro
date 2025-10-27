package com.julien.genpwdpro.presentation.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.julien.genpwdpro.data.models.GenerationMode
import com.julien.genpwdpro.presentation.components.*
import com.julien.genpwdpro.presentation.utils.ClipboardUtils
import kotlinx.coroutines.launch

/**
 * Écran principal de génération de mots de passe
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GeneratorScreen(
    onNavigateToHistory: () -> Unit = {},
    onNavigateToAnalyzer: () -> Unit = {},
    onNavigateToCustomPhrase: () -> Unit = {},
    onNavigateToSyncSettings: () -> Unit = {},
    onNavigateToSecurity: () -> Unit = {},
    onSaveToVault: ((String) -> Unit)? = null,
    onNavigateToPresetManager: () -> Unit = {},
    vaultId: String? = null,
    viewModel: GeneratorViewModel = hiltViewModel(),
    initialMode: String? = null,
    autoGenerate: Boolean = false
) {
    val uiState by viewModel.uiState.collectAsState()
    val currentPreset by viewModel.currentPreset.collectAsState()
    val presets by viewModel.presets.collectAsState()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    var showPlacementSheet by remember { mutableStateOf(false) }
    var showSavePresetDialog by remember { mutableStateOf(false) }

    // Charger les presets si un vaultId est fourni
    LaunchedEffect(vaultId) {
        vaultId?.let {
            viewModel.loadPresets(it)
        }
    }

    // Fonction helper pour gérer les navigations qui peuvent échouer
    fun safeNavigate(action: () -> Unit, featureName: String) {
        try {
            action()
        } catch (e: Exception) {
            scope.launch {
                snackbarHostState.showSnackbar(
                    message = "$featureName - Fonctionnalité à venir",
                    duration = SnackbarDuration.Short
                )
            }
        }
    }

    // Gérer le mode initial et la génération automatique depuis les raccourcis
    LaunchedEffect(initialMode, autoGenerate) {
        initialMode?.let { modeString ->
            try {
                val mode = GenerationMode.valueOf(modeString)
                viewModel.updateSettings { it.copy(mode = mode) }

                if (autoGenerate) {
                    viewModel.generatePasswords()
                }
            } catch (e: IllegalArgumentException) {
                // Mode invalide, ignorer
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "GenPwd Pro",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Générateur de mots de passe sécurisés",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                actions = {
                    IconButton(onClick = {
                        safeNavigate(onNavigateToSyncSettings, "Synchronisation Cloud")
                    }) {
                        Icon(
                            imageVector = Icons.Default.Settings,
                            contentDescription = "Synchronisation Cloud",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                    IconButton(onClick = {
                        safeNavigate(onNavigateToSecurity, "Sécurité")
                    }) {
                        Icon(
                            imageVector = Icons.Default.Shield,
                            contentDescription = "Sécurité",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                    IconButton(onClick = {
                        safeNavigate(onNavigateToCustomPhrase, "Phrases personnalisées")
                    }) {
                        Icon(
                            imageVector = Icons.Default.Edit,
                            contentDescription = "Phrases personnalisées",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                    IconButton(onClick = {
                        safeNavigate(onNavigateToAnalyzer, "Analyseur")
                    }) {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = "Analyseur",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                    IconButton(onClick = {
                        safeNavigate(onNavigateToHistory, "Historique")
                    }) {
                        Icon(
                            imageVector = Icons.Default.History,
                            contentDescription = "Historique",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { viewModel.generatePasswords() },
                icon = { Icon(Icons.Default.Lock, "Generate") },
                text = { Text("Générer") },
                containerColor = MaterialTheme.colorScheme.primary
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Sélecteur de preset
            if (vaultId != null && presets.isNotEmpty()) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer
                        )
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Preset",
                                    style = MaterialTheme.typography.labelLarge,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                )
                                TextButton(
                                    onClick = {
                                        safeNavigate(onNavigateToPresetManager, "Gestion des presets")
                                    }
                                ) {
                                    Text("Gérer")
                                }
                            }

                            com.julien.genpwdpro.presentation.preset.PresetSelector(
                                currentPreset = currentPreset,
                                presets = presets,
                                onPresetSelected = { preset ->
                                    viewModel.selectPreset(preset)
                                },
                                onCreatePreset = {
                                    showSavePresetDialog = true
                                }
                            )
                        }
                    }
                }
            }

            // Bouton "Sauvegarder comme preset" si vault déverrouillé
            if (vaultId != null) {
                item {
                    OutlinedButton(
                        onClick = { showSavePresetDialog = true },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(
                            imageVector = Icons.Default.Save,
                            contentDescription = null,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Sauvegarder comme preset")
                    }
                }
            }

            // Section Options principales
            item {
                ExpandableSection(
                    title = "Options principales",
                    expanded = uiState.expandedSections.contains(Section.MAIN_OPTIONS),
                    onToggle = { viewModel.toggleSection(Section.MAIN_OPTIONS) }
                ) {
                    MainOptionsSection(
                        settings = uiState.settings,
                        onSettingsChange = { newSettings ->
                            viewModel.updateSettings { newSettings }
                        }
                    )
                }
            }

            // Section Caractères
            item {
                ExpandableSection(
                    title = "Caractères",
                    badge = "${uiState.settings.digitsCount}D + ${uiState.settings.specialsCount}S",
                    expanded = uiState.expandedSections.contains(Section.CHARACTERS),
                    onToggle = { viewModel.toggleSection(Section.CHARACTERS) }
                ) {
                    CharactersSection(
                        settings = uiState.settings,
                        onSettingsChange = { newSettings ->
                            viewModel.updateSettings { newSettings }
                        },
                        onOpenPlacementSheet = { showPlacementSheet = true }
                    )
                }
            }

            // Section Casse avancée
            item {
                ExpandableSection(
                    title = "Casse avancée",
                    expanded = uiState.expandedSections.contains(Section.CASING),
                    onToggle = { viewModel.toggleSection(Section.CASING) }
                ) {
                    CasingSection(
                        settings = uiState.settings,
                        onSettingsChange = { newSettings ->
                            viewModel.updateSettings { newSettings }
                        }
                    )
                }
            }

            // Paramètres de résultats
            item {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        SettingsSlider(
                            label = "Nombre de mots de passe",
                            value = uiState.settings.quantity,
                            valueRange = 1..20,
                            onValueChange = { newQuantity ->
                                viewModel.updateSettings { it.copy(quantity = newQuantity) }
                            }
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Masquer l'affichage",
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Switch(
                                checked = uiState.settings.maskDisplay,
                                onCheckedChange = {
                                    viewModel.updateSettings { settings ->
                                        settings.copy(maskDisplay = it)
                                    }
                                }
                            )
                        }
                    }
                }
            }

            // État de chargement
            if (uiState.isGenerating) {
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
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                            Text(
                                text = "Génération en cours...",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                        }
                    }
                }
            }

            // Erreur
            uiState.error?.let { error ->
                item {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer
                        )
                    ) {
                        Text(
                            text = "❌ $error",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            modifier = Modifier.padding(16.dp)
                        )
                    }
                }
            }

            // Résultats
            if (uiState.results.isEmpty() && !uiState.isGenerating) {
                item {
                    EmptyState()
                }
            } else {
                items(uiState.results, key = { it.id }) { result ->
                    PasswordCard(
                        result = result,
                        onCopy = {
                            // Copie sécurisée avec auto-effacement après 60s
                            ClipboardUtils.copyWithTimeout(
                                context = context,
                                text = result.password,
                                showToast = false
                            )
                            // Afficher snackbar
                            kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch {
                                snackbarHostState.showSnackbar("Copié ! Auto-effacement dans 60s")
                            }
                        },
                        onToggleMask = { viewModel.toggleMask(result.id) },
                        onSave = if (onSaveToVault != null) {
                            { onSaveToVault(result.password) }
                        } else {
                            {
                                scope.launch {
                                    snackbarHostState.showSnackbar(
                                        message = "Déverrouillez d'abord un coffre-fort pour sauvegarder",
                                        duration = SnackbarDuration.Short
                                    )
                                }
                            }
                        }
                    )
                }
            }

            // Espace pour le FAB
            item {
                Spacer(modifier = Modifier.height(80.dp))
            }
        }
    }

    // Bottom sheet de placement
    if (showPlacementSheet) {
        PlacementBottomSheet(
            digitsPosition = uiState.settings.digitsPosition,
            specialsPosition = uiState.settings.specialsPosition,
            onDigitsPositionChange = {
                viewModel.updateSettings { settings ->
                    settings.copy(digitsPosition = it)
                }
            },
            onSpecialsPositionChange = {
                viewModel.updateSettings { settings ->
                    settings.copy(specialsPosition = it)
                }
            },
            onDismiss = { showPlacementSheet = false }
        )
    }

    // Dialog de sauvegarde de preset
    if (showSavePresetDialog) {
        SavePresetDialog(
            currentMode = uiState.settings.mode,
            onDismiss = { showSavePresetDialog = false },
            onSave = { name, icon, setAsDefault ->
                viewModel.saveAsPreset(name, icon, setAsDefault)
                showSavePresetDialog = false
                scope.launch {
                    snackbarHostState.showSnackbar("Preset '$name' créé !")
                }
            }
        )
    }
}

/**
 * Dialog de sauvegarde d'un preset
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SavePresetDialog(
    currentMode: GenerationMode,
    onDismiss: () -> Unit,
    onSave: (name: String, icon: String, setAsDefault: Boolean) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var selectedIcon by remember { mutableStateOf("🔐") }
    var setAsDefault by remember { mutableStateOf(false) }

    val availableIcons = listOf(
        "🔐", "🔒", "🔑", "🛡️", "⚡",
        "🏦", "💳", "📱", "🌐", "📧",
        "🎲", "⭐", "🔥", "💎", "🚀"
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text("Sauvegarder comme preset")
        },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Mode actuel
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Info,
                            contentDescription = null,
                            modifier = Modifier.size(20.dp)
                        )
                        Text(
                            text = "Mode: ${currentMode.name}",
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }

                // Nom du preset
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nom du preset") },
                    placeholder = { Text("Ex: Login Fort, WiFi Simple") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                // Sélection d'icône
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "Icône",
                        style = MaterialTheme.typography.labelMedium
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        availableIcons.take(5).forEach { icon ->
                            FilterChip(
                                selected = selectedIcon == icon,
                                onClick = { selectedIcon = icon },
                                label = { Text(icon, style = MaterialTheme.typography.titleLarge) }
                            )
                        }
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        availableIcons.drop(5).take(5).forEach { icon ->
                            FilterChip(
                                selected = selectedIcon == icon,
                                onClick = { selectedIcon = icon },
                                label = { Text(icon, style = MaterialTheme.typography.titleLarge) }
                            )
                        }
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        availableIcons.drop(10).forEach { icon ->
                            FilterChip(
                                selected = selectedIcon == icon,
                                onClick = { selectedIcon = icon },
                                label = { Text(icon, style = MaterialTheme.typography.titleLarge) }
                            )
                        }
                    }
                }

                // Définir par défaut
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Définir par défaut",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Switch(
                        checked = setAsDefault,
                        onCheckedChange = { setAsDefault = it }
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isNotBlank()) {
                        onSave(name.trim(), selectedIcon, setAsDefault)
                    }
                },
                enabled = name.isNotBlank()
            ) {
                Text("Sauvegarder")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Annuler")
            }
        }
    )
}

@Composable
private fun EmptyState() {
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
                text = "🔐",
                style = MaterialTheme.typography.displayLarge
            )
            Text(
                text = "Cliquez sur \"Générer\" pour créer vos mots de passe",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
