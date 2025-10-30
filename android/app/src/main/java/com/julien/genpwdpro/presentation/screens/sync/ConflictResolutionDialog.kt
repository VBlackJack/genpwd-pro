package com.julien.genpwdpro.presentation.screens.sync

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.julien.genpwdpro.data.sync.models.ConflictResolutionStrategy
import com.julien.genpwdpro.data.sync.models.VaultSyncData
import java.text.SimpleDateFormat
import java.util.*

/**
 * Dialog pour résoudre manuellement un conflit de synchronisation
 *
 * Affiche:
 * - Les deux versions en conflit (locale et distante)
 * - Les métadonnées de chaque version
 * - Les options de résolution
 * - Une prévisualisation des différences
 */
@Composable
fun ConflictResolutionDialog(
    localVersion: VaultSyncData,
    remoteVersion: VaultSyncData,
    onResolve: (ConflictResolutionStrategy) -> Unit,
    onDismiss: () -> Unit
) {
    var selectedStrategy by remember { mutableStateOf<ConflictResolutionStrategy?>(null) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.9f),
            shape = MaterialTheme.shapes.large
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Conflit de Synchronisation",
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Deux versions différentes du vault ont été détectées",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, "Fermer")
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Content
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Warning
                    WarningCard()

                    // Comparison
                    VersionComparison(
                        localVersion = localVersion,
                        remoteVersion = remoteVersion
                    )

                    // Strategy Selection
                    StrategySelection(
                        selectedStrategy = selectedStrategy,
                        onStrategySelected = { selectedStrategy = it }
                    )

                    // Strategy Description
                    selectedStrategy?.let { strategy ->
                        StrategyDescription(strategy)
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Actions
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Annuler")
                    }
                    Button(
                        onClick = {
                            selectedStrategy?.let { onResolve(it) }
                        },
                        modifier = Modifier.weight(1f),
                        enabled = selectedStrategy != null
                    ) {
                        Icon(
                            Icons.Default.Check,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(Modifier.width(8.dp))
                        Text("Résoudre")
                    }
                }
            }
        }
    }
}

@Composable
private fun WarningCard() {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFFFFF3E0)
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
                tint = Color(0xFFF57C00)
            )
            Text(
                text = "Attention: Cette action est irréversible. La version non sélectionnée sera perdue.",
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFF5D4037)
            )
        }
    }
}

@Composable
private fun VersionComparison(
    localVersion: VaultSyncData,
    remoteVersion: VaultSyncData
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Local Version
        VersionCard(
            title = "Version Locale",
            icon = Icons.Default.PhoneAndroid,
            iconColor = Color(0xFF2196F3),
            data = localVersion,
            modifier = Modifier.weight(1f)
        )

        // Remote Version
        VersionCard(
            title = "Version Cloud",
            icon = Icons.Default.Cloud,
            iconColor = Color(0xFF4CAF50),
            data = remoteVersion,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun VersionCard(
    title: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    iconColor: Color,
    data: VaultSyncData,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    icon,
                    contentDescription = null,
                    tint = iconColor,
                    modifier = Modifier.size(20.dp)
                )
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
            }

            Divider()

            InfoRow("Nom", data.vaultName)
            InfoRow("Appareil", data.deviceId.take(8) + "...")
            InfoRow("Date", formatTimestamp(data.timestamp))
            InfoRow("Taille", formatBytes(data.encryptedData.size.toLong()))
            InfoRow("Checksum", data.checksum.take(8) + "...")
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
private fun StrategySelection(
    selectedStrategy: ConflictResolutionStrategy?,
    onStrategySelected: (ConflictResolutionStrategy) -> Unit
) {
    Text(
        text = "Choisissez une stratégie de résolution",
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold
    )

    Column(
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        StrategyOption(
            strategy = ConflictResolutionStrategy.LOCAL_WINS,
            title = "Garder la version locale",
            icon = Icons.Default.PhoneAndroid,
            iconColor = Color(0xFF2196F3),
            isSelected = selectedStrategy == ConflictResolutionStrategy.LOCAL_WINS,
            onClick = { onStrategySelected(ConflictResolutionStrategy.LOCAL_WINS) }
        )

        StrategyOption(
            strategy = ConflictResolutionStrategy.REMOTE_WINS,
            title = "Garder la version cloud",
            icon = Icons.Default.Cloud,
            iconColor = Color(0xFF4CAF50),
            isSelected = selectedStrategy == ConflictResolutionStrategy.REMOTE_WINS,
            onClick = { onStrategySelected(ConflictResolutionStrategy.REMOTE_WINS) }
        )

        StrategyOption(
            strategy = ConflictResolutionStrategy.NEWEST_WINS,
            title = "Garder la plus récente",
            icon = Icons.Default.Update,
            iconColor = Color(0xFFFF9800),
            isSelected = selectedStrategy == ConflictResolutionStrategy.NEWEST_WINS,
            onClick = { onStrategySelected(ConflictResolutionStrategy.NEWEST_WINS) }
        )
    }
}

@Composable
private fun StrategyOption(
    strategy: ConflictResolutionStrategy,
    title: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    iconColor: Color,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) {
                MaterialTheme.colorScheme.primaryContainer
            } else {
                MaterialTheme.colorScheme.surface
            }
        ),
        border = if (isSelected) {
            androidx.compose.foundation.BorderStroke(2.dp, MaterialTheme.colorScheme.primary)
        } else {
            null
        }
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                icon,
                contentDescription = null,
                tint = iconColor,
                modifier = Modifier.size(24.dp)
            )
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                modifier = Modifier.weight(1f)
            )
            if (isSelected) {
                Icon(
                    Icons.Default.CheckCircle,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

@Composable
private fun StrategyDescription(strategy: ConflictResolutionStrategy) {
    val (description, recommendation) = when (strategy) {
        ConflictResolutionStrategy.LOCAL_WINS -> Pair(
            "La version locale remplacera la version cloud. Toutes les modifications présentes uniquement dans le cloud seront perdues.",
            "Recommandé si vous savez que vos modifications locales sont les plus importantes."
        )
        ConflictResolutionStrategy.REMOTE_WINS -> Pair(
            "La version cloud remplacera la version locale. Toutes les modifications présentes uniquement localement seront perdues.",
            "Recommandé si vous travaillez sur plusieurs appareils et que le cloud a la version la plus à jour."
        )
        ConflictResolutionStrategy.NEWEST_WINS -> Pair(
            "La version avec le timestamp le plus récent sera conservée. L'autre sera écrasée.",
            "Recommandé si vous n'êtes pas sûr et voulez garder les dernières modifications."
        )
        ConflictResolutionStrategy.SMART_MERGE -> Pair(
            "Tentative de fusion intelligente des deux versions (fonctionnalité en développement).",
            "Non disponible actuellement."
        )
        ConflictResolutionStrategy.MANUAL -> Pair(
            "Vous choisissez manuellement quelle version garder.",
            "C'est ce que vous faites en ce moment!"
        )
    }

    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.5f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Default.Info,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(20.dp)
                )
                Text(
                    text = "À propos de cette option",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
            }

            Text(
                text = description,
                style = MaterialTheme.typography.bodyMedium
            )

            if (strategy != ConflictResolutionStrategy.SMART_MERGE) {
                Text(
                    text = "💡 $recommendation",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                )
            }
        }
    }
}

private fun formatTimestamp(timestamp: Long): String {
    val sdf = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
    return sdf.format(Date(timestamp))
}

private fun formatBytes(bytes: Long): String {
    return when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> "${bytes / 1024} KB"
        else -> "${bytes / (1024 * 1024)} MB"
    }
}
