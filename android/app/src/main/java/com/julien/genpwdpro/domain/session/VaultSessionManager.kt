package com.julien.genpwdpro.domain.session

import android.net.Uri
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.data.db.dao.VaultRegistryDao
import com.julien.genpwdpro.data.db.entity.*
import com.julien.genpwdpro.data.models.vault.StorageStrategy
import com.julien.genpwdpro.data.models.vault.VaultData
import com.julien.genpwdpro.data.models.vault.VaultStatistics
import com.julien.genpwdpro.data.vault.VaultFileManager
import com.julien.genpwdpro.domain.exceptions.VaultException
import com.julien.genpwdpro.data.db.dao.updateById
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import java.io.IOException
import java.util.UUID
import javax.crypto.SecretKey
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Gestionnaire de session pour le système de coffres file-based
 *
 * Responsabilités :
 * - Charger un vault .gpv en mémoire après déverrouillage
 * - Maintenir les données déchiffrées en mémoire (single source of truth)
 * - Fournir des opérations CRUD sur entries/folders/tags/presets
 * - Sauvegarder automatiquement après chaque modification
 * - Gérer l'auto-lock après timeout
 * - Nettoyer la mémoire au verrouillage
 *
 * Architecture :
 * ```
 * UI Layer
 *    ↓
 * FileVaultRepository
 *    ↓
 * VaultSessionManager ← VOUS ÊTES ICI (Single source of truth)
 *    ↓
 * VaultFileManager (Disk I/O)
 *    ↓
 * Encrypted .gpv files
 * ```
 */
