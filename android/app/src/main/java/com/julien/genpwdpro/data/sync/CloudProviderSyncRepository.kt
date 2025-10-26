package com.julien.genpwdpro.data.sync

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.julien.genpwdpro.data.encryption.EncryptedDataEncoded
import com.julien.genpwdpro.data.sync.credentials.ProviderCredentialManager
import com.julien.genpwdpro.data.sync.models.CloudProviderType
import com.julien.genpwdpro.data.sync.models.VaultSyncData
import com.julien.genpwdpro.data.sync.providers.CloudProviderFactory
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import javax.inject.Inject
import javax.inject.Singleton

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
    fun setActiveProvider(providerType: CloudProviderType, provider: CloudProvider) {
        Log.d(TAG, "Setting active provider: $providerType")
        activeProviderType = providerType
        activeProvider = provider

        // Sauvegarder dans les préférences
        prefs.edit()
            .putString(KEY_ACTIVE_PROVIDER, providerType.name)
            .apply()
    }

    /**
     * Obtenir le type de provider actif
     */
    fun getActiveProviderType(): CloudProviderType? = activeProviderType

    /**
     * Charger le provider actif depuis les préférences
     */
    private fun loadActiveProvider() {
        val savedProviderName = prefs.getString(KEY_ACTIVE_PROVIDER, null)
        if (savedProviderName != null) {
            try {
                val providerType = CloudProviderType.valueOf(savedProviderName)
                activeProviderType = providerType
                Log.d(TAG, "Loaded active provider type: $providerType")
                // Le provider sera instancié quand nécessaire
            } catch (e: Exception) {
                Log.w(TAG, "Failed to load active provider: $savedProviderName", e)
            }
        }
    }

    /**
     * Effacer le provider actif
     */
    fun clearActiveProvider() {
        Log.d(TAG, "Clearing active provider")
        activeProvider = null
        activeProviderType = null
        prefs.edit().remove(KEY_ACTIVE_PROVIDER).apply()
    }

    /**
     * Vérifier qu'un provider est actif
     */
    private fun ensureProviderAvailable(): Boolean {
        if (activeProvider == null) {
            Log.w(TAG, "No active provider configured")
            return false
        }
        return true
    }

    // ========== CloudSyncRepository Implementation ==========

    override suspend fun upload(data: SyncData): SyncResult {
        if (!ensureProviderAvailable()) {
            return SyncResult.Error("Aucun provider cloud configuré")
        }

        return try {
            Log.d(TAG, "Uploading data: ${data.id} (${data.dataType})")

            // Convertir EncryptedDataEncoded → ByteArray
            // EncryptedDataEncoded contient les données en Base64, on doit les décoder
            val encryptedBytes = android.util.Base64.decode(
                data.encryptedPayload.data,
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
            val fileId = activeProvider!!.uploadVault(data.id, vaultSyncData)

            if (fileId != null) {
                Log.d(TAG, "Upload successful: $fileId")
                SyncResult.Success
            } else {
                Log.w(TAG, "Upload failed: provider returned null fileId")
                SyncResult.Error("Échec de l'upload")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Upload error", e)
            SyncResult.Error(e.message ?: "Erreur inconnue")
        }
    }

    override suspend fun download(dataType: SyncDataType, deviceId: String?): List<SyncData> {
        if (!ensureProviderAvailable()) {
            return emptyList()
        }

        return try {
            Log.d(TAG, "Downloading data for type: $dataType")

            // Lister tous les vaults
            val files = activeProvider!!.listVaults()

            // Convertir CloudFileMetadata → SyncData
            files.mapNotNull { metadata ->
                try {
                    // Extraire vaultId du nom de fichier (vault_{id}.enc)
                    val vaultId = metadata.fileName
                        .removePrefix("vault_")
                        .removeSuffix(".enc")

                    // Télécharger le vault
                    val vaultData = activeProvider!!.downloadVault(vaultId)

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
                                data = encodedData,
                                iv = "" // IV non utilisé dans ce contexte
                            ),
                            checksum = vaultData.checksum
                        )
                    } else {
                        null
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error downloading file: ${metadata.fileName}", e)
                    null
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Download error", e)
            emptyList()
        }
    }

    override suspend fun downloadById(id: String): SyncData? {
        if (!ensureProviderAvailable()) {
            return null
        }

        return try {
            Log.d(TAG, "Downloading vault by ID: $id")

            val vaultData = activeProvider!!.downloadVault(id)

            if (vaultData != null) {
                // Encoder ByteArray → EncryptedDataEncoded
                val encodedData = android.util.Base64.encodeToString(
                    vaultData.encryptedData,
                    android.util.Base64.NO_WRAP
                )

                SyncData(
                    id = vaultData.vaultId,
                    dataType = SyncDataType.SETTINGS, // Assume SETTINGS for now
                    deviceId = vaultData.deviceId,
                    timestamp = vaultData.timestamp,
                    version = vaultData.version,
                    encryptedPayload = EncryptedDataEncoded(
                        data = encodedData,
                        iv = "" // IV non utilisé dans ce contexte
                    ),
                    checksum = vaultData.checksum
                )
            } else {
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Download by ID error", e)
            null
        }
    }

    override suspend fun delete(id: String): SyncResult {
        if (!ensureProviderAvailable()) {
            return SyncResult.Error("Aucun provider cloud configuré")
        }

        return try {
            Log.d(TAG, "Deleting vault: $id")

            val success = activeProvider!!.deleteVault(id)

            if (success) {
                Log.d(TAG, "Delete successful")
                SyncResult.Success
            } else {
                Log.w(TAG, "Delete failed")
                SyncResult.Error("Échec de la suppression")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Delete error", e)
            SyncResult.Error(e.message ?: "Erreur inconnue")
        }
    }

    override suspend fun hasNewerData(dataType: SyncDataType, localTimestamp: Long): Boolean {
        if (!ensureProviderAvailable()) {
            return false
        }

        return try {
            Log.d(TAG, "Checking for newer data (local timestamp: $localTimestamp)")

            val files = activeProvider!!.listVaults()

            // Vérifier si au moins un fichier est plus récent
            files.any { it.modifiedTime > localTimestamp }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking for newer data", e)
            false
        }
    }

    override fun observeChanges(dataType: SyncDataType): Flow<SyncEvent> {
        // La plupart des providers ne supportent pas le temps réel
        // On retourne un flow vide pour l'instant
        Log.d(TAG, "observeChanges not implemented for cloud providers")
        return flowOf()
    }

    override suspend fun resolveConflict(
        conflict: SyncResult.Conflict,
        strategy: ConflictResolutionStrategy
    ): SyncData {
        Log.d(TAG, "Resolving conflict with strategy: $strategy")

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
            syncErrors = emptyList() // TODO: Load from prefs
        )
    }

    override suspend fun testConnection(): Boolean {
        if (!ensureProviderAvailable()) {
            return false
        }

        return try {
            Log.d(TAG, "Testing connection to cloud provider")

            // Vérifier l'authentification
            activeProvider!!.isAuthenticated()
        } catch (e: Exception) {
            Log.e(TAG, "Connection test failed", e)
            false
        }
    }

    override suspend fun cleanup(olderThan: Long) {
        if (!ensureProviderAvailable()) {
            return
        }

        try {
            Log.d(TAG, "Cleaning up data older than: $olderThan")

            // Lister tous les vaults
            val files = activeProvider!!.listVaults()

            // Supprimer les fichiers trop anciens
            files.filter { it.modifiedTime < olderThan }
                .forEach { metadata ->
                    try {
                        val vaultId = metadata.fileName
                            .removePrefix("vault_")
                            .removeSuffix(".enc")

                        activeProvider!!.deleteVault(vaultId)
                        Log.d(TAG, "Deleted old vault: $vaultId")
                    } catch (e: Exception) {
                        Log.e(TAG, "Error deleting old file: ${metadata.fileName}", e)
                    }
                }
        } catch (e: Exception) {
            Log.e(TAG, "Cleanup error", e)
        }
    }

    /**
     * Désactiver la synchronisation cloud
     */
    fun disableSync() {
        Log.d(TAG, "Disabling cloud sync")
        activeProvider = null
        activeProviderType = null
        prefs.edit().remove(KEY_ACTIVE_PROVIDER).apply()
    }
}
