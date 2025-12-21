package com.julien.genpwdpro.data.sync

import android.app.Activity
import android.content.Context
import android.net.Uri
import com.genpwd.providers.api.CloudResult
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.data.db.dao.VaultRegistryDao
import com.julien.genpwdpro.data.db.entity.VaultRegistryEntry
import com.julien.genpwdpro.data.sync.CloudProviderSyncRepository
import com.julien.genpwdpro.data.sync.providers.ProviderConfig
import com.julien.genpwdpro.data.sync.credentials.ProviderCredentialManager
import com.julien.genpwdpro.data.sync.models.*
import com.julien.genpwdpro.data.vault.VaultFileManager
import com.julien.genpwdpro.data.sync.models.ConflictResolutionStrategy as VaultConflictResolutionStrategy
import com.julien.genpwdpro.data.sync.models.SyncResult as VaultSyncResult
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.io.IOException
import java.security.MessageDigest
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Cloud sync manager for vaults (file-based system)
 *
 * Features:
 * - Bidirectional vault synchronization
 * - Multi-provider support (Google Drive, OneDrive, etc.)
 * - Conflict detection and resolution
 * - End-to-end encryption
 *
 * Workflow:
 * 1. Export vault → Encrypted data (.gpv file)
 * 2. Upload to cloud (CloudProvider)
 * 3. Download from cloud (CloudProvider)
 * 4. Import vault → Decryption (.gpv file)
 *
 * TODO: This class needs redesign for .gpv file-based sync.
 * Currently uses stub implementations for compilation.
 */
