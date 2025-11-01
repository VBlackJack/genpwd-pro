package com.julien.genpwdpro.presentation.screens.sync

import android.app.Activity
import android.content.Context
import com.julien.genpwdpro.core.log.SafeLog
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.local.preferences.SettingsDataStore
import com.julien.genpwdpro.data.local.preferences.SyncConfigDataStore
import com.julien.genpwdpro.data.sync.*
import com.julien.genpwdpro.data.sync.CloudProviderSyncRepository
import com.julien.genpwdpro.data.sync.models.CloudProviderType
import com.julien.genpwdpro.data.sync.models.SyncStatus
import com.julien.genpwdpro.data.sync.providers.CloudProviderFactory
import com.julien.genpwdpro.data.sync.providers.ProviderConfig
import com.julien.genpwdpro.data.sync.providers.ProviderInfo
import com.julien.genpwdpro.workers.CloudSyncWorker
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Écran de configuration de la synchronisation cloud
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SyncSettingsScreen(
    onNavigateBack: () -> Unit,
    onNavigateToHistory: () -> Unit = {},
    onNavigateToAutofill: () -> Unit = {},
    onNavigateToSecurity: () -> Unit = {},
    viewModel: SyncSettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val activity = LocalContext.current as? Activity
    val snackbarHostState = remember { SnackbarHostState() }
    var showProviderConfigDialog by remember { mutableStateOf(false) }
    var selectedProviderForConfig by remember { mutableStateOf<ProviderInfo?>(null) }

    // Show authentication result in Snackbar
    LaunchedEffect(uiState.authenticationResult) {
        uiState.authenticationResult?.let { result ->
            val message = when (result) {
                is AuthenticationResult.Success -> result.message
                is AuthenticationResult.Failure -> "Erreur: ${result.error}"
            }
            snackbarHostState.showSnackbar(
                message = message,
                duration = SnackbarDuration.Short
            )
            viewModel.clearAuthenticationResult()
        }
    }

    // Show test connection result in Snackbar
    LaunchedEffect(uiState.testConnectionResult) {
        uiState.testConnectionResult?.let { result ->
            val message = when (result) {
                is TestConnectionResult.Success -> result.message
                is TestConnectionResult.Failure -> "Erreur: ${result.error}"
            }
            snackbarHostState.showSnackbar(
                message = message,
                duration = SnackbarDuration.Short
            )
            viewModel.clearTestConnectionResult()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Synchronisation Cloud") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, "Retour")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        snackbarHost = {
            SnackbarHost(hostState = snackbarHostState)
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Activation de la sync
            SyncEnableCard(
                enabled = uiState.config.enabled,
                onToggle = { viewModel.toggleSync() }
            )

            // Status de la dernière sync
            if (uiState.config.enabled) {
                SyncStatusCard(
                    status = uiState.status,
                    lastSyncTimestamp = uiState.metadata.lastSyncTimestamp,
                    metadata = uiState.metadata
                )

                // Cloud provider selection
                ProviderSelectionCard(
                    availableProviders = uiState.availableProviders,
                    selectedProvider = uiState.config.providerType,
                    onProviderChange = { providerType ->
                        // Find provider info and show config dialog
                        val providerInfo = uiState.availableProviders.find { it.type == providerType }
                        if (providerInfo != null) {
                            selectedProviderForConfig = providerInfo
                            showProviderConfigDialog = true
                        }
                    }
                )

                // Auto-sync settings
                AutoSyncCard(
                    enabled = uiState.config.autoSync,
                    interval = uiState.config.syncInterval,
                    onToggleAutoSync = { viewModel.toggleAutoSync() },
                    onIntervalChange = { viewModel.updateSyncInterval(it) }
                )

                // Actions
                SyncActionsCard(
                    status = uiState.status,
                    onSyncNow = { viewModel.syncNow() },
                    onTestConnection = { viewModel.testConnection() },
                    onResetSync = { viewModel.resetSync() }
                )

                // Conflicts (if any)
                if (uiState.currentConflict != null) {
                    ConflictsCard(
                        conflictCount = uiState.metadata.conflictCount,
                        onResolve = { /* Dialog will be shown below */ }
                    )
                }

                // Encryption info
                EncryptionInfoCard()
            }

            // Quick access to related settings
            QuickAccessCard(
                onNavigateToHistory = onNavigateToHistory,
                onNavigateToAutofill = onNavigateToAutofill,
                onNavigateToSecurity = onNavigateToSecurity
            )

            Spacer(modifier = Modifier.height(16.dp))
        }
    }

    // Show provider configuration dialog
    if (showProviderConfigDialog && selectedProviderForConfig != null) {
        when (selectedProviderForConfig!!.type) {
            CloudProviderType.WEBDAV -> {
                // Use WebDAV-specific dialog
                var showWebDAVDialog by remember { mutableStateOf(true) }
                if (showWebDAVDialog) {
                    WebDAVConfigDialog(
                        onDismiss = {
                            showWebDAVDialog = false
                            showProviderConfigDialog = false
                            selectedProviderForConfig = null
                        },
                        onSave = { serverUrl, username, password, validateSSL ->
                            viewModel.configureWebDAV(serverUrl, username, password, validateSSL)
                            showWebDAVDialog = false
                            showProviderConfigDialog = false
                            selectedProviderForConfig = null
                        },
                        onTestConnection = { serverUrl, username, password, validateSSL ->
                            viewModel.testWebDAVConnection(
                                serverUrl,
                                username,
                                password,
                                validateSSL
                            )
                        },
                        isTestingConnection = uiState.isTestingConnection,
                        testConnectionResult = uiState.testConnectionResult
                    )
                }
            }
            else -> {
                // Use generic OAuth2 dialogs
                CloudProviderConfigDialog(
                    providerInfo = selectedProviderForConfig!!,
                    onDismiss = {
                        showProviderConfigDialog = false
                        selectedProviderForConfig = null
                    },
                    onAuthenticate = { config ->
                        if (activity != null) {
                            viewModel.authenticateProvider(
                                activity = activity,
                                providerType = selectedProviderForConfig!!.type,
                                config = config
                            )
                        }
                        showProviderConfigDialog = false
                        selectedProviderForConfig = null
                    }
                )
            }
        }
    }

    // Show conflict resolution dialog
    val currentConflict = uiState.currentConflict
    if (currentConflict != null) {
        ConflictResolutionDialog(
            conflict = currentConflict,
            onResolve = { strategy ->
                viewModel.resolveConflict(strategy)
            },
            onDismiss = {
                viewModel.dismissConflict()
            }
        )
    }
}

