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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.R
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
    onNavigateToCloudAccounts: () -> Unit = {},
    viewModel: SyncSettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val activity = context as? Activity
    val snackbarHostState = remember { SnackbarHostState() }
    var showProviderConfigDialog by remember { mutableStateOf(false) }
    var selectedProviderForConfig by remember { mutableStateOf<ProviderInfo?>(null) }

    // Show authentication result in Snackbar
    LaunchedEffect(uiState.authenticationResult) {
        uiState.authenticationResult?.let { result ->
            val message = when (result) {
                is AuthenticationResult.Success -> result.message
                is AuthenticationResult.Failure ->
                    context.getString(R.string.sync_snackbar_error_prefix, result.error)
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
                is TestConnectionResult.Failure ->
                    context.getString(R.string.sync_snackbar_error_prefix, result.error)
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
                title = { Text(stringResource(id = R.string.sync_settings_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            Icons.Default.ArrowBack,
                            stringResource(id = R.string.sync_common_back)
                        )
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

                uiState.providerWarning?.let { warning ->
                    ProviderWarningCard(
                        message = warning,
                        onRetry = { viewModel.retryProviderRehydration() },
                        onReauthenticate = {
                            uiState.availableProviders.find { it.type == uiState.config.providerType }
                                ?.let { providerInfo ->
                                    selectedProviderForConfig = providerInfo
                                    showProviderConfigDialog = true
                                }
                        },
                        onDismiss = { viewModel.clearProviderWarning() }
                    )
                }

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
                onNavigateToSecurity = onNavigateToSecurity,
                onNavigateToCloudAccounts = onNavigateToCloudAccounts
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
                tint = MaterialTheme.colorScheme.tertiary,
                modifier = Modifier.size(48.dp)
            )
        },
        title = {
            Text(
                stringResource(id = R.string.sync_conflict_dialog_title),
                style = MaterialTheme.typography.headlineSmall
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text(
                    stringResource(id = R.string.sync_conflict_dialog_message),
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
                                stringResource(id = R.string.sync_conflict_local_version),
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Text(
                            stringResource(
                                id = R.string.sync_conflict_modified,
                                formatTimestamp(conflict.localData.timestamp)
                            ),
                            style = MaterialTheme.typography.bodySmall
                        )
                        Text(
                            stringResource(
                                id = R.string.sync_conflict_device,
                                "${conflict.localData.deviceId.take(8)}..."
                            ),
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
                                stringResource(id = R.string.sync_conflict_remote_version),
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Text(
                            stringResource(
                                id = R.string.sync_conflict_modified,
                                formatTimestamp(conflict.remoteData.timestamp)
                            ),
                            style = MaterialTheme.typography.bodySmall
                        )
                        Text(
                            stringResource(
                                id = R.string.sync_conflict_device,
                                "${conflict.remoteData.deviceId.take(8)}..."
                            ),
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }

                Divider()

                Text(
                    stringResource(id = R.string.sync_conflict_resolution_prompt),
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
                    Text(stringResource(id = R.string.sync_conflict_keep_local))
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
                    Text(stringResource(id = R.string.sync_conflict_keep_remote))
                }

                // Keep newest
                Button(
                    onClick = { onResolve(ConflictResolutionStrategy.NEWEST_WINS) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Schedule, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(stringResource(id = R.string.sync_conflict_keep_latest))
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(id = R.string.sync_common_cancel))
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
                    text = stringResource(id = R.string.sync_settings_title),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = stringResource(
                        id = if (enabled) {
                            R.string.sync_status_enabled
                        } else {
                            R.string.sync_status_disabled
                        }
                    ),
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
    val colorScheme = MaterialTheme.colorScheme
    val (statusColor, statusIcon, statusTextRes) = when (status) {
        SyncStatus.NEVER_SYNCED -> Triple(colorScheme.outline, Icons.Default.CloudOff, R.string.sync_status_never)
        SyncStatus.PENDING -> Triple(colorScheme.outline, Icons.Default.CloudOff, R.string.sync_status_pending)
        SyncStatus.SYNCING -> Triple(colorScheme.primary, Icons.Default.CloudSync, R.string.sync_status_syncing)
        SyncStatus.SYNCED -> Triple(colorScheme.tertiary, Icons.Default.CloudDone, R.string.sync_status_synced)
        SyncStatus.ERROR -> Triple(colorScheme.error, Icons.Default.CloudOff, R.string.sync_status_error)
        SyncStatus.CONFLICT -> Triple(colorScheme.secondary, Icons.Default.Warning, R.string.sync_status_conflict)
    }
    val statusText = stringResource(id = statusTextRes)

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
                            text = stringResource(
                                id = R.string.sync_status_pending_changes,
                                metadata.pendingChanges
                            ),
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }

                if (metadata.syncErrors.isNotEmpty()) {
                    metadata.syncErrors.take(3).forEach { error ->
                        val (icon, tint) = when (error.category) {
                            SyncErrorCategory.CONNECTION -> Icons.Default.WifiOff to colorScheme.secondary
                            SyncErrorCategory.UPLOAD -> Icons.Default.CloudUpload to colorScheme.error
                            SyncErrorCategory.DOWNLOAD -> Icons.Default.CloudDownload to colorScheme.error
                            SyncErrorCategory.DELETE -> Icons.Default.Delete to colorScheme.error
                            SyncErrorCategory.CLEANUP -> Icons.Default.DeleteSweep to colorScheme.secondary
                            SyncErrorCategory.REHYDRATION -> Icons.Default.Refresh to colorScheme.primary
                            SyncErrorCategory.GENERAL -> Icons.Default.Error to colorScheme.error
                        }

                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                icon,
                                null,
                                modifier = Modifier.size(18.dp),
                                tint = tint
                            )
                            Column {
                                Text(
                                    text = error.message,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = tint
                                )
                                Text(
                                    text = formatTimestamp(error.timestamp),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ProviderWarningCard(
    message: String,
    onRetry: () -> Unit,
    onReauthenticate: () -> Unit,
    onDismiss: () -> Unit
) {
    val containerColor = MaterialTheme.colorScheme.tertiaryContainer
    val accentColor = MaterialTheme.colorScheme.tertiary
    val textColor = MaterialTheme.colorScheme.onTertiaryContainer

    Card(
        colors = CardDefaults.cardColors(
            containerColor = containerColor
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
                    Icons.Default.WarningAmber,
                    contentDescription = null,
                    tint = accentColor,
                    modifier = Modifier.size(28.dp)
                )
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodyMedium,
                    color = textColor
                )
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedButton(onClick = onRetry) {
                    Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(stringResource(id = R.string.sync_provider_warning_retry))
                }

                Button(onClick = onReauthenticate) {
                    Icon(Icons.Default.CloudSync, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(stringResource(id = R.string.sync_provider_warning_reconfigure))
                }

                Spacer(modifier = Modifier.weight(1f))

                TextButton(
                    onClick = onDismiss,
                    colors = ButtonDefaults.textButtonColors(
                        contentColor = accentColor
                    )
                ) {
                    Text(stringResource(id = R.string.sync_provider_warning_ignore))
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
                text = stringResource(id = R.string.sync_provider_selection_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Text(
                text = stringResource(id = R.string.sync_provider_selection_subtitle),
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
                    val colorScheme = MaterialTheme.colorScheme
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
                            com.julien.genpwdpro.data.sync.providers.PrivacyLevel.MAXIMUM -> colorScheme.tertiary
                            com.julien.genpwdpro.data.sync.providers.PrivacyLevel.HIGH -> colorScheme.primary
                            else -> colorScheme.outline
                        }
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = privacyColor.copy(alpha = 0.2f)
                        ) {
                            Text(
                                text = stringResource(
                                    when (provider.privacyLevel) {
                                        com.julien.genpwdpro.data.sync.providers.PrivacyLevel.MAXIMUM ->
                                            R.string.sync_provider_privacy_max
                                        com.julien.genpwdpro.data.sync.providers.PrivacyLevel.HIGH ->
                                            R.string.sync_provider_privacy_high
                                        else -> R.string.sync_provider_privacy_standard
                                    }
                                ),
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
                            text = stringResource(
                                id = R.string.sync_provider_storage_free,
                                formatBytes(provider.freeStorage)
                            ),
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
@Composable
private fun formatBytes(bytes: Long): String {
    val context = LocalContext.current
    return when {
        bytes >= 1_000_000_000 -> context.getString(R.string.sync_bytes_gb, bytes / 1_000_000_000)
        bytes >= 1_000_000 -> context.getString(R.string.sync_bytes_mb, bytes / 1_000_000)
        bytes >= 1_000 -> context.getString(R.string.sync_bytes_kb, bytes / 1_000)
        else -> context.getString(R.string.sync_bytes_b, bytes)
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
                        text = stringResource(id = R.string.sync_auto_sync_title),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = stringResource(
                            id = if (enabled) R.string.sync_status_enabled else R.string.sync_status_disabled
                        ),
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
                    text = stringResource(id = R.string.sync_interval_title),
                    style = MaterialTheme.typography.bodyMedium
                )

                val intervalOptions = listOf(
                    900000L to stringResource(id = R.string.sync_interval_15_min),
                    1_800_000L to stringResource(id = R.string.sync_interval_30_min),
                    3_600_000L to stringResource(id = R.string.sync_interval_1_hour),
                    7_200_000L to stringResource(id = R.string.sync_interval_2_hours),
                    21_600_000L to stringResource(id = R.string.sync_interval_6_hours),
                    86_400_000L to stringResource(id = R.string.sync_interval_24_hours)
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
                text = stringResource(id = R.string.sync_actions_title),
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
                Text(stringResource(id = R.string.sync_action_sync_now))
            }

            OutlinedButton(
                onClick = onTestConnection,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Wifi, null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(stringResource(id = R.string.sync_action_test_connection))
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
                Text(stringResource(id = R.string.sync_action_reset))
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
    val colorScheme = MaterialTheme.colorScheme
    Card(
        colors = CardDefaults.cardColors(
            containerColor = colorScheme.secondary.copy(alpha = 0.1f)
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
                    tint = colorScheme.secondary
                )
                Column {
                    Text(
                        text = stringResource(id = R.string.sync_conflicts_title),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = stringResource(
                            id = R.string.sync_conflicts_count,
                            conflictCount
                        ),
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }

            Button(
                onClick = onResolve,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(stringResource(id = R.string.sync_conflicts_resolve))
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
                    text = stringResource(id = R.string.sync_encryption_title),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = stringResource(id = R.string.sync_encryption_body),
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
@Composable
private fun formatTimestamp(timestamp: Long): String {
    val context = LocalContext.current
    if (timestamp == 0L) {
        return context.getString(R.string.sync_status_never)
    }

    val now = System.currentTimeMillis()
    val diff = now - timestamp

    return when {
        diff < 60_000 -> context.getString(R.string.sync_relative_less_than_minute)
        diff < 3_600_000 -> context.getString(
            R.string.sync_relative_minutes,
            (diff / 60_000).toInt()
        )
        diff < 86_400_000 -> context.getString(
            R.string.sync_relative_hours,
            (diff / 3_600_000).toInt()
        )
        diff < 604_800_000 -> context.getString(
            R.string.sync_relative_days,
            (diff / 86_400_000).toInt()
        )
        else -> {
            val currentLocale = Locale.getDefault()
            val formatter = remember(currentLocale) {
                SimpleDateFormat("dd/MM/yyyy HH:mm", currentLocale)
            }
            formatter.format(Date(timestamp))
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
    onNavigateToSecurity: () -> Unit,
    onNavigateToCloudAccounts: () -> Unit = {}
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = stringResource(id = R.string.sync_quick_links_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            // Cloud Accounts button
            OutlinedButton(
                onClick = onNavigateToCloudAccounts,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(
                    Icons.Default.Cloud,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text("Manage Cloud Accounts")
            }

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
                Text(stringResource(id = R.string.sync_quick_link_history))
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
                Text(stringResource(id = R.string.sync_quick_link_security))
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
                Text(stringResource(id = R.string.sync_quick_link_autofill))
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

    companion object {
        private const val CONFIG_KEY_VALIDATE_SSL = "validateSSL"
    }

    private val _uiState = MutableStateFlow(
        SyncSettingsUiState(
            availableProviders = providerFactory.getProductionReadyProviders()
        )
    )
    val uiState: StateFlow<SyncSettingsUiState> = _uiState.asStateFlow()

    private var lastRehydratedProviderType: CloudProviderType? = null
    private var lastRehydrationSucceeded: Boolean = false

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

                if (savedConfig.enabled && savedConfig.providerType != CloudProviderType.NONE) {
                    val shouldAttempt =
                        savedConfig.providerType != lastRehydratedProviderType || !lastRehydrationSucceeded

                    if (shouldAttempt) {
                        val restored = runCatching {
                            cloudRepository.rehydrateActiveProvider(savedConfig.providerType)
                        }.onFailure { error ->
                            SafeLog.e(
                                "SyncSettingsViewModel",
                                "Provider rehydration failed with exception",
                                error
                            )
                        }.getOrDefault(false)

                        lastRehydratedProviderType = savedConfig.providerType
                        lastRehydrationSucceeded = restored

                        _uiState.update { state ->
                            state.copy(
                                providerWarning = if (restored) {
                                    null
                                } else {
                                    context.getString(R.string.sync_provider_warning_rehydrate_failed)
                                }
                            )
                        }
                    }
                } else {
                    lastRehydratedProviderType = null
                    lastRehydrationSucceeded = false
                    _uiState.update { state -> state.copy(providerWarning = null) }
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
                    config = state.config.copy(enabled = newEnabled),
                    providerWarning = if (newEnabled) state.providerWarning else null
                )
            }

            if (!newEnabled) {
                lastRehydratedProviderType = null
                lastRehydrationSucceeded = false
            }
        }
    }

    fun selectProvider(providerType: CloudProviderType) {
        lastRehydratedProviderType = null
        lastRehydrationSucceeded = false
        _uiState.update { state ->
            state.copy(
                config = state.config.copy(providerType = providerType),
                providerWarning = null
            )
        }
    }

    fun configureWebDAV(serverUrl: String, username: String, password: String, validateSSL: Boolean) {
        viewModelScope.launch {
            val normalizedUrl = serverUrl.trim().trimEnd('/')
            val trimmedUsername = username.trim()

            _uiState.update { it.copy(isAuthenticating = true, authenticationResult = null) }

            try {
                val provider = providerFactory.createWebDAVProvider(
                    serverUrl = normalizedUrl,
                    username = trimmedUsername,
                    password = password,
                    validateSSL = validateSSL
                )

                val isAuthenticated = provider.isAuthenticated()

                if (isAuthenticated) {
                    val providerConfig = ProviderConfig(
                        serverUrl = normalizedUrl,
                        username = trimmedUsername,
                        password = password,
                        customSettings = mapOf(CONFIG_KEY_VALIDATE_SSL to validateSSL.toString())
                    )

                    cloudRepository.setActiveProvider(
                        providerType = CloudProviderType.WEBDAV,
                        provider = provider,
                        providerConfig = providerConfig
                    )

                    syncConfigDataStore.setProviderType(CloudProviderType.WEBDAV)
                    lastRehydratedProviderType = CloudProviderType.WEBDAV
                    lastRehydrationSucceeded = true

                    _uiState.update { state ->
                        state.copy(
                            config = state.config.copy(providerType = CloudProviderType.WEBDAV),
                            isAuthenticating = false,
                            authenticationResult = AuthenticationResult.Success(
                                context.getString(R.string.sync_webdav_config_saved)
                            ),
                            providerWarning = null
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            isAuthenticating = false,
                            authenticationResult = AuthenticationResult.Failure(
                                context.getString(R.string.sync_webdav_auth_failed)
                            )
                        )
                    }
                }
            } catch (e: Exception) {
                SafeLog.e("SyncSettingsViewModel", "WebDAV configuration failed", e)
                _uiState.update {
                    it.copy(
                        isAuthenticating = false,
                        authenticationResult = AuthenticationResult.Failure(
                            e.message ?: context.getString(R.string.sync_generic_unknown_error)
                        )
                    )
                }
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
            val normalizedUrl = serverUrl.trim().trimEnd('/')
            val trimmedUsername = username.trim()

            _uiState.update { it.copy(isTestingConnection = true, testConnectionResult = null) }
            try {
                val provider = providerFactory.createWebDAVProvider(
                    serverUrl = normalizedUrl,
                    username = trimmedUsername,
                    password = password,
                    validateSSL = validateSSL
                )

                val success = provider.isAuthenticated()

                _uiState.update {
                    it.copy(
                        isTestingConnection = false,
                        testConnectionResult = if (success) {
                            TestConnectionResult.Success(
                                context.getString(R.string.sync_webdav_connection_success)
                            )
                        } else {
                            TestConnectionResult.Failure(
                                context.getString(R.string.sync_webdav_connection_failed)
                            )
                        }
                    )
                }
            } catch (e: Exception) {
                SafeLog.e("SyncSettingsViewModel", "WebDAV test connection failed", e)
                _uiState.update {
                    it.copy(
                        isTestingConnection = false,
                        testConnectionResult = TestConnectionResult.Failure(
                            e.message ?: context.getString(R.string.sync_generic_unknown_error)
                        )
                    )
                }
            }
        }
    }

    fun retryProviderRehydration() {
        viewModelScope.launch {
            val providerType = _uiState.value.config.providerType
            if (providerType == CloudProviderType.NONE) {
                _uiState.update { it.copy(providerWarning = null) }
                return@launch
            }

            val restored = runCatching {
                cloudRepository.rehydrateActiveProvider(providerType)
            }.onFailure { error ->
                SafeLog.e("SyncSettingsViewModel", "Provider rehydration retry failed", error)
            }.getOrDefault(false)

            lastRehydratedProviderType = providerType
            lastRehydrationSucceeded = restored

            _uiState.update { state ->
                state.copy(
                    providerWarning = if (restored) {
                        null
                    } else {
                        context.getString(R.string.sync_provider_warning_rehydrate_failed)
                    }
                )
            }
        }
    }

    fun clearProviderWarning() {
        _uiState.update { it.copy(providerWarning = null) }
    }

    private fun createSyncErrorEntry(
        message: String,
        category: SyncErrorCategory = SyncErrorCategory.GENERAL
    ): SyncErrorLogEntry {
        return SyncErrorLogEntry(
            message = message,
            category = category,
            timestamp = System.currentTimeMillis()
        )
    }

    private fun LocalSyncMetadata.prependError(entry: SyncErrorLogEntry): LocalSyncMetadata {
        val updatedErrors = buildList {
            add(entry)
            addAll(syncErrors)
        }.take(10)
        return copy(syncErrors = updatedErrors)
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

                        lastRehydratedProviderType = providerType
                        lastRehydrationSucceeded = true

                        _uiState.update { state ->
                            state.copy(
                                config = state.config.copy(providerType = providerType),
                                isAuthenticating = false,
                                authenticationResult = AuthenticationResult.Success(
                                    context.getString(R.string.sync_authentication_success)
                                ),
                                providerWarning = null
                            )
                        }
                    } else {
                        _uiState.update {
                            it.copy(
                                isAuthenticating = false,
                                authenticationResult = AuthenticationResult.Failure(
                                    context.getString(R.string.sync_authentication_failure)
                                )
                            )
                        }
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            isAuthenticating = false,
                            authenticationResult = AuthenticationResult.Failure(
                                context.getString(R.string.sync_provider_not_supported)
                            )
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isAuthenticating = false,
                        authenticationResult = AuthenticationResult.Failure(
                            e.message ?: context.getString(R.string.sync_generic_unknown_error)
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
                        val metadata = syncManager.getMetadata()
                        _uiState.update {
                            it.copy(
                                status = SyncStatus.CONFLICT,
                                currentConflict = result,
                                metadata = metadata.copy(
                                    conflictCount = 1
                                )
                            )
                        }
                    }
                    is SyncResult.Error -> {
                        SafeLog.e("SyncSettingsViewModel", "Sync error: ${result.message}")
                        val metadata = syncManager.getMetadata()
                        _uiState.update {
                            it.copy(
                                status = SyncStatus.ERROR,
                        metadata = metadata.prependError(
                            createSyncErrorEntry(result.message)
                        )
                            )
                        }
                    }
                }
            } catch (e: Exception) {
                SafeLog.e("SyncSettingsViewModel", "Sync failed with exception", e)
                val metadata = syncManager.getMetadata()
                _uiState.update {
                    it.copy(
                        status = SyncStatus.ERROR,
                        metadata = metadata.prependError(
                            createSyncErrorEntry(
                                e.message ?: context.getString(R.string.sync_generic_unknown_error)
                            )
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
                            TestConnectionResult.Success(
                                context.getString(R.string.sync_test_connection_success)
                            )
                        } else {
                            TestConnectionResult.Failure(
                                context.getString(R.string.sync_test_connection_failure)
                            )
                        }
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isTestingConnection = false,
                        testConnectionResult = TestConnectionResult.Failure(
                            e.message ?: context.getString(R.string.sync_generic_unknown_error)
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

            lastRehydratedProviderType = null
            lastRehydrationSucceeded = false

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
                val metadata = syncManager.getMetadata()
                _uiState.update {
                    it.copy(
                        status = SyncStatus.SYNCED,
                        currentConflict = null,
                        metadata = metadata.copy(conflictCount = 0)
                    )
                }
            } catch (e: Exception) {
                SafeLog.e("SyncSettingsViewModel", "Error resolving conflict", e)
                val metadata = syncManager.getMetadata()
                _uiState.update {
                    it.copy(
                        status = SyncStatus.ERROR,
                        metadata = metadata.prependError(
                            createSyncErrorEntry(
                                e.message ?: context.getString(R.string.sync_conflict_resolution_error)
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
    val currentConflict: SyncResult.Conflict? = null,
    val providerWarning: String? = null
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