@Singleton
class VaultSyncManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val vaultRegistryDao: VaultRegistryDao,
    private val vaultFileManager: VaultFileManager,
    private val conflictResolver: ConflictResolver,
    private val credentialManager: ProviderCredentialManager,
    private val syncPreferencesManager: SyncPreferencesManager,
    private val autoSyncScheduler: AutoSyncScheduler,
    private val cloudRepository: CloudProviderSyncRepository
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
    private val providerMutex = Mutex()

    private suspend fun getVaultRegistryEntry(vaultId: String): VaultRegistryEntry? {
        return vaultRegistryDao.getById(vaultId)
    }

    private fun VaultRegistryEntry.asUri(): Uri? {
        return vaultFileManager.pathToUri(filePath)
    }

    private fun readEncryptedVault(entry: VaultRegistryEntry): ByteArray {
        val uri = entry.asUri()
        return if (uri != null) {
            context.contentResolver.openInputStream(uri)?.use { inputStream ->
                inputStream.readBytes()
            } ?: throw IOException("Cannot open vault file URI: ${entry.filePath}")
        } else {
            val file = File(entry.filePath)
            if (!file.exists()) {
                throw IOException("Vault file not found: ${entry.filePath}")
            }
            file.readBytes()
        }
    }

    private suspend fun writeEncryptedVault(
        entry: VaultRegistryEntry,
        encryptedData: ByteArray,
        timestamp: Long
    ) {
        val resolvedTimestamp = if (timestamp > 0) timestamp else System.currentTimeMillis()
        val uri = entry.asUri()
        if (uri != null) {
            context.contentResolver.openOutputStream(uri, "wt")?.use { outputStream ->
                outputStream.write(encryptedData)
            } ?: throw IOException("Cannot open vault URI for writing: ${entry.filePath}")
        } else {
            val file = File(entry.filePath)
            file.parentFile?.let { parent ->
                if (!parent.exists() && !parent.mkdirs()) {
                    throw IOException("Unable to create directory for vault file: ${parent.absolutePath}")
                }
            }
            file.outputStream().use { outputStream ->
                outputStream.write(encryptedData)
            }
        }

        val size = if (uri != null) {
            vaultFileManager.getVaultFileSizeFromUri(uri)
        } else {
            File(entry.filePath).length()
        }

        vaultRegistryDao.updateFileInfo(entry.id, size, resolvedTimestamp)
    }

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
    fun setProvider(
        provider: CloudProvider,
        type: CloudProviderType,
        providerConfig: ProviderConfig? = null
    ) {
        currentProvider = provider
        currentProviderType = type

        cloudRepository.setActiveProvider(type, provider, providerConfig)

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_PROVIDER_TYPE, type.name).apply()
        syncPreferencesManager.setCurrentProvider(type)

        _config.value = _config.value.copy(
            enabled = true,
            providerType = type,
            deviceId = deviceId,
            deviceName = deviceName
        )
    }

    suspend fun rehydrateActiveProvider(): Boolean {
        return ensureProvider() != null
    }

    private fun readStoredProviderType(): CloudProviderType? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val stored = prefs.getString(KEY_PROVIDER_TYPE, null) ?: return null
        return runCatching { CloudProviderType.valueOf(stored) }
            .onFailure { prefs.edit().remove(KEY_PROVIDER_TYPE).apply() }
            .getOrNull()
    }

    private suspend fun ensureProvider(): CloudProvider? {
        return providerMutex.withLock {
            currentProvider?.let { return it }

            val persistedType = currentProviderType.takeIf { it != CloudProviderType.NONE }
                ?: cloudRepository.getActiveProviderType()?.takeIf { it != CloudProviderType.NONE }
                ?: cloudRepository.getStoredProviderType()
                ?: readStoredProviderType()

            val providerType = persistedType ?: CloudProviderType.NONE
            if (providerType == CloudProviderType.NONE) {
                SafeLog.w(TAG, "No active cloud provider configured")
                return null
            }

            val restored = cloudRepository.rehydrateActiveProvider(providerType)
            if (!restored) {
                SafeLog.w(TAG, "Failed to rehydrate cloud provider: $providerType")
                return null
            }

            val provider = cloudRepository.getOrCreateActiveProvider()
            if (provider == null) {
                SafeLog.w(TAG, "Cloud provider instance unavailable after rehydration: $providerType")
                return null
            }

            currentProvider = provider
            currentProviderType = providerType

            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_PROVIDER_TYPE, providerType.name).apply()
            syncPreferencesManager.setCurrentProvider(providerType)

            _config.value = _config.value.copy(
                enabled = true,
                providerType = providerType,
                deviceId = deviceId,
                deviceName = deviceName
            )

            provider
        }
    }

    /**
     * Vérifie si le provider est authentifié
     */
    suspend fun isAuthenticated(): Boolean {
        val provider = ensureProvider() ?: return false
        return provider.isAuthenticated()
    }

    /**
     * Authentifie auprès du provider
     */
    suspend fun authenticate(activity: Activity): Boolean {
        val provider = ensureProvider() ?: return false
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
        SafeLog.i(TAG, "Disconnecting cloud provider and clearing credentials")

        val providerType = currentProviderType.takeIf { it != CloudProviderType.NONE }
            ?: cloudRepository.getActiveProviderType()?.takeIf { it != CloudProviderType.NONE }
            ?: readStoredProviderType()
            ?: CloudProviderType.NONE

        val provider = currentProvider ?: ensureProvider()

        try {
            provider?.disconnect()
        } catch (e: Exception) {
            SafeLog.w(TAG, "Error while disconnecting provider", e)
        }

        runCatching { autoSyncScheduler.cancelAllSync() }
            .onFailure { SafeLog.w(TAG, "Failed to cancel scheduled sync work", it) }

        if (providerType != CloudProviderType.NONE) {
            credentialManager.clearProvider(providerType)
        }

        try {
            syncPreferencesManager.clearAllCredentials()
        } catch (e: Exception) {
            SafeLog.w(TAG, "Failed to clear sync preferences credentials", e)
        }

        cloudRepository.clearActiveProvider()
        syncPreferencesManager.setCurrentProvider(CloudProviderType.NONE)

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .remove(KEY_PROVIDER_TYPE)
            .apply()

        currentProvider = null
        currentProviderType = CloudProviderType.NONE

        _config.value = _config.value.copy(
            enabled = false,
            providerType = CloudProviderType.NONE
        )
        _syncStatus.value = SyncStatus.NEVER_SYNCED
    }

    /**
     * Synchronise un vault vers le cloud
     *
     * @param vaultId ID du vault
     * @param masterPassword Mot de passe maître pour chiffrement
     * @return Résultat de la synchronisation
     */
    suspend fun syncVault(vaultId: String, masterPassword: String): VaultSyncResult {
        val provider = ensureProvider() ?: return VaultSyncResult.Error("Aucun provider configuré")

        _syncStatus.value = SyncStatus.SYNCING

        return try {
            val entry = getVaultRegistryEntry(vaultId)
                ?: return VaultSyncResult.Error("Vault introuvable")

            val encryptedData = readEncryptedVault(entry)
            val timestamp = entry.lastModified.takeIf { it > 0 } ?: System.currentTimeMillis()
            val checksum = calculateChecksum(encryptedData)

            val syncData = VaultSyncData(
                vaultId = vaultId,
                vaultName = entry.name,
                encryptedData = encryptedData,
                timestamp = timestamp,
                version = 1,
                deviceId = deviceId,
                checksum = checksum
            )

            // Vérifier s'il y a une version plus récente sur le cloud
            if (provider.hasNewerVersion(vaultId, syncData.timestamp)) {
                // Télécharger et comparer
                when (val downloadResult = provider.downloadVault(vaultId)) {
                    is CloudResult.Success -> {
                        val remoteData = downloadResult.data
                        if (conflictResolver.hasConflict(syncData, remoteData)) {
                            _syncStatus.value = SyncStatus.CONFLICT
                            return VaultSyncResult.Conflict(remoteData, syncData)
                        }
                    }
                    is CloudResult.Error -> {
                        // Ignore download error during conflict check, proceed with upload
                        SafeLog.w(TAG, "Failed to check remote version: ${downloadResult.message}")
                    }
                }
            }

            // Upload vers le cloud
            when (val uploadResult = provider.uploadVault(vaultId, syncData)) {
                is CloudResult.Success -> {
                    _syncStatus.value = SyncStatus.SYNCED
                    VaultSyncResult.Success
                }
                is CloudResult.Error -> {
                    _syncStatus.value = SyncStatus.ERROR
                    VaultSyncResult.Error(
                        message = uploadResult.message ?: "Échec de l'upload",
                        errorType = uploadResult.type
                    )
                }
            }
        } catch (e: Exception) {
            SafeLog.e(TAG, "Error syncing vault", e)
            _syncStatus.value = SyncStatus.ERROR
            VaultSyncResult.Error(e.message ?: "Erreur inconnue")
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
        val provider = ensureProvider() ?: return false

        _syncStatus.value = SyncStatus.SYNCING

        return try {
            when (val downloadResult = provider.downloadVault(vaultId)) {
                is CloudResult.Success -> {
                    val syncData = downloadResult.data

                    if (syncData.vaultId != vaultId) {
                        SafeLog.w(TAG, "Downloaded vaultId mismatch: expected=$vaultId, received=${syncData.vaultId}")
                        _syncStatus.value = SyncStatus.ERROR
                        return false
                    }

                    val entry = getVaultRegistryEntry(vaultId)
                        ?: return false.also {
                            SafeLog.w(TAG, "Vault registry entry not found for $vaultId")
                            _syncStatus.value = SyncStatus.ERROR
                        }

                    val tempFile = File(context.cacheDir, "sync_download_${vaultId}_${System.currentTimeMillis()}.gpv")
                    try {
                        tempFile.outputStream().use { outputStream ->
                            outputStream.write(syncData.encryptedData)
                        }

                        // Validate decryption with provided master password
                        vaultFileManager.loadVaultFile(
                            vaultId = vaultId,
                            masterPassword = masterPassword,
                            filePath = tempFile.absolutePath
                        )

                        writeEncryptedVault(entry, syncData.encryptedData, syncData.timestamp)
                        _syncStatus.value = SyncStatus.SYNCED
                        true
                    } finally {
                        tempFile.delete()
                    }
                }
                is CloudResult.Error -> {
                    SafeLog.w(TAG, "Download failed: ${downloadResult.message}")
                    _syncStatus.value = SyncStatus.ERROR
                    false
                }
            }
        } catch (e: Exception) {
            SafeLog.e(TAG, "Error downloading vault", e)
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
        strategy: VaultConflictResolutionStrategy,
        masterPassword: String
    ): Boolean {
        val provider = ensureProvider() ?: return false

        return try {
            val resolvedData = conflictResolver.resolve(local, remote, strategy)

            // Upload resolved version
            val fileId = provider.uploadVault(resolvedData.vaultId, resolvedData)

            if (fileId != null) {
                if (resolvedData != local) {
                    val entry = getVaultRegistryEntry(resolvedData.vaultId)
                        ?: return false.also {
                            SafeLog.w(TAG, "Registry entry missing for resolved vault ${resolvedData.vaultId}")
                            _syncStatus.value = SyncStatus.ERROR
                        }

                    writeEncryptedVault(entry, resolvedData.encryptedData, resolvedData.timestamp)
                }

                _syncStatus.value = SyncStatus.SYNCED
                true
            } else {
                _syncStatus.value = SyncStatus.ERROR
                false
            }
        } catch (e: Exception) {
            SafeLog.e(TAG, "Error resolving conflict", e)
            _syncStatus.value = SyncStatus.ERROR
            false
        }
    }

    /**
     * Liste tous les vaults synchronisés sur le cloud
     */
    suspend fun listCloudVaults(): List<String> {
        val provider = ensureProvider() ?: return emptyList()
        return provider.listVaults().map { it.fileId }
    }

    /**
     * Récupère le quota de stockage
     */
    suspend fun getStorageQuota(): StorageQuota? {
        val provider = ensureProvider() ?: return null
        return provider.getStorageQuota()
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
