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
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.julien.genpwdpro.R
import com.julien.genpwdpro.data.sync.SyncHistoryAction
import com.julien.genpwdpro.data.sync.SyncHistoryEntry
import com.julien.genpwdpro.data.sync.SyncHistoryStatus
import com.julien.genpwdpro.data.sync.SyncStatistics
import com.julien.genpwdpro.data.sync.SyncDataType
import com.julien.genpwdpro.data.sync.models.CloudProviderType
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
    viewModel: SyncHistoryViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val statistics = uiState.statistics ?: SyncStatistics(0, 0, 0, null, 0L)
    val history = uiState.history

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(id = R.string.sync_history_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            Icons.Default.ArrowBack,
                            stringResource(id = R.string.sync_common_back)
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { /* TODO: Filter/Search */ }) {
                        Icon(Icons.Default.FilterList, stringResource(id = R.string.sync_history_filter_cd))
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
            if (uiState.isLoading) {
                item {
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                }
            }

            uiState.errorMessage?.let { errorMessage ->
                item {
                    AssistChip(
                        onClick = { viewModel.refresh() },
                        label = { Text(errorMessage) },
                        leadingIcon = { Icon(Icons.Default.Error, contentDescription = null) }
                    )
                }
            }
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
                        text = stringResource(id = R.string.sync_history_recent_title),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    if (history.isNotEmpty()) {
                        Text(
                            text = stringResource(id = R.string.sync_history_entries_count, history.size),
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
                text = stringResource(id = R.string.sync_history_statistics_title),
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
                    label = stringResource(id = R.string.sync_history_statistics_total),
                    icon = Icons.Default.Sync,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.weight(1f)
                )

                // Successful
                StatisticItem(
                    value = statistics.successfulSyncs.toString(),
                    label = stringResource(id = R.string.sync_history_statistics_success),
                    icon = Icons.Default.CheckCircle,
                    color = MaterialTheme.colorScheme.tertiary,
                    modifier = Modifier.weight(1f)
                )

                // Failed
                StatisticItem(
                    value = statistics.failedSyncs.toString(),
                    label = stringResource(id = R.string.sync_history_statistics_failed),
                    icon = Icons.Default.Error,
                    color = MaterialTheme.colorScheme.error,
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
    val colorScheme = MaterialTheme.colorScheme
    Card(
        colors = CardDefaults.cardColors(
            containerColor = colorScheme.error.copy(alpha = 0.1f)
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
                tint = colorScheme.error,
                modifier = Modifier.size(20.dp)
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = stringResource(id = R.string.sync_history_last_error_title),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = error,
                    style = MaterialTheme.typography.bodySmall,
                    color = colorScheme.error
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
    val colorScheme = MaterialTheme.colorScheme
    val color = when {
        successRate >= 90f -> colorScheme.tertiary
        successRate >= 70f -> colorScheme.secondary
        else -> colorScheme.error
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
                    text = stringResource(id = R.string.sync_history_success_rate_title),
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
                    successRate >= 90f -> stringResource(id = R.string.sync_history_success_rate_message_excellent)
                    successRate >= 70f -> stringResource(id = R.string.sync_history_success_rate_message_good)
                    statistics.totalSyncs == 0 -> stringResource(id = R.string.sync_history_success_rate_message_none)
                    else -> stringResource(id = R.string.sync_history_success_rate_message_warning)
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
                SyncHistoryStatus.SUCCESS -> MaterialTheme.colorScheme.primary.copy(alpha = 0.05f)
                SyncHistoryStatus.ERROR -> MaterialTheme.colorScheme.error.copy(alpha = 0.05f)
                SyncHistoryStatus.CONFLICT -> MaterialTheme.colorScheme.tertiary.copy(alpha = 0.05f)
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
                                SyncHistoryStatus.SUCCESS -> MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)
                                SyncHistoryStatus.ERROR -> MaterialTheme.colorScheme.error.copy(alpha = 0.2f)
                                SyncHistoryStatus.CONFLICT -> MaterialTheme.colorScheme.tertiary.copy(alpha = 0.2f)
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
                            SyncHistoryStatus.SUCCESS -> MaterialTheme.colorScheme.primary
                            SyncHistoryStatus.ERROR -> MaterialTheme.colorScheme.error
                            SyncHistoryStatus.CONFLICT -> MaterialTheme.colorScheme.tertiary
                        },
                        modifier = Modifier.size(20.dp)
                    )
                }

                // Info
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = when (entry.action) {
                            SyncHistoryAction.UPLOAD -> stringResource(
                                id = R.string.sync_history_operation_upload,
                                dataTypeLabel(entry.dataType)
                            )

                            SyncHistoryAction.DOWNLOAD -> stringResource(
                                id = R.string.sync_history_operation_download,
                                dataTypeLabel(entry.dataType)
                            )

                            SyncHistoryAction.DELETE -> stringResource(
                                id = R.string.sync_history_operation_delete,
                                dataTypeLabel(entry.dataType)
                            )

                            SyncHistoryAction.CONFLICT -> stringResource(
                                id = R.string.sync_history_operation_conflict,
                                dataTypeLabel(entry.dataType)
                            )

                            SyncHistoryAction.CLEANUP -> stringResource(
                                id = R.string.sync_history_operation_cleanup,
                                dataTypeLabel(entry.dataType)
                            )

                            SyncHistoryAction.TEST_CONNECTION -> stringResource(
                                id = R.string.sync_history_operation_test,
                                dataTypeLabel(entry.dataType)
                            )
                        },
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = formatTimestamp(entry.timestamp),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = providerLabel(entry.providerType),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Duration
                if (entry.durationMs != null) {
                    val durationText = if (entry.durationMs < 1000) {
                        stringResource(R.string.sync_history_duration_ms, entry.durationMs)
                    } else {
                        stringResource(
                            R.string.sync_history_duration_seconds,
                            entry.durationMs / 1000.0
                        )
                    }
                    Text(
                        text = durationText,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Expand Icon
                Icon(
                    if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = stringResource(
                        if (expanded) R.string.sync_history_expand_less else R.string.sync_history_expand_more
                    )
                )
            }

            // Expanded Details
            AnimatedVisibility(visible = expanded) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Divider()

                    // Provider
                    DetailRow(stringResource(R.string.sync_history_detail_provider), providerLabel(entry.providerType))

                    DetailRow(
                        stringResource(R.string.sync_history_detail_data_type),
                        dataTypeLabel(entry.dataType)
                    )

                    entry.sizeBytes?.let { size ->
                        DetailRow(
                            stringResource(R.string.sync_history_detail_size),
                            formatBytes(size)
                        )
                    }

                    entry.durationMs?.let { duration ->
                        val durationDetail = if (duration < 1000) {
                            stringResource(R.string.sync_history_duration_ms, duration)
                        } else {
                            stringResource(R.string.sync_history_duration_seconds, duration / 1000.0)
                        }
                        DetailRow(stringResource(R.string.sync_history_detail_duration), durationDetail)
                    }

                    val statusMessage = entry.message?.takeIf { it.isNotBlank() }
                        ?: if (entry.status == SyncHistoryStatus.CONFLICT) {
                            stringResource(R.string.sync_history_conflict_message)
                        } else {
                            null
                        }

                    if (statusMessage != null) {
                        Divider()
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = when (entry.status) {
                                    SyncHistoryStatus.SUCCESS -> MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)
                                    SyncHistoryStatus.ERROR -> MaterialTheme.colorScheme.error.copy(alpha = 0.1f)
                                    SyncHistoryStatus.CONFLICT -> MaterialTheme.colorScheme.tertiary.copy(alpha = 0.1f)
                                }
                            )
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp)
                            ) {
                                Text(
                                    text = stringResource(
                                        when (entry.status) {
                                            SyncHistoryStatus.SUCCESS -> R.string.sync_history_status_success
                                            SyncHistoryStatus.ERROR -> R.string.sync_history_status_error
                                            SyncHistoryStatus.CONFLICT -> R.string.sync_history_status_conflict
                                        }
                                    ),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = when (entry.status) {
                                        SyncHistoryStatus.SUCCESS -> MaterialTheme.colorScheme.primary
                                        SyncHistoryStatus.ERROR -> MaterialTheme.colorScheme.error
                                        SyncHistoryStatus.CONFLICT -> MaterialTheme.colorScheme.tertiary
                                    },
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = statusMessage,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = when (entry.status) {
                                        SyncHistoryStatus.SUCCESS -> MaterialTheme.colorScheme.primary
                                        SyncHistoryStatus.ERROR -> MaterialTheme.colorScheme.error
                                        SyncHistoryStatus.CONFLICT -> MaterialTheme.colorScheme.tertiary
                                    }
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
                text = stringResource(id = R.string.empty_history),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = stringResource(id = R.string.sync_history_empty_subtitle),
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

@Composable
private fun formatBytes(bytes: Long): String {
    val context = LocalContext.current
    return when {
        bytes < 1_024 -> context.getString(R.string.sync_bytes_b, bytes)
        bytes < 1_024 * 1_024 -> context.getString(R.string.sync_bytes_kb, bytes / 1_024)
        bytes < 1_024L * 1_024L * 1_024L ->
            context.getString(R.string.sync_bytes_mb, (bytes / (1_024L * 1_024L)).toInt())
        else -> context.getString(
            R.string.sync_bytes_gb,
            (bytes / (1_024L * 1_024L * 1_024L)).toInt()
        )
    }
}

@Composable
private fun providerLabel(providerType: CloudProviderType): String {
    return when (providerType) {
        CloudProviderType.GOOGLE_DRIVE -> stringResource(R.string.sync_provider_google_drive)
        CloudProviderType.ONEDRIVE -> stringResource(R.string.sync_provider_onedrive)
        CloudProviderType.WEBDAV -> stringResource(R.string.sync_provider_webdav)
        CloudProviderType.PCLOUD -> stringResource(R.string.sync_provider_pcloud)
        CloudProviderType.PROTON_DRIVE -> stringResource(R.string.sync_provider_proton_drive)
        CloudProviderType.NONE -> stringResource(R.string.sync_provider_none)
    }
}

@Composable
private fun dataTypeLabel(dataType: SyncDataType): String {
    return when (dataType) {
        SyncDataType.SETTINGS -> stringResource(R.string.sync_data_type_settings)
        SyncDataType.HISTORY -> stringResource(R.string.sync_data_type_history)
        SyncDataType.CUSTOM_WORDS -> stringResource(R.string.sync_data_type_custom_words)
        SyncDataType.FAVORITES -> stringResource(R.string.sync_data_type_favorites)
    }
}
