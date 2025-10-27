package com.julien.genpwdpro.presentation.dashboard

import androidx.compose.animation.*
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
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
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.julien.genpwdpro.data.local.entity.VaultEntity
import com.julien.genpwdpro.presentation.utils.ClipboardUtils
import kotlinx.coroutines.launch

/**
 * Dashboard unifié - Page d'accueil de l'application
 *
 * Features:
 * - Générateur rapide intégré
 * - Liste des coffres avec statistiques
 * - Outils rapides (Analyser, Historique, Phrases personnalisées)
 * - Statistiques de sécurité globales
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onNavigateToVault: (String) -> Unit,
    onNavigateToCreateVault: () -> Unit,
    onNavigateToHistory: () -> Unit,
    onNavigateToAnalyzer: () -> Unit,
    onNavigateToCustomPhrase: () -> Unit,
    onNavigateToPresetManager: (String) -> Unit,
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = androidx.compose.ui.platform.LocalContext.current

    LaunchedEffect(Unit) {
        viewModel.loadVaults()
        viewModel.loadQuickPassword()
    }

    Scaffold(
        topBar = {
            LargeTopAppBar(
                title = {
                    Column {
                        Text(
                            text = "GenPwd Pro",
                            style = MaterialTheme.typography.headlineLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Votre gestionnaire de mots de passe sécurisé",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { /* Settings */ }) {
                        Icon(
                            imageVector = Icons.Default.Settings,
                            contentDescription = "Paramètres"
                        )
                    }
                },
                colors = TopAppBarDefaults.largeTopAppBarColors()
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
            // Section Générateur Rapide
            item {
                QuickGeneratorCard(
                    password = uiState.quickPassword,
                    isGenerating = uiState.isGenerating,
                    onGenerate = { viewModel.generateQuickPassword() },
                    onCopy = {
                        uiState.quickPassword?.let { password ->
                            ClipboardUtils.copyWithTimeout(
                                context = context,
                                text = password,
                                showToast = false
                            )
                            scope.launch {
                                snackbarHostState.showSnackbar("Copié ! Auto-effacement dans 60s")
                            }
                        }
                    }
                )
            }

            // Section Mes Coffres
            item {
                SectionHeader(
                    title = "Mes Coffres",
                    subtitle = "${uiState.vaults.size} coffre${if (uiState.vaults.size > 1) "s" else ""}",
                    icon = Icons.Default.Lock
                )
            }

            if (uiState.vaults.isEmpty()) {
                item {
                    EmptyVaultsCard(
                        onCreateVault = onNavigateToCreateVault
                    )
                }
            } else {
                items(uiState.vaults) { vault ->
                    VaultCard(
                        vault = vault,
                        onClick = { onNavigateToVault(vault.id) },
                        onManagePresets = { onNavigateToPresetManager(vault.id) }
                    )
                }
            }

            // Section Outils Rapides
            item {
                SectionHeader(
                    title = "Outils Rapides",
                    icon = Icons.Default.Build
                )
            }

            item {
                QuickToolsRow(
                    onNavigateToAnalyzer = onNavigateToAnalyzer,
                    onNavigateToHistory = onNavigateToHistory,
                    onNavigateToCustomPhrase = onNavigateToCustomPhrase
                )
            }

            // Espace final
            item {
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}

/**
 * Card de générateur rapide
 */
