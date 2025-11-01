package com.julien.genpwdpro.data.sync

import android.content.Context
import android.content.SharedPreferences
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.data.encryption.EncryptedDataEncoded
import com.julien.genpwdpro.data.sync.CloudProvider
import com.julien.genpwdpro.data.sync.credentials.ProviderCredentialManager
import com.julien.genpwdpro.data.sync.models.CloudProviderType
import com.julien.genpwdpro.data.sync.models.VaultSyncData
import com.julien.genpwdpro.data.sync.providers.CloudProviderFactory
import com.julien.genpwdpro.data.sync.providers.PCloudProvider
import com.julien.genpwdpro.data.sync.providers.PCloudProvider.PCloudRegion
import com.julien.genpwdpro.data.sync.providers.ProviderConfig
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import org.json.JSONArray
import org.json.JSONException

/**
 * Implémentation de CloudSyncRepository utilisant les CloudProviders
 *
 * Cette implémentation:
 * - Utilise CloudProviderFactory pour obtenir le provider actif
 * - Gère la sélection du provider actif (sauvegardé dans SharedPreferences)
 * - Convertit SyncData → VaultSyncData pour les providers
 * - Délègue toutes les opérations au provider sélectionné
 *
 * Architecture:
 * SyncManager → CloudSyncRepository → CloudProvider (Google Drive, pCloud, etc.)
 */