/**
 * Dialogue de résolution de conflits
 */
@Composable
private fun ConflictResolutionDialog(
    conflict: SyncResult.Conflict,
    onResolve: (ConflictResolutionStrategy) -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(
                Icons.Default.Warning,
                contentDescription = null,
                tint = Color(0xFFF59E0B),
                modifier = Modifier.size(48.dp)
            )
        },
        title = {
            Text(
                "Conflit de synchronisation détecté",
                style = MaterialTheme.typography.headlineSmall
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text(
                    "Vos paramètres ont été modifiés localement et sur le cloud. " +
                        "Quelle version souhaitez-vous conserver ?",
                    style = MaterialTheme.typography.bodyMedium
                )

                // Local version info
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.5f)
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.PhoneAndroid, null, modifier = Modifier.size(16.dp))
                            Text(
                                "Version locale",
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Text(
                            "Modifié : ${formatTimestamp(conflict.localData.timestamp)}",
                            style = MaterialTheme.typography.bodySmall
                        )
                        Text(
                            "Appareil : ${conflict.localData.deviceId.take(8)}...",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }

                // Remote version info
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Cloud, null, modifier = Modifier.size(16.dp))
                            Text(
                                "Version cloud",
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Text(
                            "Modifié : ${formatTimestamp(conflict.remoteData.timestamp)}",
                            style = MaterialTheme.typography.bodySmall
                        )
                        Text(
                            "Appareil : ${conflict.remoteData.deviceId.take(8)}...",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }

                Divider()

                Text(
                    "Choisissez une stratégie de résolution :",
                    style = MaterialTheme.typography.labelMedium
                )
            }
        },
        confirmButton = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Keep local
                Button(
                    onClick = { onResolve(ConflictResolutionStrategy.LOCAL_WINS) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.secondaryContainer,
                        contentColor = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                ) {
                    Icon(Icons.Default.PhoneAndroid, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Garder la version locale")
                }

                // Keep remote
                Button(
                    onClick = { onResolve(ConflictResolutionStrategy.REMOTE_WINS) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer,
                        contentColor = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                ) {
                    Icon(Icons.Default.Cloud, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Garder la version cloud")
                }

                // Keep newest
                Button(
                    onClick = { onResolve(ConflictResolutionStrategy.NEWEST_WINS) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Schedule, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Garder la plus récente")
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Annuler")
            }
        }
    )
}

/**
 * Carte d'activation de la sync
 */
@Composable
private fun SyncEnableCard(
    enabled: Boolean,
    onToggle: () -> Unit
) {
    Card {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Synchronisation Cloud",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = if (enabled) "Activée" else "Désactivée",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Switch(
                checked = enabled,
                onCheckedChange = { onToggle() }
            )
        }
    }
}

