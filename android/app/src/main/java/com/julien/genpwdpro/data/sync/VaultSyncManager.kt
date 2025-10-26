package com.julien.genpwdpro.data.sync

import android.app.Activity
import android.content.Context
import android.util.Log
import com.julien.genpwdpro.data.repository.VaultRepository
import com.julien.genpwdpro.data.sync.models.*
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.security.MessageDigest
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Gestionnaire de synchronisation des vaults avec le cloud
 *
 * Fonctionnalités:
 * - Synchronisation bidirectionnelle des vaults
 * - Gestion multi-providers (Google Drive, OneDrive, etc.)
 * - Détection et résolution de conflits
 * - Chiffrement end-to-end
 *
 * Workflow:
 * 1. Exporter vault → Données chiffrées (VaultRepository)
 * 2. Upload vers cloud (CloudProvider)
 * 3. Download depuis cloud (CloudProvider)
 * 4. Importer vault → Déchiffrement (VaultRepository)
 */
@Singleton
class VaultSyncManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val vaultRepository: VaultRepository,
    private val conflictResolver: ConflictResolver
) {

    companion object {
        private const val TAG = "VaultSyncManager"
        private const val PREFS_NAME = "vault_sync_prefs"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_DEVICE_NAME = "device_name"
        private const val KEY_PROVIDER_TYPE = "provider_type"
    }

    private val _syncStatus = MutableStateFlow(SyncStatus.NEVER_SYNCED)
    val syncStatus: Flow<SyncStatus> = _syncStatus.asStateFlow()

    private val _config = MutableStateFlow(SyncConfig())
    val config: Flow<SyncConfig> = _config.asStateFlow()

    private var currentProvider: CloudProvider? = null
    private var currentProviderType: CloudProviderType = CloudProviderType.NONE

    /**
     * ID de cet appareil (unique)
     */
    private val deviceId: String by lazy {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.getString(KEY_DEVICE_ID, null) ?: run {
            val newId = UUID.randomUUID().toString()
            prefs.edit().putString(KEY_DEVICE_ID, newId).apply()
            newId
        }
    }

    /**
     * Nom de cet appareil
     */
    private val deviceName: String by lazy {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.getString(KEY_DEVICE_NAME, null) ?: run {
            val name = android.os.Build.MODEL
            prefs.edit().putString(KEY_DEVICE_NAME, name).apply()
            name
        }
    }

    /**
     * Configure le provider cloud
     *
     * @param provider Instance du provider (GoogleDriveProvider, etc.)
     * @param type Type du provider
     */
    fun setProvider(provider: CloudProvider, type: CloudProviderType) {
        currentProvider = provider
        currentProviderType = type

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_PROVIDER_TYPE, type.name).apply()

        _config.value = _config.value.copy(
            enabled = true,
            providerType = type,
            deviceId = deviceId,
            deviceName = deviceName
        )
    }

    /**
     * Vérifie si le provider est authentifié
     */
    suspend fun isAuthenticated(): Boolean {
        return currentProvider?.isAuthenticated() ?: false
    }

    /**
     * Authentifie auprès du provider
     */
    suspend fun authenticate(activity: Activity): Boolean {
        val provider = currentProvider ?: return false
        val success = provider.authenticate(activity)

        if (success) {
            _config.value = _config.value.copy(enabled = true)
        }

        return success
    }

    /**
     * Déconnecte du provider
     */
    suspend fun disconnect() {
        currentProvider?.disconnect()
        _config.value = _config.value.copy(
            enabled = false,
            providerType = CloudProviderType.NONE
        )
    }

    /**
     * Synchronise un vault vers le cloud
     *
     * @param vaultId ID du vault
     * @param masterPassword Mot de passe maître pour chiffrement
     * @return Résultat de la synchronisation
     */
    suspend fun syncVault(vaultId: String, masterPassword: String): SyncResult {
        val provider = currentProvider ?: return SyncResult.Error("Aucun provider configuré")

        _syncStatus.value = SyncStatus.SYNCING

        return try {
            // 1. Exporter le vault (chiffré)
            val encryptedData = vaultRepository.exportVault(vaultId, masterPassword)
                ?: return SyncResult.Error("Impossible d'exporter le vault")

            // 2. Obtenir les métadonnées du vault
            val vault = vaultRepository.getVaultById(vaultId)
                ?: return SyncResult.Error("Vault non trouvé")

            // 3. Calculer le checksum
            val checksum = calculateChecksum(encryptedData)

            // 4. Créer VaultSyncData
            val syncData = VaultSyncData(
                vaultId = vaultId,
                vaultName = vault.name,
                encryptedData = encryptedData,
                timestamp = System.currentTimeMillis(),
                version = 1,
                deviceId = deviceId,
                checksum = checksum
            )

            // 5. Vérifier s'il y a une version plus récente sur le cloud
            if (provider.hasNewerVersion(vaultId, syncData.timestamp)) {
                // Télécharger et comparer
                val remoteData = provider.downloadVault(vaultId)
                if (remoteData != null && conflictResolver.hasConflict(syncData, remoteData)) {
                    _syncStatus.value = SyncStatus.CONFLICT
                    return SyncResult.Conflict(remoteData, syncData)
                }
            }

            // 6. Upload vers le cloud
            val fileId = provider.uploadVault(vaultId, syncData)

            if (fileId != null) {
                _syncStatus.value = SyncStatus.SYNCED
                SyncResult.Success
            } else {
                _syncStatus.value = SyncStatus.ERROR
                SyncResult.Error("Échec de l'upload")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error syncing vault", e)
            _syncStatus.value = SyncStatus.ERROR
            SyncResult.Error(e.message ?: "Erreur inconnue", e)
        }
    }

    /**
     * Télécharge un vault depuis le cloud
     *
     * @param vaultId ID du vault
     * @param masterPassword Mot de passe maître pour déchiffrement
     * @return true si le téléchargement a réussi
     */
    suspend fun downloadVault(vaultId: String, masterPassword: String): Boolean {
        val provider = currentProvider ?: return false

        _syncStatus.value = SyncStatus.SYNCING

        return try {
            // 1. Télécharger depuis le cloud
            val syncData = provider.downloadVault(vaultId)
                ?: return false.also {
                    _syncStatus.value = SyncStatus.ERROR
                }

            // 2. Importer le vault (déchiffré)
            val success = vaultRepository.importVault(syncData.encryptedData, masterPassword)

            _syncStatus.value = if (success) {
                SyncStatus.SYNCED
            } else {
                SyncStatus.ERROR
            }

            success
        } catch (e: Exception) {
            Log.e(TAG, "Error downloading vault", e)
            _syncStatus.value = SyncStatus.ERROR
            false
        }
    }

    /**
     * Résout un conflit de synchronisation
     *
     * @param local Version locale
     * @param remote Version distante
     * @param strategy Stratégie de résolution
     * @param masterPassword Mot de passe maître
     * @return true si la résolution a réussi
     */
    suspend fun resolveConflict(
        local: VaultSyncData,
        remote: VaultSyncData,
        strategy: ConflictResolutionStrategy,
        masterPassword: String
    ): Boolean {
        val provider = currentProvider ?: return false

        return try {
            val resolvedData = conflictResolver.resolve(local, remote, strategy)

            // Upload de la version résolue
            val fileId = provider.uploadVault(resolvedData.vaultId, resolvedData)

            if (fileId != null) {
                // Importer localement si nécessaire
                if (resolvedData != local) {
                    vaultRepository.importVault(resolvedData.encryptedData, masterPassword)
                }

                _syncStatus.value = SyncStatus.SYNCED
                true
            } else {
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error resolving conflict", e)
            false
        }
    }

    /**
     * Liste tous les vaults synchronisés sur le cloud
     */
    suspend fun listCloudVaults(): List<String> {
        return currentProvider?.listVaults() ?: emptyList()
    }

    /**
     * Récupère le quota de stockage
     */
    suspend fun getStorageQuota(): StorageQuota? {
        return currentProvider?.getStorageQuota()
    }

    /**
     * Calcule le checksum SHA-256
     */
    private fun calculateChecksum(data: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(data)
        return hash.joinToString("") { "%02x".format(it) }
    }

    /**
     * Configure la synchronisation automatique
     */
    fun setAutoSync(enabled: Boolean, interval: SyncInterval = SyncInterval.HOURLY) {
        _config.value = _config.value.copy(
            autoSync = enabled,
            syncInterval = interval
        )
    }

    /**
     * Configure la sync uniquement en WiFi
     */
    fun setSyncOnWifiOnly(enabled: Boolean) {
        _config.value = _config.value.copy(
            syncOnWifiOnly = enabled
        )
    }
}