@Singleton
class CloudProviderSyncRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val providerFactory: CloudProviderFactory,
    private val credentialManager: ProviderCredentialManager
) : CloudSyncRepository {

    companion object {
        private const val TAG = "CloudProviderSyncRepo"
        private const val PREFS_NAME = "cloud_sync_prefs"
        private const val KEY_ACTIVE_PROVIDER = "active_provider_type"
        private const val KEY_SYNC_ERRORS = "sync_errors"
        private const val MAX_SYNC_ERRORS = 10
        private const val CONFIG_KEY_CLIENT_ID = "clientId"
        private const val CONFIG_KEY_CLIENT_SECRET = "clientSecret"
        private const val CONFIG_KEY_APP_KEY = "appKey"
        private const val CONFIG_KEY_APP_SECRET = "appSecret"
        private const val CONFIG_KEY_REGION = "region"
        private const val CONFIG_KEY_SERVER_URL = "serverUrl"
        private const val CONFIG_KEY_USERNAME = "username"
        private const val CONFIG_KEY_PASSWORD = "password"
    }

    private val prefs: SharedPreferences by lazy {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    /**
     * Provider actif actuellement configuré
     */
    private var activeProvider: CloudProvider? = null
    private var activeProviderType: CloudProviderType? = null

    init {
        // Charger le provider actif depuis les préférences
        loadActiveProvider()
    }

    /**
     * Définir le provider cloud actif
     *
     * @param providerType Type de provider à activer
     * @param provider Instance du provider (déjà configuré)
     */
    fun setActiveProvider(
        providerType: CloudProviderType,
        provider: CloudProvider,
        providerConfig: ProviderConfig? = null
    ) {
        SafeLog.d(TAG, "Setting active provider: $providerType")
        activeProviderType = providerType
        activeProvider = provider

        // Sauvegarder dans les préférences
        prefs.edit()
            .putString(KEY_ACTIVE_PROVIDER, providerType.name)
            .apply()

        providerConfig?.let {
            credentialManager.saveProviderConfig(providerType, it)
        }
    }

    /**
     * Obtenir le type de provider actif
     */
    fun getActiveProviderType(): CloudProviderType? = activeProviderType

    /**
     * Charger le provider actif depuis les préférences
     */
    private fun loadActiveProvider() {
        activeProviderType = readStoredProviderType()?.also {
            SafeLog.d(TAG, "Loaded active provider type: $it")
        }
    }

    private fun readStoredProviderType(): CloudProviderType? {
        val savedProviderName = prefs.getString(KEY_ACTIVE_PROVIDER, null) ?: return null
        return try {
            CloudProviderType.valueOf(savedProviderName)
        } catch (e: Exception) {
            SafeLog.w(TAG, "Failed to parse stored provider type: $savedProviderName", e)
            prefs.edit().remove(KEY_ACTIVE_PROVIDER).apply()
            null
        }
    }

    /**
     * Effacer le provider actif
     */
    fun clearActiveProvider() {
        SafeLog.d(TAG, "Clearing active provider")
        activeProvider = null
        activeProviderType?.let { providerType ->
            credentialManager.clearProvider(providerType)
        }
        activeProviderType = null
        prefs.edit().remove(KEY_ACTIVE_PROVIDER).apply()
        clearSyncErrors()
    }

    suspend fun rehydrateActiveProvider(expectedType: CloudProviderType? = null): Boolean {
        expectedType?.let { type ->
            activeProviderType = type
            prefs.edit().putString(KEY_ACTIVE_PROVIDER, type.name).apply()
        }

        return ensureActiveProvider() != null
    }

    private suspend fun ensureActiveProvider(): CloudProvider? {
        activeProvider?.let { return it }

        val providerType = activeProviderType
            ?: readStoredProviderType()?.also { activeProviderType = it }

        if (providerType == null || providerType == CloudProviderType.NONE) {
            SafeLog.w(TAG, "No stored provider available for rehydration")
            return null
        }

        val provider = instantiateProvider(providerType)
        if (provider == null) {
            SafeLog.w(TAG, "Unable to instantiate provider: $providerType")
            return null
        }

        activeProvider = provider
        SafeLog.d(TAG, "Active provider rehydrated: $providerType")
        return provider
    }

    private fun instantiateProvider(type: CloudProviderType): CloudProvider? {
        return when (type) {
            CloudProviderType.GOOGLE_DRIVE -> {
                providerFactory.createProvider(CloudProviderType.GOOGLE_DRIVE)
            }

            CloudProviderType.ONEDRIVE -> {
                val config = credentialManager.getProviderConfig(type, ProviderConfig::class.java)
                val clientId = config?.customSettings?.get(CONFIG_KEY_CLIENT_ID)

                if (clientId.isNullOrBlank()) {
                    SafeLog.w(TAG, "Missing clientId for OneDrive provider rehydration")
                    null
                } else {
                    providerFactory.createOneDriveProvider(clientId)
                }
            }

            CloudProviderType.PROTON_DRIVE -> {
                val config = credentialManager.getProviderConfig(type, ProviderConfig::class.java)
                val clientId = config?.customSettings?.get(CONFIG_KEY_CLIENT_ID)
                val clientSecret = config?.customSettings?.get(CONFIG_KEY_CLIENT_SECRET)

                if (clientId.isNullOrBlank() || clientSecret.isNullOrBlank()) {
                    SafeLog.w(TAG, "Missing Proton Drive credentials for rehydration")
                    null
                } else {
                    providerFactory.createProtonDriveProvider(clientId, clientSecret)
                }
            }

            CloudProviderType.PCLOUD -> {
                val config = credentialManager.getProviderConfig(type, ProviderConfig::class.java)
                val appKey = config?.customSettings?.get(CONFIG_KEY_APP_KEY)
                val appSecret = config?.customSettings?.get(CONFIG_KEY_APP_SECRET)
                val region = config?.customSettings?.get(CONFIG_KEY_REGION)
                    ?.let { runCatching { PCloudRegion.valueOf(it) }.getOrNull() }
                    ?: PCloudRegion.EU

                if (appKey.isNullOrBlank() || appSecret.isNullOrBlank()) {
                    SafeLog.w(TAG, "Missing pCloud credentials for rehydration")
                    null
                } else {
                    providerFactory.createPCloudProvider(appKey, appSecret, region)
                }
            }

            CloudProviderType.WEBDAV -> {
                val config = credentialManager.getProviderConfig(type, ProviderConfig::class.java)
                val serverUrl = config?.serverUrl
                val username = config?.username
                val password = config?.password

                if (serverUrl.isNullOrBlank() || username.isNullOrBlank() || password.isNullOrBlank()) {
                    SafeLog.w(TAG, "Incomplete WebDAV configuration for rehydration")
                    null
                } else {
                    providerFactory.createWebDAVProvider(serverUrl, username, password)
                }
            }

            CloudProviderType.NONE -> null
        }
    }

    private fun recordSyncError(message: String, throwable: Exception? = null) {
        val composedMessage = buildString {
            append(message)
            val throwableMessage = throwable?.message
            if (!throwableMessage.isNullOrBlank()) {
                append(" – ")
                append(throwableMessage)
            }
        }.take(512)

        val errors = readSyncErrors().apply {
            add(0, composedMessage)
            if (size > MAX_SYNC_ERRORS) {
                subList(MAX_SYNC_ERRORS, size).clear()
            }
        }

        persistSyncErrors(errors)
    }

    private fun readSyncErrors(): MutableList<String> {
        val raw = prefs.getString(KEY_SYNC_ERRORS, null) ?: return mutableListOf()

        return try {
            val array = JSONArray(raw)
            MutableList(array.length()) { index -> array.optString(index) }
        } catch (e: JSONException) {
            SafeLog.w(TAG, "Failed to parse stored sync errors", e)
            prefs.edit().remove(KEY_SYNC_ERRORS).apply()
            mutableListOf()
        }
    }

    private fun persistSyncErrors(errors: List<String>) {
        val array = JSONArray()
        errors.forEach { array.put(it) }
        prefs.edit().putString(KEY_SYNC_ERRORS, array.toString()).apply()
    }

    private fun clearSyncErrors() {
        prefs.edit().remove(KEY_SYNC_ERRORS).apply()
    }

    // ========== CloudSyncRepository Implementation ==========

    override suspend fun upload(data: SyncData): SyncResult {
        val provider = ensureActiveProvider()
            ?: run {
                recordSyncError("Upload aborted – no active provider configured")
                return SyncResult.Error("Aucun provider cloud configuré")
            }

        return try {
            SafeLog.d(TAG, "Uploading data: ${SafeLog.redact(data.id)} (${data.dataType})")

            // Convertir EncryptedDataEncoded → ByteArray
            // EncryptedDataEncoded contient les données en Base64, on doit les décoder
            val encryptedBytes = android.util.Base64.decode(
                data.encryptedPayload.ciphertext,
                android.util.Base64.NO_WRAP
            )

            // Convertir SyncData → VaultSyncData
            val vaultSyncData = VaultSyncData(
                vaultId = data.id,
                vaultName = data.dataType.name,
                encryptedData = encryptedBytes,
                timestamp = data.timestamp,
                version = data.version,
                deviceId = data.deviceId,
                checksum = data.checksum
            )

            // Upload via le provider
            val fileId = provider.uploadVault(data.id, vaultSyncData)

            if (fileId != null) {
                SafeLog.d(TAG, "Upload successful: ${SafeLog.redact(fileId)}")
                SyncResult.Success
            } else {
                SafeLog.w(TAG, "Upload failed: provider returned null fileId")
                recordSyncError("Upload failed – provider returned null fileId")
                SyncResult.Error("Échec de l'upload")
            }
        } catch (e: Exception) {
            SafeLog.e(TAG, "Upload error", e)
            recordSyncError("Upload error", e)
            SyncResult.Error(e.message ?: "Erreur inconnue")
        }
    }

    override suspend fun download(dataType: SyncDataType, deviceId: String?): List<SyncData> {
        val provider = ensureActiveProvider()
            ?: run {
                recordSyncError("Download aborted – no active provider configured")
                return emptyList()
            }

        return try {
            SafeLog.d(TAG, "Downloading data for type: $dataType")

            // Lister tous les vaults
            val files = provider.listVaults()

            // Convertir CloudFileMetadata → SyncData
            files.mapNotNull { metadata ->
                try {
                    // Extraire vaultId du nom de fichier (vault_{id}.enc)
                    val vaultId = metadata.fileName
                        .removePrefix("vault_")
                        .removeSuffix(".enc")

                    // Télécharger le vault
                    val vaultData = provider.downloadVault(vaultId)

                    if (vaultData != null) {
                        // Encoder ByteArray → EncryptedDataEncoded
                        val encodedData = android.util.Base64.encodeToString(
                            vaultData.encryptedData,
                            android.util.Base64.NO_WRAP
                        )

                        SyncData(
                            id = vaultData.vaultId,
                            dataType = dataType,
                            deviceId = vaultData.deviceId,
                            timestamp = vaultData.timestamp,
                            version = vaultData.version,
                            encryptedPayload = EncryptedDataEncoded(
                                ciphertext = encodedData,
                                iv = "" // IV non utilisé dans ce contexte
                            ),
                            checksum = vaultData.checksum
                        )
                    } else {
                        null
                    }
                } catch (e: Exception) {
                    SafeLog.e(TAG, "Error downloading file: ${SafeLog.redact(metadata.fileName)}", e)
                    null
                }
            }
        } catch (e: Exception) {
            SafeLog.e(TAG, "Download error", e)
            recordSyncError("Download error", e)
            emptyList()
        }
    }

    override suspend fun downloadById(id: String, dataType: SyncDataType): SyncData? {
        val provider = ensureActiveProvider()
            ?: run {
                recordSyncError("DownloadById aborted – no active provider configured")
                return null
            }

        return try {
            SafeLog.d(TAG, "Downloading vault by ID: ${SafeLog.redact(id)}")

            val vaultData = provider.downloadVault(id)

            if (vaultData != null) {
                // Encoder ByteArray → EncryptedDataEncoded
                val encodedData = android.util.Base64.encodeToString(
                    vaultData.encryptedData,
                    android.util.Base64.NO_WRAP
                )

                SyncData(
                    id = vaultData.vaultId,
                    dataType = dataType,
                    deviceId = vaultData.deviceId,
                    timestamp = vaultData.timestamp,
                    version = vaultData.version,
                    encryptedPayload = EncryptedDataEncoded(
                        ciphertext = encodedData,
                        iv = "" // IV non utilisé dans ce contexte
                    ),
                    checksum = vaultData.checksum
                )
            } else {
                null
            }
        } catch (e: Exception) {
            SafeLog.e(TAG, "Download by ID error", e)
            recordSyncError("Download by ID error", e)
            null
        }
    }

    override suspend fun delete(id: String): SyncResult {
        val provider = ensureActiveProvider()
            ?: run {
                recordSyncError("Delete aborted – no active provider configured")
                return SyncResult.Error("Aucun provider cloud configuré")
            }

        return try {
            SafeLog.d(TAG, "Deleting vault: ${SafeLog.redact(id)}")

            val success = provider.deleteVault(id)

            if (success) {
                SafeLog.d(TAG, "Delete successful")
                SyncResult.Success
            } else {
                SafeLog.w(TAG, "Delete failed")
                recordSyncError("Delete failed for vault ${SafeLog.redact(id)}")
                SyncResult.Error("Échec de la suppression")
            }
        } catch (e: Exception) {
            SafeLog.e(TAG, "Delete error", e)
            recordSyncError("Delete error", e)
            SyncResult.Error(e.message ?: "Erreur inconnue")
        }
    }

    override suspend fun hasNewerData(dataType: SyncDataType, localTimestamp: Long): Boolean {
        val provider = ensureActiveProvider()
            ?: run {
                recordSyncError("hasNewerData aborted – no active provider configured")
                return false
            }

        return try {
            SafeLog.d(TAG, "Checking for newer data (local timestamp: $localTimestamp)")

            val files = provider.listVaults()

            // Vérifier si au moins un fichier est plus récent
            files.any { it.modifiedTime > localTimestamp }
        } catch (e: Exception) {
            SafeLog.e(TAG, "Error checking for newer data", e)
            recordSyncError("Error while checking for newer data", e)
            false
        }
    }

    override fun observeChanges(dataType: SyncDataType): Flow<SyncEvent> {
        // La plupart des providers ne supportent pas le temps réel
        // On retourne un flow vide pour l'instant
        SafeLog.d(TAG, "observeChanges not implemented for cloud providers")
        return flowOf()
    }

    override suspend fun resolveConflict(
        conflict: SyncResult.Conflict,
        strategy: ConflictResolutionStrategy
    ): SyncData {
        SafeLog.d(TAG, "Resolving conflict with strategy: $strategy")

        return when (strategy) {
            ConflictResolutionStrategy.LOCAL_WINS -> conflict.localData
            ConflictResolutionStrategy.REMOTE_WINS -> conflict.remoteData
            ConflictResolutionStrategy.NEWEST_WINS -> {
                if (conflict.localData.timestamp >= conflict.remoteData.timestamp) {
                    conflict.localData
                } else {
                    conflict.remoteData
                }
            }
            ConflictResolutionStrategy.MANUAL,
            ConflictResolutionStrategy.MERGE -> {
                // Par défaut, garder le plus récent
                if (conflict.localData.timestamp >= conflict.remoteData.timestamp) {
                    conflict.localData
                } else {
                    conflict.remoteData
                }
            }
        }
    }

    override suspend fun getMetadata(): LocalSyncMetadata {
        return LocalSyncMetadata(
            lastSyncTimestamp = prefs.getLong("last_sync_timestamp", 0),
            lastSuccessfulSyncTimestamp = prefs.getLong("last_successful_sync_timestamp", 0),
            pendingChanges = prefs.getInt("pending_changes", 0),
            conflictCount = prefs.getInt("conflict_count", 0),
            syncErrors = readSyncErrors()
        )
    }

    override suspend fun testConnection(): Boolean {
        val provider = ensureActiveProvider()
            ?: run {
                recordSyncError("Connection test aborted – no active provider configured")
                return false
            }

        return try {
            SafeLog.d(TAG, "Testing connection to cloud provider")

            // Vérifier l'authentification
            provider.isAuthenticated()
        } catch (e: Exception) {
            SafeLog.e(TAG, "Connection test failed", e)
            recordSyncError("Connection test failed", e)
            false
        }
    }

    override suspend fun cleanup(olderThan: Long) {
        val provider = ensureActiveProvider()
            ?: run {
                recordSyncError("Cleanup aborted – no active provider configured")
                return
            }

        try {
            SafeLog.d(TAG, "Cleaning up data older than: $olderThan")

            // Lister tous les vaults
            val files = provider.listVaults()

            // Supprimer les fichiers trop anciens
            files.filter { it.modifiedTime < olderThan }
                .forEach { metadata ->
                    try {
                        val vaultId = metadata.fileName
                            .removePrefix("vault_")
                            .removeSuffix(".enc")

                        provider.deleteVault(vaultId)
                        SafeLog.d(TAG, "Deleted old vault: ${SafeLog.redact(vaultId)}")
                    } catch (e: Exception) {
                        SafeLog.e(TAG, "Error deleting old file: ${SafeLog.redact(metadata.fileName)}", e)
                        recordSyncError(
                            "Error deleting old file ${SafeLog.redact(metadata.fileName)}",
                            e
                        )
                    }
                }
        } catch (e: Exception) {
            SafeLog.e(TAG, "Cleanup error", e)
            recordSyncError("Cleanup error", e)
        }
    }

    /**
     * Désactiver la synchronisation cloud
     */
    fun disableSync() {
        SafeLog.d(TAG, "Disabling cloud sync")
        clearActiveProvider()
    }
}