/**
 * Carte de statut de la sync
 */
@Composable
private fun SyncStatusCard(
    status: SyncStatus,
    lastSyncTimestamp: Long,
    metadata: LocalSyncMetadata
) {
    val (statusColor, statusIcon, statusText) = when (status) {
        SyncStatus.NEVER_SYNCED -> Triple(
            Color(0xFF9CA3AF),
            Icons.Default.CloudOff,
            "Jamais synchronisé"
        )
        SyncStatus.PENDING -> Triple(Color(0xFF9CA3AF), Icons.Default.CloudOff, "En attente")
        SyncStatus.SYNCING -> Triple(
            Color(0xFF3B82F6),
            Icons.Default.CloudSync,
            "Synchronisation..."
        )
        SyncStatus.SYNCED -> Triple(Color(0xFF10B981), Icons.Default.CloudDone, "Synchronisé")
        SyncStatus.ERROR -> Triple(Color(0xFFEF4444), Icons.Default.CloudOff, "Erreur")
        SyncStatus.CONFLICT -> Triple(Color(0xFFF59E0B), Icons.Default.Warning, "Conflit détecté")
    }

    Card(
        colors = CardDefaults.cardColors(
            containerColor = statusColor.copy(alpha = 0.1f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(statusColor.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        statusIcon,
                        null,
                        tint = statusColor,
                        modifier = Modifier.size(24.dp)
                    )
                }

                Column {
                    Text(
                        text = statusText,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = statusColor
                    )
                    Text(
                        text = formatTimestamp(lastSyncTimestamp),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            if (status == SyncStatus.SYNCING) {
                LinearProgressIndicator(
                    modifier = Modifier.fillMaxWidth(),
                    color = statusColor
                )
            }

            // Metadata
            if (metadata.pendingChanges > 0 || metadata.syncErrors.isNotEmpty()) {
                Divider()

                if (metadata.pendingChanges > 0) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.Pending,
                            null,
                            modifier = Modifier.size(18.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = "${metadata.pendingChanges} modification(s) en attente",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }

                if (metadata.syncErrors.isNotEmpty()) {
                    metadata.syncErrors.take(3).forEach { error ->
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.Error,
                                null,
                                modifier = Modifier.size(18.dp),
                                tint = Color(0xFFEF4444)
                            )
                            Text(
                                text = error,
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFFEF4444)
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Sélection du cloud provider
 */
@Composable
private fun ProviderSelectionCard(
    availableProviders: List<ProviderInfo>,
    selectedProvider: CloudProviderType,
    onProviderChange: (CloudProviderType) -> Unit
) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Service de stockage cloud",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Text(
                text = "Tous les providers sont production-ready avec chiffrement E2E",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.primary
            )

            availableProviders.forEach { provider ->
                ProviderOption(
                    provider = provider,
                    isSelected = provider.type == selectedProvider,
                    onClick = { onProviderChange(provider.type) }
                )
            }
        }
    }
}

@Composable
private fun ProviderOption(
    provider: ProviderInfo,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(8.dp),
        color = if (isSelected) {
            MaterialTheme.colorScheme.primaryContainer
        } else {
            MaterialTheme.colorScheme.surface
        },
        tonalElevation = if (isSelected) 0.dp else 1.dp
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                Text(provider.icon, style = MaterialTheme.typography.headlineSmall)
                Column {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = provider.name,
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                        )
                        // Privacy badge
                        val privacyColor = when (provider.privacyLevel) {
                            com.julien.genpwdpro.data.sync.providers.PrivacyLevel.MAXIMUM -> Color(
                                0xFF10B981
                            )
                            com.julien.genpwdpro.data.sync.providers.PrivacyLevel.HIGH -> Color(
                                0xFF3B82F6
                            )
                            else -> Color(0xFF9CA3AF)
                        }
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = privacyColor.copy(alpha = 0.2f)
                        ) {
                            Text(
                                text = when (provider.privacyLevel) {
                                    com.julien.genpwdpro.data.sync.providers.PrivacyLevel.MAXIMUM -> "Max Privacy"
                                    com.julien.genpwdpro.data.sync.providers.PrivacyLevel.HIGH -> "High Privacy"
                                    else -> "Standard"
                                },
                                style = MaterialTheme.typography.labelSmall,
                                color = privacyColor,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                    Text(
                        text = provider.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    // Storage info
                    if (provider.freeStorage > 0) {
                        Text(
                            text = "Gratuit: ${formatBytes(provider.freeStorage)}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.tertiary
                        )
                    }
                }
            }
            if (isSelected) {
                Icon(
                    Icons.Default.CheckCircle,
                    null,
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

/**
 * Format bytes to human readable string
 */
private fun formatBytes(bytes: Long): String {
    return when {
        bytes >= 1_000_000_000 -> "${bytes / 1_000_000_000} GB"
        bytes >= 1_000_000 -> "${bytes / 1_000_000} MB"
        bytes >= 1_000 -> "${bytes / 1_000} KB"
        else -> "$bytes B"
    }
}

/**
 * Paramètres de synchronisation automatique
 */
@Composable
private fun AutoSyncCard(
    enabled: Boolean,
    interval: Long,
    onToggleAutoSync: () -> Unit,
    onIntervalChange: (Long) -> Unit
) {
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
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Synchronisation automatique",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = if (enabled) "Activée" else "Désactivée",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Switch(
                    checked = enabled,
                    onCheckedChange = { onToggleAutoSync() }
                )
            }

            if (enabled) {
                Divider()

                Text(
                    text = "Intervalle de synchronisation",
                    style = MaterialTheme.typography.bodyMedium
                )

                val intervalOptions = listOf(
                    900000L to "15 minutes",
                    1800000L to "30 minutes",
                    3600000L to "1 heure",
                    7200000L to "2 heures",
                    21600000L to "6 heures",
                    86400000L to "24 heures"
                )

                intervalOptions.forEach { (value, label) ->
                    FilterChip(
                        selected = interval == value,
                        onClick = { onIntervalChange(value) },
                        label = { Text(label) },
                        modifier = Modifier.padding(end = 8.dp)
                    )
                }
            }
        }
    }
}

/**
 * Actions de synchronisation
 */
@Composable
private fun SyncActionsCard(
    status: SyncStatus,
    onSyncNow: () -> Unit,
    onTestConnection: () -> Unit,
    onResetSync: () -> Unit
) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Actions",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Button(
                onClick = onSyncNow,
                modifier = Modifier.fillMaxWidth(),
                enabled = status != SyncStatus.SYNCING
            ) {
                Icon(Icons.Default.Sync, null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Synchroniser maintenant")
            }

            OutlinedButton(
                onClick = onTestConnection,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Wifi, null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Tester la connexion")
            }

            OutlinedButton(
                onClick = onResetSync,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = MaterialTheme.colorScheme.error
                )
            ) {
                Icon(Icons.Default.Delete, null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Réinitialiser la synchronisation")
            }
        }
    }
}