@Composable
private fun QuickGeneratorCard(
    password: String?,
    isGenerating: Boolean,
    onGenerate: () -> Unit,
    onCopy: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "🎲 Générateur Rapide",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Text(
                        text = "Générez instantanément",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }

            // Zone du mot de passe
            AnimatedContent(
                targetState = password,
                transitionSpec = {
                    fadeIn(animationSpec = spring(stiffness = Spring.StiffnessHigh)) with
                            fadeOut(animationSpec = spring(stiffness = Spring.StiffnessHigh))
                },
                label = "password_animation"
            ) { currentPassword ->
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = MaterialTheme.shapes.medium,
                    color = MaterialTheme.colorScheme.surface
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        if (isGenerating) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp)
                            )
                        } else if (currentPassword != null) {
                            Text(
                                text = currentPassword,
                                style = MaterialTheme.typography.titleMedium,
                                fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                                color = MaterialTheme.colorScheme.primary
                            )
                        } else {
                            Text(
                                text = "Aucun mot de passe généré",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }

            // Boutons d'action
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilledTonalButton(
                    onClick = onGenerate,
                    modifier = Modifier.weight(1f),
                    enabled = !isGenerating
                ) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Générer")
                }
                FilledTonalButton(
                    onClick = onCopy,
                    modifier = Modifier.weight(1f),
                    enabled = password != null && !isGenerating
                ) {
                    Icon(
                        imageVector = Icons.Default.ContentCopy,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Copier")
                }
            }
        }
    }
}

/**
 * Header de section
 */
@Composable
private fun SectionHeader(
    title: String,
    subtitle: String? = null,
    icon: androidx.compose.ui.graphics.vector.ImageVector
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(24.dp)
        )
        Column {
            Text(
                text = title,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            subtitle?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/**
 * Card de vault avec statistiques
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun VaultCard(
    vault: VaultEntity,
    onClick: () -> Unit,
    onManagePresets: () -> Unit
) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth()
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
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = vault.icon,
                        style = MaterialTheme.typography.headlineMedium
                    )
                    Column {
                        Text(
                            text = vault.name,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        if (vault.description.isNotEmpty()) {
                            Text(
                                text = vault.description,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = "Ouvrir",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                StatBadge(
                    icon = Icons.Default.Key,
                    label = "${vault.entryCount} entrées"
                )
                if (vault.biometricUnlockEnabled) {
                    StatBadge(
                        icon = Icons.Default.Fingerprint,
                        label = "Biométrie"
                    )
                }
                if (vault.isDefault) {
                    StatBadge(
                        icon = Icons.Default.Star,
                        label = "Par défaut"
                    )
                }
            }

            Divider()

            TextButton(
                onClick = onManagePresets,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(
                    imageVector = Icons.Default.Tune,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text("Gérer les presets")
            }
        }
    }
}

/**
 * Badge de statistique
 */
@Composable
private fun StatBadge(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String
) {
    Surface(
        shape = MaterialTheme.shapes.small,
        color = MaterialTheme.colorScheme.secondaryContainer
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
                tint = MaterialTheme.colorScheme.onSecondaryContainer
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSecondaryContainer
            )
        }
    }
}

/**
 * État vide pour les coffres
 */
@Composable
private fun EmptyVaultsCard(
    onCreateVault: () -> Unit
) {
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
                text = "🏦",
                style = MaterialTheme.typography.displayMedium
            )
            Text(
                text = "Créez votre premier coffre",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Commencez à sécuriser vos mots de passe dans un coffre-fort chiffré",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
            Spacer(modifier = Modifier.height(8.dp))
            Button(onClick = onCreateVault) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = null
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text("Créer un coffre")
            }
        }
    }
}

/**
 * Ligne d'outils rapides
 */
@Composable
private fun QuickToolsRow(
    onNavigateToAnalyzer: () -> Unit,
    onNavigateToHistory: () -> Unit,
    onNavigateToCustomPhrase: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        QuickToolCard(
            icon = Icons.Default.Search,
            label = "Analyser",
            onClick = onNavigateToAnalyzer,
            modifier = Modifier.weight(1f)
        )
        QuickToolCard(
            icon = Icons.Default.History,
            label = "Historique",
            onClick = onNavigateToHistory,
            modifier = Modifier.weight(1f)
        )
        QuickToolCard(
            icon = Icons.Default.Edit,
            label = "Phrases",
            onClick = onNavigateToCustomPhrase,
            modifier = Modifier.weight(1f)
        )
    }
}

/**
 * Card d'outil rapide
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun QuickToolCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        onClick = onClick,
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(32.dp),
                tint = MaterialTheme.colorScheme.onSecondaryContainer
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSecondaryContainer
            )
        }
    }
}
