package com.julien.genpwdpro.presentation.screens.sync

import android.app.Activity
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.sync.AutoSyncScheduler
import com.julien.genpwdpro.data.sync.CloudProvider
import com.julien.genpwdpro.data.sync.SyncPreferencesManager
import com.julien.genpwdpro.data.sync.VaultSyncManager
import com.julien.genpwdpro.data.sync.credentials.ProviderCredentialManager
import com.julien.genpwdpro.data.sync.providers.ProviderConfig
import com.julien.genpwdpro.data.sync.providers.PCloudProvider
import com.julien.genpwdpro.data.sync.models.*
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlin.text.toBooleanStrictOrNull

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
    private val credentialManager: ProviderCredentialManager
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

    private suspend fun instantiateProviderForType(
        providerType: CloudProviderType
    ): Pair<CloudProvider?, ProviderConfig?> {
        return when (providerType) {
            CloudProviderType.GOOGLE_DRIVE -> {
                providerFactory.createProvider(CloudProviderType.GOOGLE_DRIVE) to null
            }

            CloudProviderType.ONEDRIVE -> {
                val config = credentialManager.getProviderConfig(providerType, ProviderConfig::class.java)
                val clientId = config?.customSettings?.get("clientId")

                if (clientId.isNullOrBlank()) {
                    null to null
                } else {
                    providerFactory.createOneDriveProvider(clientId) to config
                }
            }

            CloudProviderType.PROTON_DRIVE -> {
                val config = credentialManager.getProviderConfig(providerType, ProviderConfig::class.java)
                val clientId = config?.customSettings?.get("clientId")
                val clientSecret = config?.customSettings?.get("clientSecret")

                if (clientId.isNullOrBlank() || clientSecret.isNullOrBlank()) {
                    null to null
                } else {
                    providerFactory.createProtonDriveProvider(clientId, clientSecret) to config
                }
            }

            CloudProviderType.PCLOUD -> {
                val config = credentialManager.getProviderConfig(providerType, ProviderConfig::class.java)
                val appKey = config?.customSettings?.get("appKey")
                val appSecret = config?.customSettings?.get("appSecret")
                val region = config?.customSettings?.get("region")
                    ?.let { runCatching { PCloudProvider.PCloudRegion.valueOf(it) }.getOrNull() }
                    ?: PCloudProvider.PCloudRegion.EU

                if (appKey.isNullOrBlank() || appSecret.isNullOrBlank()) {
                    null to null
                } else {
                    providerFactory.createPCloudProvider(appKey, appSecret, region) to config
                }
            }

            CloudProviderType.WEBDAV -> {
                var config = credentialManager.getProviderConfig(providerType, ProviderConfig::class.java)

                if (config == null) {
                    val credentials = preferencesManager.getWebDAVCredentials()
                    if (credentials != null) {
                        config = ProviderConfig(
                            serverUrl = credentials.serverUrl,
                            username = credentials.username,
                            password = credentials.password,
                            customSettings = mapOf("validateSSL" to credentials.validateSSL.toString())
                        )
                        credentialManager.saveProviderConfig(providerType, config!!)
                    }
                }

                val serverUrl = config?.serverUrl
                val username = config?.username
                val password = config?.password
                val validateSSL = config?.customSettings?.get("validateSSL")?.toBooleanStrictOrNull() ?: true

                if (serverUrl.isNullOrBlank() || username.isNullOrBlank() || password.isNullOrBlank()) {
                    null to null
                } else {
                    providerFactory.createWebDAVProvider(serverUrl, username, password, validateSSL) to config
                }
            }

            CloudProviderType.NONE -> null to null
        }
    }

    /**
     * Connecte au provider sélectionné
     */
    fun connectToProvider(activity: Activity, providerType: CloudProviderType) {
        viewModelScope.launch {
            _uiState.update { it.copy(isConnecting = true, errorMessage = null) }

            try {
                // Créer (ou réhydrater) le provider avec sa configuration
                val (provider, providerConfig) = instantiateProviderForType(providerType)

                if (provider == null) {
                    _uiState.update {
                        it.copy(
                            isConnecting = false,
                            errorMessage = "Configuration du provider requise"
                        )
                    }
                    return@launch
                }

                // Vérifier le statut d'implémentation
                val providerInfo = providerFactory.getProviderInfo(providerType)
                if (providerInfo.implementationStatus != com.julien.genpwdpro.data.sync.providers.ImplementationStatus.PRODUCTION_READY) {
                    _uiState.update {
                        it.copy(
                            isConnecting = false,
                            errorMessage = "${providerInfo.name} n'est pas encore complètement implémenté. Status: ${providerInfo.implementationStatus}"
                        )
                    }
                    return@launch
                }

                // Configurer le provider
                vaultSyncManager.setProvider(provider, providerType, providerConfig)

                // Authentifier
                val success = vaultSyncManager.authenticate(activity)

                _uiState.update {
                    it.copy(
                        isConnecting = false,
                        isAuthenticated = success,
                        errorMessage = if (success) null else "Échec de l'authentification"
                    )
                }

                if (success) {
                    loadStorageQuota()
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isConnecting = false,
                        errorMessage = e.message ?: "Erreur inconnue"
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
                    it.copy(errorMessage = "Erreur lors de la déconnexion: ${e.message}")
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
                                lastSyncMessage = "Synchronisation réussie"
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
                                errorMessage = "Conflit détecté - résolution requise"
                            )
                        }
                    }
                    is SyncResult.Error -> {
                        _uiState.update {
                            it.copy(
                                isSyncing = false,
                                errorMessage = "Erreur: ${result.message}"
                            )
                        }
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isSyncing = false,
                        errorMessage = "Erreur: ${e.message}"
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

                _uiState.update {
                    it.copy(
                        isSyncing = false,
                        lastSyncMessage = if (success) "Téléchargement réussi" else "Échec du téléchargement",
                        errorMessage = if (!success) "Impossible de télécharger le vault" else null
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isSyncing = false,
                        errorMessage = "Erreur: ${e.message}"
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

                _uiState.update {
                    it.copy(
                        isSyncing = false,
                        conflictData = if (success) null else conflictData,
                        lastSyncMessage = if (success) "Conflit résolu" else "Échec de la résolution",
                        errorMessage = if (!success) "Impossible de résoudre le conflit" else null
                    )
                }

                if (success) {
                    loadStorageQuota()
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isSyncing = false,
                        errorMessage = "Erreur: ${e.message}"
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

            autoSyncScheduler.schedulePeriodicSync(
                vaultId = vaultId,
                masterPassword = masterPassword,
                interval = interval,
                wifiOnly = wifiOnly
            )
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
        vaultSyncManager.setAutoSync(true, interval)

        // Replanifier si la sync auto est activée
        if (_uiState.value.config.autoSync) {
            autoSyncScheduler.schedulePeriodicSync(
                vaultId = vaultId,
                masterPassword = masterPassword,
                interval = interval,
                wifiOnly = _uiState.value.config.syncOnWifiOnly
            )
        }
    }

    /**
     * Active/désactive la sync uniquement en WiFi
     */
    fun toggleWifiOnly(vaultId: String, masterPassword: String) {
        val newValue = !_uiState.value.config.syncOnWifiOnly
        vaultSyncManager.setSyncOnWifiOnly(newValue)

        // Replanifier si la sync auto est activée
        if (_uiState.value.config.autoSync) {
            autoSyncScheduler.schedulePeriodicSync(
                vaultId = vaultId,
                masterPassword = masterPassword,
                interval = _uiState.value.config.syncInterval,
                wifiOnly = newValue
            )
        }
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
                    it.copy(errorMessage = "Erreur lors du listage: ${e.message}")
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
                    it.copy(errorMessage = "Erreur de configuration WebDAV: ${e.message}")
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
                    onResult(
                        true,
                        "Connexion réussie! Espace: ${formatBytes(quota.usedBytes)} / ${formatBytes(
                            quota.totalBytes
                        )}"
                    )
                } else {
                    onResult(false, "Échec de l'authentification. Vérifiez vos identifiants.")
                }
            } catch (e: Exception) {
                _syncProgressState.value = SyncProgressState.Idle
                onResult(
                    false,
                    "Erreur de connexion: ${e.message ?: "Impossible d'accéder au serveur"}"
                )
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
                    it.copy(errorMessage = "Erreur de déconnexion: ${e.message}")
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

    /**
     * Formate les bytes en format lisible
     */
    private fun formatBytes(bytes: Long): String {
        return when {
            bytes < 1024 -> "$bytes B"
            bytes < 1024 * 1024 -> "${bytes / 1024} KB"
            bytes < 1024 * 1024 * 1024 -> "${bytes / (1024 * 1024)} MB"
            else -> String.format("%.2f GB", bytes / (1024.0 * 1024.0 * 1024.0))
        }
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