@Singleton
class VaultSessionManager @Inject constructor(
    private val vaultFileManager: VaultFileManager,
    private val vaultRegistryDao: VaultRegistryDao,
    private val cryptoManager: com.julien.genpwdpro.data.crypto.VaultCryptoManager
) {
    companion object {
        private const val TAG = "VaultSessionManager"
        private const val DEFAULT_AUTO_LOCK_MINUTES = 5
    }

    /**
     * Session active représentant un vault déverrouillé
     */
    data class VaultSession(
        val vaultId: String,
        val vaultKey: SecretKey,
        val filePath: String,
        val storageStrategy: StorageStrategy,
        val fileUri: Uri?,
        private val _vaultData: MutableStateFlow<VaultData>,
        val unlockTime: Long = System.currentTimeMillis(),
        var autoLockJob: Job? = null
    ) {
        val vaultData: StateFlow<VaultData> = _vaultData.asStateFlow()

        /**
         * Mise à jour des données du vault (interne)
         */
        internal fun updateData(data: VaultData) {
            _vaultData.value = data
        }

        /**
         * Nettoie la session (efface les clés sensibles de la mémoire)
         */
        fun cleanup() {
            autoLockJob?.cancel()
            // Note: SecretKey ne peut pas être effacée directement en Kotlin
            // mais elle sera GC'd quand la session sera déréférencée
        }
    }

    // Session courante (null = aucun vault déverrouillé)
    private var currentSession: VaultSession? = null

    // Flux d'observation de la session active
    private val _activeVaultId = MutableStateFlow<String?>(null)
    val activeVaultId: StateFlow<String?> = _activeVaultId.asStateFlow()

    // Scope pour les coroutines de session
    private val sessionScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    /**
     * Vérifie si un vault est actuellement déverrouillé
     */
    fun isVaultUnlocked(): Boolean {
        return currentSession != null
    }

    /**
     * Récupère l'ID du vault actuellement déverrouillé
     */
    fun getCurrentVaultId(): String? {
        return currentSession?.vaultId
    }

    /**
     * Récupère la session courante (null si aucun vault déverrouillé)
     */
    fun getCurrentSession(): VaultSession? {
        return currentSession
    }

    /**
     * Déverrouille un vault avec le master password
     *
     * @param vaultId ID du vault à déverrouiller
     * @param masterPassword Master password en clair
     * @return Result.success si déverrouillé, Result.failure avec VaultException spécifique
     */
    suspend fun unlockVault(vaultId: String, masterPassword: String): Result<Unit> {
        return withContext(Dispatchers.IO) {
            try {
                SafeLog.d(TAG, "Unlocking vault: $vaultId")

                // Vérifier qu'un vault n'est pas déjà déverrouillé
                currentSession?.let {
                    if (it.vaultId == vaultId) {
                        _activeVaultId.value = vaultId
                        resetAutoLockTimer()
                        SafeLog.w(TAG, "Vault already unlocked: $vaultId")
                        return@withContext Result.success(Unit)
                    } else {
                        // Verrouiller l'ancien vault d'abord
                        SafeLog.d(TAG, "Locking previous vault: ${it.vaultId}")
                        lockVault()
                    }
                }

                // Charger les métadonnées du vault
                val vaultRegistry = vaultRegistryDao.getById(vaultId)
                    ?: return@withContext Result.failure(
                        VaultException.VaultNotFound(vaultId)
                    )

                // Charger le fichier .gpv
                val isSafPath = vaultRegistry.filePath.startsWith("content://")
                val resolvedUri = if (isSafPath) {
                    vaultFileManager.pathToUri(vaultRegistry.filePath)
                        ?: return@withContext Result.failure(
                            VaultException.FileAccessError("Invalid SAF URI: ${vaultRegistry.filePath}")
                        )
                } else {
                    null
                }

                val vaultData = try {
                    if (resolvedUri != null) {
                        vaultFileManager.loadVaultFileFromUri(vaultId, masterPassword, resolvedUri)
                    } else {
                        // File path normal
                        vaultFileManager.loadVaultFile(vaultId, masterPassword, vaultRegistry.filePath)
                    }
                } catch (e: SecurityException) {
                    SafeLog.e(TAG, "Decryption failed for vault: $vaultId", e)
                    return@withContext Result.failure(
                        VaultException.DecryptionFailed(cause = e)
                    )
                } catch (e: IOException) {
                    SafeLog.e(TAG, "File access error for vault: $vaultId", e)
                    return@withContext Result.failure(
                        VaultException.FileAccessError(cause = e)
                    )
                } catch (e: IllegalArgumentException) {
                    SafeLog.e(TAG, "Invalid file format for vault: $vaultId", e)
                    return@withContext Result.failure(
                        VaultException.InvalidFileFormat(cause = e)
                    )
                }

                // Dériver la clé de chiffrement depuis le master password
                val vaultKey = try {
                    val saltBytes = cryptoManager.generateSaltFromString(vaultId)
                    cryptoManager.deriveKey(masterPassword, saltBytes)
                } catch (e: Exception) {
                    SafeLog.e(TAG, "Key derivation failed for vault: $vaultId", e)
                    return@withContext Result.failure(
                        VaultException.EncryptionFailed("Failed to derive encryption key", e)
                    )
                }

                // Créer la session
                val session = VaultSession(
                    vaultId = vaultId,
                    vaultKey = vaultKey,
                    filePath = vaultRegistry.filePath,
                    storageStrategy = vaultRegistry.storageStrategy,
                    fileUri = resolvedUri,
                    _vaultData = MutableStateFlow(vaultData)
                )

                currentSession = session
                _activeVaultId.value = vaultId

                // Mettre à jour les statistiques et métadonnées
                try {
                    val fileSize = resolvedUri?.let { uri ->
                        vaultFileManager.getVaultFileSizeFromUri(uri)
                    } ?: vaultFileManager.getVaultFileSize(vaultRegistry.filePath)

                    val statistics = calculateStatistics(vaultData, fileSize)

                    vaultRegistryDao.updateById(vaultId) { entry ->
                        entry.copy(
                            fileSize = fileSize,
                            lastModified = System.currentTimeMillis(),
                            statistics = statistics
                        )
                    }
                } catch (e: Exception) {
                    SafeLog.e(TAG, "Failed to refresh registry metadata for vault: $vaultId", e)
                }

                // Mettre à jour lastAccessed dans le registry
                try {
                    vaultRegistryDao.updateLastAccessed(vaultId, System.currentTimeMillis())
                    vaultRegistryDao.updateLoadedStatus(vaultId, true)
                } catch (e: Exception) {
                    SafeLog.e(TAG, "Failed to update registry for vault: $vaultId", e)
                    // Non-critical error, don't fail the unlock
                }

                // Démarrer le timer d'auto-lock
                startAutoLockTimer(DEFAULT_AUTO_LOCK_MINUTES)

                SafeLog.i(TAG, "Vault unlocked successfully: $vaultId")
                Result.success(Unit)

            } catch (e: VaultException) {
                SafeLog.e(TAG, "Failed to unlock vault: $vaultId - ${e.message}", e)
                Result.failure(e)
            } catch (e: Exception) {
                SafeLog.e(TAG, "Unexpected error unlocking vault: $vaultId", e)
                Result.failure(VaultException.Unknown(e.message, e))
            }
        }
    }

    /**
     * Déverrouille un vault avec la biométrie
     * (Nécessite BiometricVaultManager - à implémenter dans Phase 2)
     *
     * @param vaultId ID du vault
     * @return Result.success si déverrouillé, Result.failure sinon
     */
    suspend fun unlockVaultWithBiometric(vaultId: String): Result<Unit> {
        return Result.failure(
            UnsupportedOperationException(
                "Use FileVaultRepository.unlockVaultWithBiometric() to trigger biometric auth"
            )
        )
    }

    /**
     * Verrouille le vault actuel
     * - Sauvegarde les modifications en cours
     * - Efface les données sensibles de la mémoire
     * - Annule le timer d'auto-lock
     */
    suspend fun lockVault() {
        withContext(Dispatchers.IO) {
            val session = currentSession ?: return@withContext

            try {
                SafeLog.d(TAG, "Locking vault: ${session.vaultId}")

                // Sauvegarder une dernière fois
                saveCurrentVault().onFailure {
                    SafeLog.e(TAG, "Failed to save vault before locking", it)
                }

                // Mettre à jour le statut dans le registry
                vaultRegistryDao.updateLoadedStatus(session.vaultId, false)

                // Nettoyer la session
                session.cleanup()
                currentSession = null
                _activeVaultId.value = null

                SafeLog.i(TAG, "Vault locked successfully")

            } catch (e: Exception) {
                SafeLog.e(TAG, "Error while locking vault", e)
                // Forcer le nettoyage même en cas d'erreur
                session.cleanup()
                currentSession = null
                _activeVaultId.value = null
            }
        }
    }

    // ========== Entry Operations ==========

    /**
     * Récupère toutes les entries du vault déverrouillé
     */
    fun getEntries(): StateFlow<List<VaultEntryEntity>> {
        val session = currentSession
            ?: return MutableStateFlow<List<VaultEntryEntity>>(emptyList()).asStateFlow()

        return session.vaultData.map { it.entries }.stateIn<List<VaultEntryEntity>>(
            scope = sessionScope,
            started = SharingStarted.WhileSubscribed(),
            initialValue = session.vaultData.value.entries
        )
    }

    /**
     * Récupère une entry par son ID
     */
    suspend fun getEntryById(entryId: String): VaultEntryEntity? {
        val session = currentSession ?: return null
        return session.vaultData.value.entries.find { it.id == entryId }
    }

    /**
     * Ajoute une nouvelle entry au vault
     */
    suspend fun addEntry(entry: VaultEntryEntity): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return try {
            val currentData = session.vaultData.value
            val updatedEntries = currentData.entries + entry

            val updatedData = currentData.copy(entries = updatedEntries)
            session.updateData(updatedData)

            // Auto-save
            saveCurrentVault()

            resetAutoLockTimer()
            SafeLog.d(TAG, "Entry added: ${entry.id}")
            Result.success(Unit)

        } catch (e: Exception) {
            SafeLog.e(TAG, "Failed to add entry", e)
            Result.failure(e)
        }
    }

    /**
     * Met à jour une entry existante
     */
    suspend fun updateEntry(entry: VaultEntryEntity): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return try {
            val currentData = session.vaultData.value
            val updatedEntries = currentData.entries.map {
                if (it.id == entry.id) entry else it
            }

            val updatedData = currentData.copy(entries = updatedEntries)
            session.updateData(updatedData)

            // Auto-save
            saveCurrentVault()

            resetAutoLockTimer()
            SafeLog.d(TAG, "Entry updated: ${entry.id}")
            Result.success(Unit)

        } catch (e: Exception) {
            SafeLog.e(TAG, "Failed to update entry", e)
            Result.failure(e)
        }
    }

    /**
     * Supprime une entry
     */
    suspend fun deleteEntry(entryId: String): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return try {
            val currentData = session.vaultData.value
            val updatedEntries = currentData.entries.filter { it.id != entryId }

            // Supprimer aussi les associations de tags
            val updatedEntryTags = currentData.entryTags.filter { it.entryId != entryId }

            val updatedData = currentData.copy(
                entries = updatedEntries,
                entryTags = updatedEntryTags
            )
            session.updateData(updatedData)

            // Auto-save
            saveCurrentVault()

            resetAutoLockTimer()
            SafeLog.d(TAG, "Entry deleted: $entryId")
            Result.success(Unit)

        } catch (e: Exception) {
            SafeLog.e(TAG, "Failed to delete entry", e)
            Result.failure(e)
        }
    }

    // ========== Folder Operations ==========

    /**
     * Récupère tous les folders
     */
    fun getFolders(): StateFlow<List<FolderEntity>> {
        val session = currentSession
            ?: return MutableStateFlow<List<FolderEntity>>(emptyList()).asStateFlow()

        return session.vaultData.map { it.folders }.stateIn<List<FolderEntity>>(
            scope = sessionScope,
            started = SharingStarted.WhileSubscribed(),
            initialValue = session.vaultData.value.folders
        )
    }

    /**
     * Ajoute un nouveau folder
     */
    suspend fun addFolder(folder: FolderEntity): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return try {
            val currentData = session.vaultData.value
            val updatedFolders = currentData.folders + folder

            val updatedData = currentData.copy(folders = updatedFolders)
            session.updateData(updatedData)

            saveCurrentVault()
            resetAutoLockTimer()
            SafeLog.d(TAG, "Folder added: ${folder.id}")
            Result.success(Unit)

        } catch (e: Exception) {
            SafeLog.e(TAG, "Failed to add folder", e)
            Result.failure(e)
        }
    }

    /**
     * Met à jour un folder existant
     */
    suspend fun updateFolder(folder: FolderEntity): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return try {
            val currentData = session.vaultData.value
            val updatedFolders = currentData.folders.map {
                if (it.id == folder.id) folder else it
            }

            val updatedData = currentData.copy(folders = updatedFolders)
            session.updateData(updatedData)

            saveCurrentVault()
            resetAutoLockTimer()
            SafeLog.d(TAG, "Folder updated: ${folder.id}")
            Result.success(Unit)

        } catch (e: Exception) {
            SafeLog.e(TAG, "Failed to update folder", e)
            Result.failure(e)
        }
    }

    /**
     * Supprime un folder
     */
    suspend fun deleteFolder(folderId: String): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return try {
            val currentData = session.vaultData.value
            val updatedFolders = currentData.folders.filter { it.id != folderId }

            // Retirer le folderId des entries qui l'utilisaient
            val updatedEntries = currentData.entries.map {
                if (it.folderId == folderId) it.copy(folderId = null) else it
            }

            val updatedData = currentData.copy(
                folders = updatedFolders,
                entries = updatedEntries
            )
            session.updateData(updatedData)

            saveCurrentVault()
            resetAutoLockTimer()
            SafeLog.d(TAG, "Folder deleted: $folderId")
            Result.success(Unit)

        } catch (e: Exception) {
            SafeLog.e(TAG, "Failed to delete folder", e)
            Result.failure(e)
        }
    }

    // ========== Tag Operations ==========

    /**
     * Récupère tous les tags
     */
    fun getTags(): StateFlow<List<TagEntity>> {
        val session = currentSession
            ?: return MutableStateFlow<List<TagEntity>>(emptyList()).asStateFlow()

        return session.vaultData.map { it.tags }.stateIn<List<TagEntity>>(
            scope = sessionScope,
            started = SharingStarted.WhileSubscribed(),
            initialValue = session.vaultData.value.tags
        )
    }

    /**
     * Ajoute un nouveau tag
     */
    suspend fun addTag(tag: TagEntity): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return try {
            val currentData = session.vaultData.value
            val updatedTags = currentData.tags + tag

            val updatedData = currentData.copy(tags = updatedTags)
            session.updateData(updatedData)

            saveCurrentVault()
            resetAutoLockTimer()
            SafeLog.d(TAG, "Tag added: ${tag.id}")
            Result.success(Unit)

        } catch (e: Exception) {
            SafeLog.e(TAG, "Failed to add tag", e)
            Result.failure(e)
        }
    }

    /**
     * Met à jour un tag existant
     */
    suspend fun updateTag(tag: TagEntity): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return try {
            val currentData = session.vaultData.value
            val updatedTags = currentData.tags.map {
                if (it.id == tag.id) tag else it
            }

            val updatedData = currentData.copy(tags = updatedTags)
            session.updateData(updatedData)

            saveCurrentVault()
            resetAutoLockTimer()
            SafeLog.d(TAG, "Tag updated: ${tag.id}")
            Result.success(Unit)

        } catch (e: Exception) {
            SafeLog.e(TAG, "Failed to update tag", e)
            Result.failure(e)
        }
    }

    /**
     * Supprime un tag
     */
    suspend fun deleteTag(tagId: String): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return try {
            val currentData = session.vaultData.value
            val updatedTags = currentData.tags.filter { it.id != tagId }

            // Supprimer aussi les associations entry-tag
            val updatedEntryTags = currentData.entryTags.filter { it.tagId != tagId }

            val updatedData = currentData.copy(
                tags = updatedTags,
                entryTags = updatedEntryTags
            )
            session.updateData(updatedData)

            saveCurrentVault()
            resetAutoLockTimer()
            SafeLog.d(TAG, "Tag deleted: $tagId")
            Result.success(Unit)

        } catch (e: Exception) {
            SafeLog.e(TAG, "Failed to delete tag", e)
            Result.failure(e)
        }
    }

    // ========== Preset Operations ==========

    /**
     * Récupère tous les presets
     */
    fun getPresets(): StateFlow<List<PresetEntity>> {
        val session = currentSession
            ?: return MutableStateFlow<List<PresetEntity>>(emptyList()).asStateFlow()

        return session.vaultData.map { it.presets }.stateIn<List<PresetEntity>>(
            scope = sessionScope,
            started = SharingStarted.WhileSubscribed(),
            initialValue = session.vaultData.value.presets
        )
    }

    /**
     * Ajoute un nouveau preset
     */
    suspend fun addPreset(preset: PresetEntity): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return try {
            val currentData = session.vaultData.value
            val updatedPresets = currentData.presets + preset

            val updatedData = currentData.copy(presets = updatedPresets)
            session.updateData(updatedData)

            saveCurrentVault()
            resetAutoLockTimer()
            SafeLog.d(TAG, "Preset added: ${preset.id}")
            Result.success(Unit)

        } catch (e: Exception) {
            SafeLog.e(TAG, "Failed to add preset", e)
            Result.failure(e)
        }
    }

    /**
     * Met à jour un preset existant
     */
    suspend fun updatePreset(preset: PresetEntity): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return try {
            val currentData = session.vaultData.value
            val updatedPresets = currentData.presets.map {
                if (it.id == preset.id) preset else it
            }

            val updatedData = currentData.copy(presets = updatedPresets)
            session.updateData(updatedData)

            saveCurrentVault()
            resetAutoLockTimer()
            SafeLog.d(TAG, "Preset updated: ${preset.id}")
            Result.success(Unit)

        } catch (e: Exception) {
            SafeLog.e(TAG, "Failed to update preset", e)
            Result.failure(e)
        }
    }

    /**
     * Supprime un preset
     */
    suspend fun deletePreset(presetId: String): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return try {
            val currentData = session.vaultData.value
            val updatedPresets = currentData.presets.filter { it.id != presetId }

            val updatedData = currentData.copy(presets = updatedPresets)
            session.updateData(updatedData)

            saveCurrentVault()
            resetAutoLockTimer()
            SafeLog.d(TAG, "Preset deleted: $presetId")
            Result.success(Unit)

        } catch (e: Exception) {
            SafeLog.e(TAG, "Failed to delete preset", e)
            Result.failure(e)
        }
    }

    // ========== Save & Statistics ==========

    /**
     * Sauvegarde le vault actuel sur disque
     * - Chiffre les données avec la clé de session
     * - Écrit le fichier .gpv
     * - Met à jour les statistiques dans vault_registry
     */
    suspend fun saveCurrentVault(): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return withContext(Dispatchers.IO) {
            try {
                SafeLog.d(TAG, "Saving vault: ${session.vaultId}")

                val vaultData = session.vaultData.value

                // Sauvegarder selon le type de path (SAF ou File)
                when {
                    session.fileUri != null -> {
                        vaultFileManager.updateVaultFileAtUri(
                            fileUri = session.fileUri,
                            data = vaultData,
                            vaultKey = session.vaultKey
                        )
                    }

                    else -> {
                        vaultFileManager.saveVaultFile(
                            vaultId = session.vaultId,
                            data = vaultData,
                            vaultKey = session.vaultKey,
                            strategy = session.storageStrategy,
                            customPath = null
                        )
                    }
                }

                val fileSize = session.fileUri?.let { uri ->
                    vaultFileManager.getVaultFileSizeFromUri(uri)
                } ?: vaultFileManager.getVaultFileSize(session.filePath)

                val statistics = calculateStatistics(vaultData, fileSize)

                vaultRegistryDao.updateById(session.vaultId) { entry ->
                    entry.copy(
                        fileSize = fileSize,
                        lastModified = System.currentTimeMillis(),
                        statistics = statistics
                    )
                }

                SafeLog.d(TAG, "Vault saved successfully")
                Result.success(Unit)

            } catch (e: Exception) {
                SafeLog.e(TAG, "Failed to save vault", e)
                Result.failure(e)
            }
        }
    }

    /**
     * Calcule les statistiques d'un vault
     */
    private fun calculateStatistics(vaultData: VaultData, totalSizeBytes: Long): VaultStatistics {
        return VaultStatistics(
            entryCount = vaultData.entries.size,
            folderCount = vaultData.folders.size,
            presetCount = vaultData.presets.size,
            tagCount = vaultData.tags.size,
            totalSize = totalSizeBytes
        )
    }

    // ========== Auto-Lock Timer ==========

    /**
     * Démarre le timer d'auto-lock
     */
    private fun startAutoLockTimer(minutes: Int) {
        val session = currentSession ?: return

        session.autoLockJob?.cancel()
        session.autoLockJob = sessionScope.launch {
            delay(minutes * 60 * 1000L)
            SafeLog.i(TAG, "Auto-lock triggered after $minutes minutes")
            lockVault()
        }
    }

    /**
     * Réinitialise le timer d'auto-lock (appelé à chaque interaction)
     */
    private fun resetAutoLockTimer() {
        currentSession?.let {
            startAutoLockTimer(DEFAULT_AUTO_LOCK_MINUTES)
        }
    }

    /**
     * Nettoie les ressources du SessionManager
     */
    fun cleanup() {
        sessionScope.cancel()
        currentSession?.cleanup()
        currentSession = null
    }
}
