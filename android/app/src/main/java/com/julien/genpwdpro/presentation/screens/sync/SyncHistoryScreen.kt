package com.julien.genpwdpro.presentation.screens.sync

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.julien.genpwdpro.data.sync.SyncStatistics
import java.text.SimpleDateFormat
import java.util.*

/**
 * Écran d'historique de synchronisation
 *
 * Affiche:
 * - Statistiques globales de synchronisation
 * - Liste des synchronisations récentes
 * - Détails de chaque synchronisation
 * - Erreurs et conflits
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SyncHistoryScreen(
    onNavigateBack: () -> Unit,
    viewModel: VaultSyncViewModel = hiltViewModel()
) {
    // Récupère les statistiques de synchronisation
    val statistics = remember { viewModel.getSyncStatistics() }

    // Pour l'instant, l'historique détaillé n'est pas encore implémenté
    // Il sera ajouté dans une future mise à jour
    val history: List<SyncHistoryEntry> = emptyList()
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Historique de Synchronisation") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, "Retour")
                    }
                },
                actions = {
                    IconButton(onClick = { /* TODO: Filter/Search */ }) {
                        Icon(Icons.Default.FilterList, "Filtrer")
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Statistics Summary
            item {
                StatisticsCard(statistics)
            }

            // Success Rate Chart
            item {
                SuccessRateCard(statistics)
            }

            // Recent Sync Header
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Synchronisations Récentes",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    if (history.isNotEmpty()) {
                        Text(
                            text = "${history.size} entrées",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            // History List
            if (history.isEmpty()) {
                item {
                    EmptyHistoryCard()
                }
            } else {
                items(history) { entry ->
                    SyncHistoryEntryCard(entry)
                }
            }
        }
    }
}

/**
 * Carte de statistiques globales
 */
@Composable
private fun StatisticsCard(statistics: SyncStatistics) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "Statistiques",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Total Syncs
                StatisticItem(
                    value = statistics.totalSyncs.toString(),
                    label = "Total",
                    icon = Icons.Default.Sync,
                    color = Color(0xFF2196F3),
                    modifier = Modifier.weight(1f)
                )

                // Successful
                StatisticItem(
                    value = statistics.successfulSyncs.toString(),
                    label = "Réussies",
                    icon = Icons.Default.CheckCircle,
                    color = Color(0xFF4CAF50),
                    modifier = Modifier.weight(1f)
                )

                // Failed
                StatisticItem(
                    value = statistics.failedSyncs.toString(),
                    label = "Échouées",
                    icon = Icons.Default.Error,
                    color = Color(0xFFFF5252),
                    modifier = Modifier.weight(1f)
                )
            }

            // Last Error (if any)
            if (statistics.lastError != null) {
                Divider()
                LastErrorSection(statistics.lastError, statistics.lastErrorTimestamp)
            }
        }
    }
}

/**
 * Item statistique individuel
 */