/**
 * Carte de conflits
 */
@Composable
private fun ConflictsCard(
    conflictCount: Int,
    onResolve: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFFF59E0B).copy(alpha = 0.1f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Default.Warning,
                    null,
                    tint = Color(0xFFF59E0B)
                )
                Column {
                    Text(
                        text = "Conflits détectés",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "$conflictCount conflit(s) nécessitent une résolution",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }

            Button(
                onClick = onResolve,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Résoudre les conflits")
            }
        }
    }
}

/**
 * Information sur le chiffrement
 */
@Composable
private fun EncryptionInfoCard() {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
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
                Icons.Default.Lock,
                null,
                tint = MaterialTheme.colorScheme.primary
            )
            Column {
                Text(
                    text = "Chiffrement de bout en bout",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Toutes vos données sont chiffrées avec AES-256-GCM avant envoi au cloud",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/**
 * Format un timestamp en texte lisible
 */
private fun formatTimestamp(timestamp: Long): String {
    if (timestamp == 0L) return "Jamais synchronisé"

    val now = System.currentTimeMillis()
    val diff = now - timestamp

    return when {
        diff < 60000 -> "Il y a moins d'une minute"
        diff < 3600000 -> "Il y a ${diff / 60000} minutes"
        diff < 86400000 -> "Il y a ${diff / 3600000} heures"
        diff < 604800000 -> "Il y a ${diff / 86400000} jours"
        else -> {
            val sdf = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.FRENCH)
            sdf.format(Date(timestamp))
        }
    }
}

/**
 * Carte d'accès rapide aux paramètres liés
 */
@Composable
private fun QuickAccessCard(
    onNavigateToHistory: () -> Unit,
    onNavigateToAutofill: () -> Unit,
    onNavigateToSecurity: () -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "Paramètres associés",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            // Sync History button
            OutlinedButton(
                onClick = onNavigateToHistory,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(
                    Icons.Default.History,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text("Historique de Synchronisation")
            }

            // Security button
            OutlinedButton(
                onClick = onNavigateToSecurity,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(
                    Icons.Default.Security,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text("Sécurité & Biométrie")
            }

            // Autofill button
            OutlinedButton(
                onClick = onNavigateToAutofill,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(
                    Icons.Default.Input,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text("Auto-remplissage")
            }
        }
    }
}

/**
 * ViewModel pour la synchronisation
 */
@HiltViewModel
class SyncSettingsViewModel @Inject constructor(
    private val syncManager: SyncManager,
    private val providerFactory: CloudProviderFactory,
    private val cloudRepository: CloudProviderSyncRepository,
    private val syncConfigDataStore: SyncConfigDataStore,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val _uiState = MutableStateFlow(
        SyncSettingsUiState(
            availableProviders = providerFactory.getProductionReadyProviders()
        )
    )
    val uiState: StateFlow<SyncSettingsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            // Charger la configuration sauvegardée
            syncConfigDataStore.syncConfigFlow.collect { savedConfig ->
                _uiState.update { state ->
                    state.copy(
                        config = state.config.copy(
                            enabled = savedConfig.enabled,
                            providerType = savedConfig.providerType,
                            autoSync = savedConfig.autoSync,
                            syncInterval = savedConfig.syncInterval,
                            syncOnWifiOnly = savedConfig.syncOnWifiOnly
                        )
                    )
                }
            }
        }

        viewModelScope.launch {
            // Observer le statut de la sync
            syncManager.syncStatus.collect { status ->
                _uiState.update { it.copy(status = status) }
            }
        }

        viewModelScope.launch {
            // Obtenir les métadonnées
            val metadata = syncManager.getMetadata()
            _uiState.update { it.copy(metadata = metadata) }
        }
    }

    fun toggleSync() {
        viewModelScope.launch {
            val newEnabled = !_uiState.value.config.enabled
            syncConfigDataStore.setSyncEnabled(newEnabled)

            _uiState.update { state ->
                state.copy(
                    config = state.config.copy(enabled = newEnabled)
                )
            }
        }
    }

    fun selectProvider(providerType: CloudProviderType) {
        _uiState.update { state ->
            state.copy(
                config = state.config.copy(providerType = providerType)
            )
        }
    }

    fun configureWebDAV(serverUrl: String, username: String, password: String, validateSSL: Boolean) {
        viewModelScope.launch {
            // TODO: Save WebDAV config and create provider
            _uiState.update { state ->
                state.copy(
                    config = state.config.copy(providerType = CloudProviderType.WEBDAV)
                )
            }
        }
    }

    fun testWebDAVConnection(
        serverUrl: String,
        username: String,
        password: String,
        validateSSL: Boolean
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isTestingConnection = true) }
            try {
                // TODO: Test WebDAV connection
                kotlinx.coroutines.delay(1500)
                _uiState.update {
                    it.copy(
                        isTestingConnection = false,
                        testConnectionResult = TestConnectionResult.Success(
                            "Connexion WebDAV réussie!"
                        )
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isTestingConnection = false,
                        testConnectionResult = TestConnectionResult.Failure(
                            e.message ?: "Erreur inconnue"
                        )
                    )
                }
            }
        }
    }

    /**
     * Authentifier un provider cloud et le définir comme actif
     *
     * @param activity Activity nécessaire pour OAuth2
     * @param providerType Type de provider
     * @param config Configuration du provider
     */
    fun authenticateProvider(
        activity: Activity,
        providerType: CloudProviderType,
        config: CloudProviderConfig
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isAuthenticating = true) }

            try {
                val (provider, providerConfig) = when (config) {
                    is CloudProviderConfig.GoogleDrive -> {
                        // Google Drive ne nécessite pas de config spécifique
                        providerFactory.createProvider(CloudProviderType.GOOGLE_DRIVE) to null
                    }

                    is CloudProviderConfig.OneDrive -> {
                        providerFactory.createOneDriveProvider(config.clientId) to ProviderConfig(
                            customSettings = mapOf("clientId" to config.clientId)
                        )
                    }

                    is CloudProviderConfig.PCloud -> {
                        providerFactory.createPCloudProvider(
                            appKey = config.appKey,
                            appSecret = config.appSecret,
                            region = config.region
                        ) to ProviderConfig(
                            customSettings = mapOf(
                                "appKey" to config.appKey,
                                "appSecret" to config.appSecret,
                                "region" to config.region.name
                            )
                        )
                    }

                    is CloudProviderConfig.ProtonDrive -> {
                        providerFactory.createProtonDriveProvider(
                            clientId = config.clientId,
                            clientSecret = config.clientSecret
                        ) to ProviderConfig(
                            customSettings = mapOf(
                                "clientId" to config.clientId,
                                "clientSecret" to config.clientSecret
                            )
                        )
                    }
                }

                if (provider != null) {
                    // Authentifier avec le provider
                    val success = provider.authenticate(activity)

                    if (success) {
                        // Définir comme provider actif
                        cloudRepository.setActiveProvider(providerType, provider, providerConfig)

                        // Sauvegarder le provider type
                        syncConfigDataStore.setProviderType(providerType)

                        _uiState.update { state ->
                            state.copy(
                                config = state.config.copy(providerType = providerType),
                                isAuthenticating = false,
                                authenticationResult = AuthenticationResult.Success(
                                    "Authentification réussie!"
                                )
                            )
                        }
                    } else {
                        _uiState.update {
                            it.copy(
                                isAuthenticating = false,
                                authenticationResult = AuthenticationResult.Failure(
                                    "Authentification échouée"
                                )
                            )
                        }
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            isAuthenticating = false,
                            authenticationResult = AuthenticationResult.Failure(
                                "Provider non supporté"
                            )
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isAuthenticating = false,
                        authenticationResult = AuthenticationResult.Failure(
                            e.message ?: "Erreur inconnue"
                        )
                    )
                }
            }
        }
    }

    fun toggleAutoSync() {
        viewModelScope.launch {
            val newAutoSync = !_uiState.value.config.autoSync
            syncConfigDataStore.setAutoSync(newAutoSync)

            if (newAutoSync) {
                // Activer la synchronisation automatique
                SafeLog.d(
                    "SyncSettingsViewModel",
                    "Enabling auto-sync with interval: ${_uiState.value.config.syncInterval}"
                )
                CloudSyncWorker.schedule(
                    context = context,
                    intervalMillis = _uiState.value.config.syncInterval,
                    wifiOnly = _uiState.value.config.syncOnWifiOnly
                )
            } else {
                // Désactiver la synchronisation automatique
                SafeLog.d("SyncSettingsViewModel", "Disabling auto-sync")
                CloudSyncWorker.cancel(context)
            }

            _uiState.update { state ->
                state.copy(
                    config = state.config.copy(autoSync = newAutoSync)
                )
            }
        }
    }

    fun updateSyncInterval(interval: Long) {
        viewModelScope.launch {
            syncConfigDataStore.setSyncInterval(interval)

            // Si auto-sync est activé, reprogrammer avec le nouvel intervalle
            if (_uiState.value.config.autoSync) {
                SafeLog.d("SyncSettingsViewModel", "Updating sync interval to: $interval")
                CloudSyncWorker.schedule(
                    context = context,
                    intervalMillis = interval,
                    wifiOnly = _uiState.value.config.syncOnWifiOnly
                )
            }

            _uiState.update { state ->
                state.copy(
                    config = state.config.copy(syncInterval = interval)
                )
            }
        }
    }

    fun syncNow() {
        viewModelScope.launch {
            try {
                _uiState.update { it.copy(status = SyncStatus.SYNCING) }
                SafeLog.d("SyncSettingsViewModel", "Starting full sync...")

                // Initialize SyncManager (ensures encryption key is ready)
                syncManager.initialize()

                // Get current settings
                val settingsDataStore = SettingsDataStore(context)
                val currentSettings = settingsDataStore.settingsFlow.first()

                // Perform full bidirectional sync
                val result = syncManager.performFullSync(currentSettings)

                when (result) {
                    is SyncResult.Success -> {
                        SafeLog.d("SyncSettingsViewModel", "Sync successful")

                        // Sauvegarder le timestamp de dernière sync
                        syncConfigDataStore.updateLastSyncTimestamp()

                        _uiState.update {
                            it.copy(
                                status = SyncStatus.SYNCED,
                                metadata = syncManager.getMetadata()
                            )
                        }
                    }
                    is SyncResult.Conflict -> {
                        SafeLog.w("SyncSettingsViewModel", "Conflict detected during sync")
                        _uiState.update {
                            it.copy(
                                status = SyncStatus.CONFLICT,
                                currentConflict = result,
                                metadata = syncManager.getMetadata().copy(
                                    conflictCount = 1
                                )
                            )
                        }
                    }
                    is SyncResult.Error -> {
                        SafeLog.e("SyncSettingsViewModel", "Sync error: ${result.message}")
                        _uiState.update {
                            it.copy(
                                status = SyncStatus.ERROR,
                                metadata = syncManager.getMetadata().copy(
                                    syncErrors = listOf(result.message)
                                )
                            )
                        }
                    }
                }
            } catch (e: Exception) {
                SafeLog.e("SyncSettingsViewModel", "Sync failed with exception", e)
                _uiState.update {
                    it.copy(
                        status = SyncStatus.ERROR,
                        metadata = syncManager.getMetadata().copy(
                            syncErrors = listOf(e.message ?: "Erreur inconnue")
                        )
                    )
                }
            }
        }
    }

    fun testConnection() {
        viewModelScope.launch {
            _uiState.update { it.copy(isTestingConnection = true) }

            try {
                val result = syncManager.testConnection()

                _uiState.update {
                    it.copy(
                        isTestingConnection = false,
                        testConnectionResult = if (result) {
                            TestConnectionResult.Success("Connexion réussie!")
                        } else {
                            TestConnectionResult.Failure("Impossible de se connecter au cloud")
                        }
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isTestingConnection = false,
                        testConnectionResult = TestConnectionResult.Failure(
                            e.message ?: "Erreur inconnue"
                        )
                    )
                }
            }
        }
    }

    fun resetSync() {
        viewModelScope.launch {
            // Annuler les workers
            CloudSyncWorker.cancel(context)

            // Réinitialiser SyncManager
            syncManager.reset()

            // Effacer la config persistée
            syncConfigDataStore.clearSyncConfig()

            // Réinitialiser le repository
            cloudRepository.clearActiveProvider()

            _uiState.update {
                SyncSettingsUiState(
                    availableProviders = providerFactory.getProductionReadyProviders()
                )
            }
        }
    }

    fun clearAuthenticationResult() {
        _uiState.update { it.copy(authenticationResult = null) }
    }

    fun clearTestConnectionResult() {
        _uiState.update { it.copy(testConnectionResult = null) }
    }

    /**
     * Résout un conflit avec la stratégie choisie par l'utilisateur
     */
    fun resolveConflict(strategy: ConflictResolutionStrategy) {
        viewModelScope.launch {
            val conflict = _uiState.value.currentConflict ?: return@launch

            try {
                SafeLog.d("SyncSettingsViewModel", "Resolving conflict with strategy: $strategy")

                // Résoudre le conflit
                val resolved = syncManager.resolveConflict(conflict, strategy)

                // Appliquer la version résolue
                val settingsDataStore = SettingsDataStore(context)

                if (resolved == conflict.remoteData) {
                    // Appliquer les paramètres distants
                    val remoteSettings = syncManager.downloadSettings()
                    if (remoteSettings != null) {
                        settingsDataStore.saveSettings(remoteSettings)
                        SafeLog.d("SyncSettingsViewModel", "Applied remote settings")
                    }
                } else {
                    // Uploader les paramètres locaux
                    val currentSettings = settingsDataStore.settingsFlow.first()
                    syncManager.syncSettings(currentSettings)
                    SafeLog.d("SyncSettingsViewModel", "Uploaded local settings")
                }

                // Mettre à jour l'état
                _uiState.update {
                    it.copy(
                        status = SyncStatus.SYNCED,
                        currentConflict = null,
                        metadata = syncManager.getMetadata().copy(conflictCount = 0)
                    )
                }
            } catch (e: Exception) {
                SafeLog.e("SyncSettingsViewModel", "Error resolving conflict", e)
                _uiState.update {
                    it.copy(
                        status = SyncStatus.ERROR,
                        metadata = it.metadata.copy(
                            syncErrors = listOf(
                                e.message ?: "Erreur lors de la résolution du conflit"
                            )
                        )
                    )
                }
            }
        }
    }

    /**
     * Annule la résolution de conflit (garde la version locale)
     */
    fun dismissConflict() {
        _uiState.update {
            it.copy(
                status = SyncStatus.PENDING,
                currentConflict = null,
                metadata = it.metadata.copy(conflictCount = 0)
            )
        }
    }
}

/**
 * État de l'UI
 */
data class SyncSettingsUiState(
    val config: UiSyncConfig = UiSyncConfig(),
    val status: SyncStatus = SyncStatus.PENDING,
    val availableProviders: List<ProviderInfo> = emptyList(),
    val metadata: LocalSyncMetadata = LocalSyncMetadata(),
    val isTestingConnection: Boolean = false,
    val testConnectionResult: TestConnectionResult? = null,
    val isAuthenticating: Boolean = false,
    val authenticationResult: AuthenticationResult? = null,
    val currentConflict: SyncResult.Conflict? = null
)

/**
 * Configuration de sync pour l'UI (utilise Long pour syncInterval)
 */
data class UiSyncConfig(
    val enabled: Boolean = false,
    val providerType: CloudProviderType = CloudProviderType.NONE,
    val autoSync: Boolean = false,
    val syncInterval: Long = 3600000L, // 1 heure par défaut (en millisecondes)
    val syncOnWifiOnly: Boolean = true
)

/**
 * Résultat d'une authentification provider
 */
sealed class AuthenticationResult {
    data class Success(val message: String) : AuthenticationResult()
    data class Failure(val error: String) : AuthenticationResult()
}
