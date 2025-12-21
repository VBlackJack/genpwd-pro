package com.julien.genpwdpro.presentation.screens.sync

import android.app.Activity
import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.genpwd.providers.api.CloudErrorType
import com.julien.genpwdpro.R
import com.julien.genpwdpro.data.sync.AutoSyncScheduler
import com.julien.genpwdpro.data.sync.CloudProviderSyncRepository
import com.julien.genpwdpro.data.sync.SyncPreferencesManager
import com.julien.genpwdpro.data.sync.VaultSyncManager
import com.julien.genpwdpro.data.sync.credentials.ProviderCredentialManager
import com.julien.genpwdpro.data.sync.models.*
import com.julien.genpwdpro.data.sync.providers.ProviderConfig
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

/**
 * ViewModel pour la gestion de la synchronisation des vaults
 *
 * Gère:
 * - Configuration du provider cloud
 * - Authentication OAuth2
 * - Synchronisation manuelle et automatique
 * - Résolution de conflits
 * - Quota de stockage
 */
@HiltViewModel
class VaultSyncViewModel @Inject constructor(
    private val vaultSyncManager: VaultSyncManager,
    private val autoSyncScheduler: AutoSyncScheduler,
    private val providerFactory: com.julien.genpwdpro.data.sync.providers.CloudProviderFactory,
    private val preferencesManager: SyncPreferencesManager,
    private val credentialManager: ProviderCredentialManager,
    private val cloudRepository: CloudProviderSyncRepository,
    @ApplicationContext private val appContext: Context
) : ViewModel() {

    private val _uiState = MutableStateFlow(VaultSyncUiState())
    val uiState: StateFlow<VaultSyncUiState> = _uiState.asStateFlow()

    // État de progression de la synchronisation
    private val _syncProgressState = MutableStateFlow<SyncProgressState>(SyncProgressState.Idle)
    val syncProgressState: StateFlow<SyncProgressState> = _syncProgressState.asStateFlow()

    // Quota de stockage
    private val _storageQuota = MutableStateFlow<StorageQuota?>(null)
    val storageQuota: StateFlow<StorageQuota?> = _storageQuota.asStateFlow()

    init {
        // Observer la configuration
        viewModelScope.launch {
            vaultSyncManager.config.collect { config ->
                _uiState.update { it.copy(config = config) }
            }
        }

        // Observer le statut de sync
        viewModelScope.launch {
            vaultSyncManager.syncStatus.collect { status ->
                _uiState.update { it.copy(syncStatus = status) }
            }
        }

        // Charger le quota de stockage
        loadStorageQuota()
    }

    /**
     * Sélectionne un provider cloud
     */
    fun selectProvider(providerType: CloudProviderType) {
        _uiState.update { it.copy(selectedProvider = providerType) }
    }

    private fun prepareProvider(
        providerType: CloudProviderType
    ): CloudProviderSyncRepository.ProviderPreparationResult {
        return cloudRepository.prepareConfiguredProvider(providerType)
    }

    private fun formatErrorMessage(detail: String?): String {
        val message = detail?.ifBlank { null }
        return if (message == null) {
            appContext.getString(R.string.sync_error_unknown)
        } else {
            appContext.getString(R.string.sync_error_with_detail, message)
        }
    }

    private fun formatDisconnectError(detail: String?): String {
        val message = detail?.ifBlank { null }
        return if (message == null) {
            appContext.getString(R.string.sync_disconnect_error_generic)
        } else {
            appContext.getString(R.string.sync_disconnect_error_with_detail, message)
        }
    }

    private fun formatConflictResolutionMessage(success: Boolean): Pair<String?, String?> {
        return if (success) {
            appContext.getString(R.string.sync_conflict_resolved) to null
        } else {
            null to appContext.getString(R.string.sync_conflict_resolution_unavailable)
        }
    }

    private fun formatDownloadMessage(success: Boolean): Pair<String?, String?> {
        return if (success) {
            appContext.getString(R.string.sync_download_success) to null
        } else {
            appContext.getString(R.string.sync_download_failure) to appContext.getString(R.string.sync_download_unavailable)
        }
    }

    private fun formatOperationError(detail: String?): String {
        val message = detail?.ifBlank { null }
        return if (message == null) {
            appContext.getString(R.string.sync_error_unknown)
        } else {
            appContext.getString(R.string.sync_error_with_detail, message)
        }
    }

    /**
     * Maps CloudErrorType to user-friendly error messages.
     * Provides actionable messages for each error type.
     */
    private fun mapCloudErrorToMessage(errorType: CloudErrorType?, fallbackMessage: String?): String {
        return when (errorType) {
            CloudErrorType.AUTH_EXPIRED -> appContext.getString(R.string.sync_error_auth_expired)
            CloudErrorType.NETWORK -> appContext.getString(R.string.sync_error_network)
            CloudErrorType.QUOTA_EXCEEDED -> appContext.getString(R.string.sync_error_quota_exceeded)
            CloudErrorType.NOT_FOUND -> appContext.getString(R.string.sync_error_not_found)
            CloudErrorType.RATE_LIMITED -> appContext.getString(R.string.sync_error_rate_limited)
            CloudErrorType.PERMISSION_DENIED -> appContext.getString(R.string.sync_error_permission_denied)
            CloudErrorType.CONFLICT -> appContext.getString(R.string.sync_error_conflict)
            CloudErrorType.GENERIC, null -> formatOperationError(fallbackMessage)
        }
    }

    private fun formatWebDavConnectionError(detail: String?): String {
        val message = detail?.ifBlank { null } ?: appContext.getString(R.string.sync_webdav_connection_unreachable)
        return appContext.getString(R.string.sync_webdav_connection_error, message)
    }

    private fun formatWebDavDisconnectError(detail: String?): String {
        val message = detail?.ifBlank { null }
        return if (message == null) {
            appContext.getString(R.string.sync_webdav_disconnect_unknown)
        } else {
            appContext.getString(R.string.sync_webdav_disconnect_error, message)
        }
    }

    private fun formatQuotaMessage(used: String, total: String): String {
        return appContext.getString(R.string.sync_webdav_connection_success_detail, used, total)
    }

    private fun formatBytes(bytes: Long): String {
        return when {
            bytes < 1024 -> appContext.getString(R.string.sync_bytes_format_b, bytes)
            bytes < 1024 * 1024 -> appContext.getString(R.string.sync_bytes_format_kb, bytes / 1024)
            bytes < 1024 * 1024 * 1024 -> appContext.getString(R.string.sync_bytes_format_mb, bytes / (1024 * 1024))
            else -> appContext.getString(R.string.sync_bytes_format_gb, bytes / (1024.0 * 1024.0 * 1024.0))
        }
    }

    /**
     * Connecte au provider sélectionné
     */
    fun connectToProvider(activity: Activity, providerType: CloudProviderType) {
        viewModelScope.launch {
            _uiState.update { it.copy(isConnecting = true, errorMessage = null) }

            try {
                when (val preparation = prepareProvider(providerType)) {
                    is CloudProviderSyncRepository.ProviderPreparationResult.Success -> {
                        val providerInfo = providerFactory.getProviderInfo(providerType)
                        if (providerInfo.implementationStatus != com.julien.genpwdpro.data.sync.providers.ImplementationStatus.PRODUCTION_READY) {
                            _uiState.update {
                                it.copy(
                                    isConnecting = false,
                                    errorMessage = appContext.getString(
                                        R.string.sync_provider_not_ready,
                                        providerInfo.name,
                                        providerInfo.implementationStatus
                                    )
                                )
                            }
                            return@launch
                        }

                        vaultSyncManager.setProvider(
                            preparation.provider,
                            providerType,
                            preparation.providerConfig
                        )

                        val success = vaultSyncManager.authenticate(activity)

                        _uiState.update {
                            it.copy(
                                isConnecting = false,
                                isAuthenticated = success,
                                errorMessage = if (success) null else appContext.getString(R.string.sync_authentication_failed)
                            )
                        }

                        if (success) {
                            loadStorageQuota()
                        }
                    }

                    CloudProviderSyncRepository.ProviderPreparationResult.MissingConfiguration -> {
                        _uiState.update {
                            it.copy(
                                isConnecting = false,
                                errorMessage = appContext.getString(R.string.sync_provider_configuration_required)
                            )
                        }
                        return@launch
                    }

                    CloudProviderSyncRepository.ProviderPreparationResult.UnsupportedProvider -> {
                        _uiState.update {
                            it.copy(
                                isConnecting = false,
                                errorMessage = appContext.getString(R.string.sync_error_unknown)
                            )
                        }
                        return@launch
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isConnecting = false,
                        errorMessage = formatErrorMessage(e.message)
                    )
                }
            }
        }
    }

    /**
     * Récupère les informations de tous les providers
     */
    fun getAllProviderInfo(): List<com.julien.genpwdpro.data.sync.providers.ProviderInfo> {
        return providerFactory.getAllProviders()
    }

    /**
     * Récupère les providers prêts pour la production
     */
    fun getProductionReadyProviders(): List<com.julien.genpwdpro.data.sync.providers.ProviderInfo> {
        return providerFactory.getProductionReadyProviders()
    }

    /**
     * Déconnecte du provider
     */
    fun disconnect() {
        viewModelScope.launch {
            try {
                vaultSyncManager.disconnect()
                autoSyncScheduler.cancelPeriodicSync()

                _uiState.update {
                    it.copy(
                        isAuthenticated = false,
                        selectedProvider = CloudProviderType.NONE,
                        storageQuota = null
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(errorMessage = formatDisconnectError(e.message))
                }
            }
        }
    }

    /**
     * Synchronise un vault maintenant
     */
    fun syncVault(vaultId: String, masterPassword: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSyncing = true, errorMessage = null) }

            try {
                val result = vaultSyncManager.syncVault(vaultId, masterPassword)

                when (result) {
                    is SyncResult.Success -> {
                        _uiState.update {
                            it.copy(
                                isSyncing = false,
                                lastSyncMessage = appContext.getString(R.string.sync_manual_success)
                            )
                        }
                        loadStorageQuota()
                    }
                    is SyncResult.Conflict -> {
                        _uiState.update {
                            it.copy(
                                isSyncing = false,
                                conflictData = ConflictData(
                                    local = result.localVersion,
                                    remote = result.remoteVersion
                                ),
                                errorMessage = appContext.getString(R.string.sync_conflict_requires_resolution)
                            )
                        }
                    }
                    is SyncResult.Error -> {
                        _uiState.update {
                            it.copy(
                                isSyncing = false,
                                errorMessage = mapCloudErrorToMessage(result.errorType, result.message)
                            )
                        }
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isSyncing = false,
                        errorMessage = formatOperationError(e.message)
                    )
                }
            }
        }
    }

    /**
     * Télécharge un vault depuis le cloud
     */
    fun downloadVault(vaultId: String, masterPassword: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSyncing = true, errorMessage = null) }

            try {
                val success = vaultSyncManager.downloadVault(vaultId, masterPassword)

                val (message, error) = formatDownloadMessage(success)

                _uiState.update {
                    it.copy(
                        isSyncing = false,
                        lastSyncMessage = message,
                        errorMessage = error
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isSyncing = false,
                        errorMessage = formatOperationError(e.message)
                    )
                }
            }
        }
    }

    /**
     * Résout un conflit
     */
    fun resolveConflict(strategy: ConflictResolutionStrategy, masterPassword: String) {
        viewModelScope.launch {
            val conflictData = _uiState.value.conflictData ?: return@launch

            _uiState.update { it.copy(isSyncing = true, errorMessage = null) }

            try {
                val success = vaultSyncManager.resolveConflict(
                    conflictData.local,
                    conflictData.remote,
                    strategy,
                    masterPassword
                )

                val (message, error) = formatConflictResolutionMessage(success)

                _uiState.update {
                    it.copy(
                        isSyncing = false,
                        conflictData = if (success) null else conflictData,
                        lastSyncMessage = message,
                        errorMessage = error
                    )
                }

                if (success) {
                    loadStorageQuota()
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isSyncing = false,
                        errorMessage = formatOperationError(e.message)
                    )
                }
            }
        }
    }

    /**
     * Active/désactive la synchronisation automatique
     */
    fun toggleAutoSync(vaultId: String, masterPassword: String) {
        val newEnabled = !_uiState.value.config.autoSync

        if (newEnabled) {
            // Activer la sync auto
            val interval = _uiState.value.config.syncInterval
            val wifiOnly = _uiState.value.config.syncOnWifiOnly

            val scheduled = autoSyncScheduler.schedulePeriodicSync(
                vaultId = vaultId,
                masterPassword = masterPassword,
                interval = interval,
                wifiOnly = wifiOnly
            )
            if (!scheduled) {
                handleAutoSyncSchedulingFailure()
                return
            }
        } else {
            // Désactiver la sync auto
            autoSyncScheduler.cancelPeriodicSync()
        }

        vaultSyncManager.setAutoSync(newEnabled)
    }

    /**
     * Change l'intervalle de synchronisation
     */
    fun changeSyncInterval(interval: SyncInterval, vaultId: String, masterPassword: String) {
        val autoSyncEnabled = _uiState.value.config.autoSync

        // Replanifier si la sync auto est activée
        if (autoSyncEnabled) {
            val scheduled = autoSyncScheduler.schedulePeriodicSync(
                vaultId = vaultId,
                masterPassword = masterPassword,
                interval = interval,
                wifiOnly = _uiState.value.config.syncOnWifiOnly
            )
            if (!scheduled) {
                vaultSyncManager.setAutoSync(false)
                handleAutoSyncSchedulingFailure()
                return
            }
        }

        vaultSyncManager.setAutoSync(autoSyncEnabled, interval)
    }

    /**
     * Active/désactive la sync uniquement en WiFi
     */
    fun toggleWifiOnly(vaultId: String, masterPassword: String) {
        val newValue = !_uiState.value.config.syncOnWifiOnly
        // Replanifier si la sync auto est activée
        if (_uiState.value.config.autoSync) {
            val scheduled = autoSyncScheduler.schedulePeriodicSync(
                vaultId = vaultId,
                masterPassword = masterPassword,
                interval = _uiState.value.config.syncInterval,
                wifiOnly = newValue
            )
            if (!scheduled) {
                vaultSyncManager.setSyncOnWifiOnly(!newValue)
                handleAutoSyncSchedulingFailure()
                return
            }
        }

        vaultSyncManager.setSyncOnWifiOnly(newValue)
    }

    /**
     * Liste les vaults disponibles sur le cloud
     */
    fun listCloudVaults() {
        viewModelScope.launch {
            try {
                val vaultIds = vaultSyncManager.listCloudVaults()
                _uiState.update { it.copy(cloudVaults = vaultIds) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(errorMessage = appContext.getString(R.string.sync_listing_error, e.message ?: appContext.getString(R.string.sync_error_unknown)))
                }
            }
        }
    }

    /**
     * Charge le quota de stockage
     */
    private fun loadStorageQuota() {
        viewModelScope.launch {
            try {
                val quota = vaultSyncManager.getStorageQuota()
                _uiState.update { it.copy(storageQuota = quota) }
            } catch (e: Exception) {
                // Silently fail - quota is not critical
            }
        }
    }

    private fun handleAutoSyncSchedulingFailure() {
        _uiState.update {
            it.copy(
                errorMessage = appContext.getString(R.string.sync_auto_secret_unavailable)
            )
        }
    }

    /**
     * Efface les messages d'erreur
     */
    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    /**
     * Configure WebDAV avec les credentials fournis
     */
    fun configureWebDAV(
        serverUrl: String,
        username: String,
        password: String,
        validateSSL: Boolean
    ) {
        viewModelScope.launch {
            try {
                // Sauvegarder les credentials de manière sécurisée
                preferencesManager.setWebDAVCredentials(
                    serverUrl = serverUrl,
                    username = username,
                    password = password,
                    validateSSL = validateSSL
                )

                val providerConfig = ProviderConfig(
                    serverUrl = serverUrl,
                    username = username,
                    password = password,
                    customSettings = mapOf("validateSSL" to validateSSL.toString())
                )
                credentialManager.saveProviderConfig(CloudProviderType.WEBDAV, providerConfig)

                // Créer le provider WebDAV
                val webDAVProvider = providerFactory.createWebDAVProvider(
                    serverUrl = serverUrl,
                    username = username,
                    password = password,
                    validateSSL = validateSSL
                )

                // Configurer le manager
                vaultSyncManager.setProvider(webDAVProvider, CloudProviderType.WEBDAV, providerConfig)

                _uiState.update {
                    it.copy(
                        selectedProvider = CloudProviderType.WEBDAV,
                        isAuthenticated = true,
                        errorMessage = null
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        errorMessage = appContext.getString(
                            R.string.sync_webdav_configuration_error,
                            e.message ?: appContext.getString(R.string.sync_error_unknown)
                        )
                    )
                }
            }
        }
    }

    /**
     * Teste la connexion WebDAV
     */
    fun testWebDAVConnection(
        serverUrl: String,
        username: String,
        password: String,
        validateSSL: Boolean,
        onResult: (success: Boolean, message: String) -> Unit
    ) {
        viewModelScope.launch {
            try {
                _syncProgressState.value = SyncProgressState.Connecting

                // Créer un provider temporaire pour tester
                val testProvider = providerFactory.createWebDAVProvider(
                    serverUrl = serverUrl,
                    username = username,
                    password = password,
                    validateSSL = validateSSL
                )

                // Tester l'authentification
                val isAuthenticated = testProvider.isAuthenticated()

                _syncProgressState.value = SyncProgressState.Idle

                if (isAuthenticated) {
                    // Essayer de récupérer le quota pour vérifier complètement
                val quota = testProvider.getStorageQuota()
                    val used = formatBytes(quota.usedBytes)
                    val total = formatBytes(quota.totalBytes)
                    onResult(true, formatQuotaMessage(used, total))
                } else {
                    onResult(false, appContext.getString(R.string.sync_webdav_authentication_failed))
                }
            } catch (e: Exception) {
                _syncProgressState.value = SyncProgressState.Idle
                onResult(false, formatWebDavConnectionError(e.message))
            }
        }
    }

    /**
     * Déconnecte du provider actuel
     */
    fun disconnectProvider() {
        viewModelScope.launch {
            try {
                // Effacer les credentials du provider actuel
                preferencesManager.clearCurrentProviderCredentials()

                // Réinitialiser le provider
                preferencesManager.setCurrentProvider(CloudProviderType.NONE)

                // Déconnecter le manager
                vaultSyncManager.disconnect()

                // Annuler les syncs planifiées
                autoSyncScheduler.cancelPeriodicSync()

                _uiState.update {
                    it.copy(
                        selectedProvider = CloudProviderType.NONE,
                        isAuthenticated = false,
                        storageQuota = null
                    )
                }

                _storageQuota.value = null
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(errorMessage = formatWebDavDisconnectError(e.message))
                }
            }
        }
    }

    /**
     * Active/désactive l'auto-sync
     */
    fun toggleAutoSync(enabled: Boolean) {
        viewModelScope.launch {
            preferencesManager.setAutoSyncEnabled(enabled)

            if (!enabled) {
                autoSyncScheduler.cancelPeriodicSync()
            }

            _uiState.update {
                it.copy(config = it.config.copy(autoSync = enabled))
            }
        }
    }

    /**
     * Définit l'intervalle de synchronisation
     */
    fun setSyncInterval(interval: SyncInterval) {
        viewModelScope.launch {
            preferencesManager.setSyncInterval(interval)

            _uiState.update {
                it.copy(config = it.config.copy(syncInterval = interval))
            }
        }
    }

    /**
     * Récupère les statistiques de synchronisation
     */
    fun getSyncStatistics(): com.julien.genpwdpro.data.sync.SyncStatistics {
        return preferencesManager.getSyncStatistics()
    }

    /**
     * Met à jour l'état de progression
     */
    fun updateSyncProgress(state: SyncProgressState) {
        _syncProgressState.value = state
    }

}

/**
 * État de l'UI pour la synchronisation
 */
data class VaultSyncUiState(
    val config: SyncConfig = SyncConfig(),
    val syncStatus: SyncStatus = SyncStatus.NEVER_SYNCED,
    val selectedProvider: CloudProviderType = CloudProviderType.NONE,
    val isAuthenticated: Boolean = false,
    val isConnecting: Boolean = false,
    val isSyncing: Boolean = false,
    val storageQuota: StorageQuota? = null,
    val cloudVaults: List<String> = emptyList(),
    val conflictData: ConflictData? = null,
    val lastSyncMessage: String? = null,
    val errorMessage: String? = null
)

/**
 * Données de conflit
 */
data class ConflictData(
    val local: VaultSyncData,
    val remote: VaultSyncData
)