@Composable
private fun StatisticItem(
    value: String,
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    color: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = color.copy(alpha = 0.1f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                icon,
                contentDescription = null,
                tint = color,
                modifier = Modifier.size(24.dp)
            )
            Text(
                text = value,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = color
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
 * Section dernière erreur
 */
@Composable
private fun LastErrorSection(error: String, timestamp: Long) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFFFF5252).copy(alpha = 0.1f)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.Warning,
                contentDescription = null,
                tint = Color(0xFFFF5252),
                modifier = Modifier.size(20.dp)
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Dernière erreur",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = error,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFFD32F2F)
                )
                Text(
                    text = formatTimestamp(timestamp),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/**
 * Carte de taux de succès
 */
@Composable
private fun SuccessRateCard(statistics: SyncStatistics) {
    val successRate = statistics.successRate
    val color = when {
        successRate >= 90f -> Color(0xFF4CAF50)
        successRate >= 70f -> Color(0xFFFF9800)
        else -> Color(0xFFFF5252)
    }

    Card {
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
                    text = "Taux de Succès",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "${successRate.toInt()}%",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = color
                )
            }

            LinearProgressIndicator(
                progress = successRate / 100f,
                modifier = Modifier.fillMaxWidth(),
                color = color,
                trackColor = color.copy(alpha = 0.2f)
            )

            Text(
                text = when {
                    successRate >= 90f -> "Excellent! La synchronisation fonctionne parfaitement."
                    successRate >= 70f -> "Bien. Quelques erreurs occasionnelles."
                    statistics.totalSyncs == 0 -> "Aucune synchronisation effectuée pour le moment."
                    else -> "Attention. Plusieurs synchronisations ont échoué."
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Carte d'une entrée d'historique
 */
@Composable
private fun SyncHistoryEntryCard(entry: SyncHistoryEntry) {
    var expanded by remember { mutableStateOf(false) }

    Card(
        onClick = { expanded = !expanded },
        colors = CardDefaults.cardColors(
            containerColor = when (entry.status) {
                SyncHistoryStatus.SUCCESS -> Color(0xFF4CAF50).copy(alpha = 0.05f)
                SyncHistoryStatus.ERROR -> Color(0xFFFF5252).copy(alpha = 0.05f)
                SyncHistoryStatus.CONFLICT -> Color(0xFFFF9800).copy(alpha = 0.05f)
            }
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
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Status Icon
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(
                            when (entry.status) {
                                SyncHistoryStatus.SUCCESS -> Color(0xFF4CAF50).copy(alpha = 0.2f)
                                SyncHistoryStatus.ERROR -> Color(0xFFFF5252).copy(alpha = 0.2f)
                                SyncHistoryStatus.CONFLICT -> Color(0xFFFF9800).copy(alpha = 0.2f)
                            }
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        when (entry.status) {
                            SyncHistoryStatus.SUCCESS -> Icons.Default.CheckCircle
                            SyncHistoryStatus.ERROR -> Icons.Default.Error
                            SyncHistoryStatus.CONFLICT -> Icons.Default.Warning
                        },
                        contentDescription = null,
                        tint = when (entry.status) {
                            SyncHistoryStatus.SUCCESS -> Color(0xFF4CAF50)
                            SyncHistoryStatus.ERROR -> Color(0xFFFF5252)
                            SyncHistoryStatus.CONFLICT -> Color(0xFFFF9800)
                        },
                        modifier = Modifier.size(20.dp)
                    )
                }

                // Info
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = entry.operation,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = formatTimestamp(entry.timestamp),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (entry.vaultName != null) {
                        Text(
                            text = "Vault: ${entry.vaultName}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                // Duration
                if (entry.durationMs != null) {
                    Text(
                        text = "${entry.durationMs}ms",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Expand Icon
                Icon(
                    if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = if (expanded) "Réduire" else "Développer"
                )
            }

            // Expanded Details
            AnimatedVisibility(visible = expanded) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Divider()

                    // Provider
                    DetailRow("Provider", entry.provider)

                    // Size
                    if (entry.sizeBytes != null) {
                        DetailRow("Taille", formatBytes(entry.sizeBytes))
                    }

                    // Changes
                    if (entry.changesCount != null) {
                        DetailRow("Modifications", "${entry.changesCount}")
                    }

                    // Error Message
                    if (entry.errorMessage != null) {
                        Divider()
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = Color(0xFFFF5252).copy(alpha = 0.1f)
                            )
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp)
                            ) {
                                Text(
                                    text = "Erreur",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Color(0xFFD32F2F),
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = entry.errorMessage,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color(0xFFD32F2F)
                                )
                            }
                        }
                    }

                    // Conflict Info
                    if (entry.conflictResolution != null) {
                        Divider()
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = Color(0xFFFF9800).copy(alpha = 0.1f)
                            )
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp)
                            ) {
                                Text(
                                    text = "Conflit résolu",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Color(0xFFF57C00),
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Stratégie: ${entry.conflictResolution}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color(0xFFF57C00)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Row de détail
 */
@Composable
private fun DetailRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium
        )
    }
}

/**
 * Carte d'historique vide
 */
@Composable
private fun EmptyHistoryCard() {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Icon(
                Icons.Default.History,
                contentDescription = null,
                modifier = Modifier.size(64.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
            )
            Text(
                text = "Aucun historique",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Les synchronisations apparaîtront ici",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

// Helper Functions

private fun formatTimestamp(timestamp: Long): String {
    val sdf = SimpleDateFormat("dd/MM/yyyy HH:mm:ss", Locale.getDefault())
    return sdf.format(Date(timestamp))
}

private fun formatBytes(bytes: Long): String {
    return when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> "${bytes / 1024} KB"
        else -> String.format("%.2f MB", bytes / (1024.0 * 1024.0))
    }
}

/**
 * Entrée d'historique de synchronisation
 */
data class SyncHistoryEntry(
    val id: String,
    val timestamp: Long,
    val operation: String,
    val status: SyncHistoryStatus,
    val provider: String,
    val vaultName: String? = null,
    val durationMs: Long? = null,
    val sizeBytes: Long? = null,
    val changesCount: Int? = null,
    val errorMessage: String? = null,
    val conflictResolution: String? = null
)

/**
 * Statut d'une synchronisation
 */
enum class SyncHistoryStatus {
    SUCCESS,
    ERROR,
    CONFLICT
}
