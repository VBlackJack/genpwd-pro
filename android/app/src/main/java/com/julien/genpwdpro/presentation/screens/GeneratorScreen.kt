package com.julien.genpwdpro.presentation.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.julien.genpwdpro.presentation.components.*

/**
 * Écran principal de génération de mots de passe
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GeneratorScreen(
    viewModel: GeneratorViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }

    var showPlacementSheet by remember { mutableStateOf(false) }

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
            // Section Options principales
            item {
                ExpandableSection(
                    title = "Options principales",
                    expanded = uiState.expandedSections.contains(Section.MAIN_OPTIONS),
                    onToggle = { viewModel.toggleSection(Section.MAIN_OPTIONS) }
                ) {
                    MainOptionsSection(
                        settings = uiState.settings,
                        onSettingsChange = { viewModel.updateSettings { it.copy() } }
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
                        onSettingsChange = { viewModel.updateSettings { it.copy() } },
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
                        onSettingsChange = { viewModel.updateSettings { it.copy() } }
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
                            onValueChange = {
                                viewModel.updateSettings { it.copy(quantity = it.quantity) }
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
                            copyToClipboard(context, result.password)
                            // Afficher snackbar
                            kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch {
                                snackbarHostState.showSnackbar("Copié !")
                            }
                        },
                        onToggleMask = { viewModel.toggleMask(result.id) }
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

private fun copyToClipboard(context: Context, text: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val clip = ClipData.newPlainText("password", text)
    clipboard.setPrimaryClip(clip)
}

// Import kotlinx.coroutines
import kotlinx.coroutines.launch
