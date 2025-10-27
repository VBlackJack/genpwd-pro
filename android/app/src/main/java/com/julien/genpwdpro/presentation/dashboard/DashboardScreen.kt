package com.julien.genpwdpro.presentation.dashboard

import androidx.compose.animation.*
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.julien.genpwdpro.presentation.utils.ClipboardUtils
import kotlinx.coroutines.launch

/**
 * Dashboard unifié - Page d'accueil de l'application
 *
 * Features:
 * - Générateur rapide intégré
 * - Outils rapides (Analyser, Historique, Phrases personnalisées)
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalAnimationApi::class)
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
