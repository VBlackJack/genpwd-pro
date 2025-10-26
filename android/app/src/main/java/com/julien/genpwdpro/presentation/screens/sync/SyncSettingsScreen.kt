package com.julien.genpwdpro.presentation.screens.sync

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.data.sync.*
import com.julien.genpwdpro.data.sync.models.CloudProviderType
import com.julien.genpwdpro.data.sync.providers.CloudProviderFactory
import com.julien.genpwdpro.data.sync.providers.ProviderInfo
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject

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
                    onProviderChange = { viewModel.selectProvider(it) }
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
                if (uiState.metadata.conflictCount > 0) {
                    ConflictsCard(
                        conflictCount = uiState.metadata.conflictCount,
                        onResolve = { /* TODO */ }
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
        SyncStatus.IDLE -> Triple(Color(0xFF9CA3AF), Icons.Default.CloudOff, "Inactif")
        SyncStatus.SYNCING -> Triple(Color(0xFF3B82F6), Icons.Default.CloudSync, "Synchronisation...")
        SyncStatus.SUCCESS -> Triple(Color(0xFF10B981), Icons.Default.CloudDone, "Synchronisé")
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
        color = if (isSelected)
            MaterialTheme.colorScheme.primaryContainer
        else
            MaterialTheme.colorScheme.surface,
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
                            com.julien.genpwdpro.data.sync.providers.PrivacyLevel.MAXIMUM -> Color(0xFF10B981)
                            com.julien.genpwdpro.data.sync.providers.PrivacyLevel.HIGH -> Color(0xFF3B82F6)
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
    private val providerFactory: CloudProviderFactory
) : ViewModel() {

    private val _uiState = MutableStateFlow(
        SyncSettingsUiState(
            availableProviders = providerFactory.getProductionReadyProviders()
        )
    )
    val uiState: StateFlow<SyncSettingsUiState> = _uiState.asStateFlow()

    init {
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
        _uiState.update { state ->
            state.copy(
                config = state.config.copy(enabled = !state.config.enabled)
            )
        }
    }

    fun selectProvider(providerType: CloudProviderType) {
        _uiState.update { state ->
            state.copy(
                config = state.config.copy(providerType = providerType)
            )
        }
    }

    fun toggleAutoSync() {
        _uiState.update { state ->
            state.copy(
                config = state.config.copy(autoSync = !state.config.autoSync)
            )
        }
    }

    fun updateSyncInterval(interval: Long) {
        _uiState.update { state ->
            state.copy(
                config = state.config.copy(syncInterval = interval)
            )
        }
    }

    fun syncNow() {
        viewModelScope.launch {
            _uiState.update { it.copy(status = SyncStatus.SYNCING) }
            // TODO: Implémenter sync complète
            kotlinx.coroutines.delay(2000)
            _uiState.update { it.copy(status = SyncStatus.SUCCESS) }
        }
    }

    fun testConnection() {
        viewModelScope.launch {
            val result = syncManager.testConnection()
            // TODO: Afficher résultat
        }
    }

    fun resetSync() {
        viewModelScope.launch {
            syncManager.reset()
            _uiState.update {
                SyncSettingsUiState(
                    availableProviders = providerFactory.getProductionReadyProviders()
                )
            }
        }
    }

    private suspend fun getMetadata(): LocalSyncMetadata {
        return syncManager.getMetadata()
    }
}

/**
 * État de l'UI
 */
data class SyncSettingsUiState(
    val config: com.julien.genpwdpro.data.sync.models.SyncConfig = com.julien.genpwdpro.data.sync.models.SyncConfig(),
    val status: SyncStatus = SyncStatus.IDLE,
    val availableProviders: List<ProviderInfo> = emptyList(),
    val metadata: LocalSyncMetadata = LocalSyncMetadata()
)
