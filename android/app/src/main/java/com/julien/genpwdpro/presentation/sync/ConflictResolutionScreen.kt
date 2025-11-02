package com.julien.genpwdpro.presentation.sync

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.genpwd.corevault.VaultItem

/**
 * Screen for resolving sync conflicts between local and remote vaults.
 *
 * When conflicts are detected during sync, this screen allows the user to:
 * - Keep local version
 * - Keep remote version
 * - Keep both versions
 * - Manually merge (future enhancement)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConflictResolutionScreen(
    conflicts: List<ConflictItem>,
    onResolve: (ConflictItem, ConflictResolution) -> Unit,
    onNavigateBack: () -> Unit
) {
    var resolvedCount by remember { mutableStateOf(0) }
    val totalConflicts = conflicts.size

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Resolve Conflicts")
                        Text(
                            text = "$resolvedCount / $totalConflicts resolved",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer,
                    titleContentColor = MaterialTheme.colorScheme.onErrorContainer
                )
            )
        }
    ) { paddingValues ->
        if (conflicts.isEmpty()) {
            // All conflicts resolved
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = "All Conflicts Resolved",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Button(onClick = onNavigateBack) {
                        Text("Done")
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    // Info card
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.secondaryContainer
                        )
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Icon(
                                Icons.Default.Info,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSecondaryContainer
                            )
                            Text(
                                text = "Conflicts occur when the same item is modified on multiple devices. " +
                                        "Choose which version to keep for each conflict.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSecondaryContainer
                            )
                        }
                    }
                }

                items(conflicts) { conflict ->
                    ConflictCard(
                        conflict = conflict,
                        onResolve = { resolution ->
                            onResolve(conflict, resolution)
                            resolvedCount++
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun ConflictCard(
    conflict: ConflictItem,
    onResolve: (ConflictResolution) -> Unit
) {
    var showDetails by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Item ID: ${conflict.itemId}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Modified on ${conflict.deviceCount} devices",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                IconButton(onClick = { showDetails = !showDetails }) {
                    Icon(
                        if (showDetails) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        contentDescription = "Toggle details"
                    )
                }
            }

            // Details (when expanded)
            if (showDetails) {
                Divider()

                // Local version
                VersionCard(
                    title = "Local Version",
                    item = conflict.localItem,
                    modifier = Modifier.fillMaxWidth()
                )

                // Remote version
                VersionCard(
                    title = "Remote Version",
                    item = conflict.remoteItem,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            Divider()

            // Resolution buttons
            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "Choose resolution:",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = { onResolve(ConflictResolution.KEEP_LOCAL) },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Keep Local", fontSize = MaterialTheme.typography.bodySmall.fontSize)
                    }
                    OutlinedButton(
                        onClick = { onResolve(ConflictResolution.KEEP_REMOTE) },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Keep Remote", fontSize = MaterialTheme.typography.bodySmall.fontSize)
                    }
                }

                Button(
                    onClick = { onResolve(ConflictResolution.KEEP_BOTH) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary
                    )
                ) {
                    Icon(Icons.Default.CopyAll, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Keep Both")
                }
            }
        }
    }
}

@Composable
private fun VersionCard(
    title: String,
    item: VaultItem?,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surface
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold
            )
            if (item != null) {
                Text(
                    text = "Updated: ${java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss")
                        .format(java.util.Date(item.updatedAtUtc * 1000))}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "Size: ${item.encryptedBlob.length} bytes",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                Text(
                    text = "Deleted",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

/**
 * Represents a conflict between local and remote versions of a vault item.
 */
data class ConflictItem(
    val itemId: String,
    val localItem: VaultItem?,
    val remoteItem: VaultItem?,
    val deviceCount: Int = 2
)

/**
 * Resolution strategy for a conflict.
 */
enum class ConflictResolution {
    KEEP_LOCAL,
    KEEP_REMOTE,
    KEEP_BOTH
}
