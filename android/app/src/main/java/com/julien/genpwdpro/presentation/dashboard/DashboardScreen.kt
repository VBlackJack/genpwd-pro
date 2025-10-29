package com.julien.genpwdpro.presentation.dashboard

import androidx.compose.animation.ExperimentalAnimationApi
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.with
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import androidx.hilt.navigation.compose.hiltViewModel
import com.julien.genpwdpro.R
import com.julien.genpwdpro.data.db.entity.VaultRegistryEntry
import com.julien.genpwdpro.presentation.security.BiometricGate
import com.julien.genpwdpro.presentation.util.ClipboardUtils
import kotlinx.coroutines.launch
import kotlin.math.max

/**
 * Dashboard unifié - Page d'accueil de l'application
 *
 * Features:
 * - Générateur rapide intégré
 * - Aperçu des coffres récents
 * - Outils rapides (Analyser, Historique, Phrases personnalisées)
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalAnimationApi::class)
@Composable
fun DashboardScreen(
    onNavigateToVault: (String) -> Unit,
    onNavigateToVaultList: (String) -> Unit,
    onNavigateToVaultManager: () -> Unit,
    onNavigateToHistory: () -> Unit,
    onNavigateToAnalyzer: () -> Unit,
    onNavigateToCustomPhrase: () -> Unit,
    onNavigateToPresetManager: (String) -> Unit,
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val requireBiometric by viewModel.requireBiometricForSensitiveActions.collectAsState()
    val clipboardTtlMs by viewModel.clipboardTtlMs.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val biometricPromptTitle = context.getString(R.string.biometric_prompt_title)
    val biometricRequiredMessage = context.getString(R.string.biometric_required_message)
    val biometricUnavailableMessage = context.getString(R.string.biometric_unavailable_message)

    fun performSensitiveAction(action: () -> Unit) {
        if (!requireBiometric) {
            action()
            return
        }
        val activity = context as? FragmentActivity
        if (activity != null) {
            BiometricGate.prompt(
                activity = activity,
                title = biometricPromptTitle,
                onSuccess = action,
                onFail = {
                    scope.launch {
                        snackbarHostState.showSnackbar(biometricRequiredMessage)
                    }
                }
            )
        } else {
            scope.launch {
                snackbarHostState.showSnackbar(biometricUnavailableMessage)
            }
        }
    }

    LaunchedEffect(Unit) {
        viewModel.loadQuickPassword()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "GenPwd Pro",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors()
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
                            performSensitiveAction {
                                ClipboardUtils.copySensitive(
                                    context = context,
                                    label = "password",
                                    value = password,
                                    ttlMs = clipboardTtlMs
                                )
                                scope.launch {
                                    val message = ClipboardUtils.buildAutoClearMessage(context, clipboardTtlMs)
                                    snackbarHostState.showSnackbar(message)
                                }
                            }
                        }
                    }
                )
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

            // Section Coffres récents
            item {
                SectionHeader(
                    title = "Coffres-forts",
                    subtitle = if (uiState.vaults.isEmpty()) {
                        "Créez votre premier coffre pour sécuriser vos mots de passe"
                    } else {
                        "Déverrouillez un coffre pour enregistrer vos mots de passe"
                    },
                    icon = Icons.Default.Lock
                )
            }

            if (uiState.vaults.isEmpty()) {
                item {
                    VaultsEmptyStateCard(onCreateVault = onNavigateToVaultManager)
                }
            } else {
                items(
                    items = uiState.vaults.take(3),
                    key = { it.id }
                ) { vault ->
                    VaultOverviewCard(
                        vault = vault,
                        isDefault = vault.id == uiState.defaultVaultId,
                        isActive = vault.id == uiState.activeVaultId,
                        onOpen = {
                            if (vault.id == uiState.activeVaultId) {
                                onNavigateToVaultList(vault.id)
                            } else {
                                onNavigateToVault(vault.id)
                            }
                        },
                        onManage = onNavigateToVaultManager
                    )
                }

                if (uiState.vaults.size > 3) {
                    item {
                        TextButton(onClick = onNavigateToVaultManager) {
                            Text("Voir tous les coffres")
                        }
                    }
                }
            }

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
            icon = Icons.Default.Security,
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
            icon = Icons.Default.Key,
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

@Composable
private fun VaultOverviewCard(
    vault: VaultRegistryEntry,
    isDefault: Boolean,
    isActive: Boolean,
    onOpen: () -> Unit,
    onManage: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
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
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = vault.name,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        if (isDefault) {
                            AssistChip(
                                onClick = {},
                                label = { Text("Défaut") },
                                leadingIcon = {
                                    Icon(
                                        imageVector = Icons.Default.Home,
                                        contentDescription = null,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            )
                        }
                        if (isActive) {
                            AssistChip(
                                onClick = {},
                                label = { Text("Déverrouillé") },
                                leadingIcon = {
                                    Icon(
                                        imageVector = Icons.Default.CheckCircle,
                                        contentDescription = null,
                                        modifier = Modifier.size(16.dp)
                                    )
                                },
                                colors = AssistChipDefaults.assistChipColors(
                                    containerColor = MaterialTheme.colorScheme.tertiaryContainer
                                )
                            )
                        }
                    }

                    vault.description?.takeIf { it.isNotBlank() }?.let { description ->
                        Text(
                            text = description,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                VaultInfoRow(
                    icon = Icons.Default.Storage,
                    label = "${vault.statistics.entryCount} entrée${if (vault.statistics.entryCount > 1) "s" else ""}"
                )
                VaultInfoRow(
                    icon = Icons.Default.History,
                    label = formatRelativeTime(vault.lastAccessed ?: vault.createdAt)
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Button(
                    onClick = onOpen,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = if (isActive) Icons.Default.CheckCircle else Icons.Default.Lock,
                        contentDescription = null
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(if (isActive) "Continuer" else "Déverrouiller")
                }

                OutlinedButton(
                    onClick = onManage,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.Storage, contentDescription = null)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Gérer")
                }
            }
        }
    }
}

@Composable
private fun VaultInfoRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(16.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun VaultsEmptyStateCard(
    onCreateVault: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = Icons.Default.Lock,
                contentDescription = null,
                modifier = Modifier.size(48.dp),
                tint = MaterialTheme.colorScheme.onSecondaryContainer
            )
            Text(
                text = "Aucun coffre enregistré",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSecondaryContainer
            )
            Text(
                text = "Créez un coffre-fort pour conserver vos mots de passe en toute sécurité.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSecondaryContainer,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
            Button(onClick = onCreateVault) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Créer un coffre")
            }
        }
    }
}

private fun formatRelativeTime(timestamp: Long): String {
    val now = System.currentTimeMillis()
    val diff = max(now - timestamp, 0L)
    val minute = 60_000L
    val hour = 60 * minute
    val day = 24 * hour
    val week = 7 * day

    return when {
        diff < minute -> "À l'instant"
        diff < hour -> "Il y a ${diff / minute} min"
        diff < day -> "Il y a ${diff / hour} h"
        diff < week -> "Il y a ${diff / day} j"
        else -> "Il y a ${diff / week} sem"
    }
}
