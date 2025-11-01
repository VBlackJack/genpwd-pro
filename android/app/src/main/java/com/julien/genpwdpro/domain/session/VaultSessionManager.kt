package com.julien.genpwdpro.domain.session

import android.net.Uri
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.data.db.dao.VaultRegistryDao
import com.julien.genpwdpro.data.db.dao.updateById
import com.julien.genpwdpro.data.db.entity.*
import com.julien.genpwdpro.data.models.vault.StorageStrategy
import com.julien.genpwdpro.data.models.vault.VaultData
import com.julien.genpwdpro.data.models.vault.VaultStatistics
import com.julien.genpwdpro.data.vault.VaultFileManager
import com.julien.genpwdpro.domain.exceptions.VaultException
import com.julien.genpwdpro.security.KeystoreManager
import java.io.IOException
import java.util.concurrent.TimeUnit
import javax.crypto.SecretKey
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

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
    private val cryptoManager: com.julien.genpwdpro.data.crypto.VaultCryptoManager,
    private val keystoreManager: KeystoreManager
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
        var autoLockJob: Job? = null,
        var lastInteractionTimestamp: Long = unlockTime
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
    private var sessionScope = newSessionScope()

    private fun newSessionScope(): CoroutineScope {
        return CoroutineScope(SupervisorJob() + Dispatchers.Default)
    }

    private suspend fun persistSessionMutation(
        session: VaultSession,
        operationName: String,
        mutate: (VaultData) -> VaultData,
        successLog: () -> Unit = {}
    ): Result<Unit> {
        val previousData = session.vaultData.value
        return try {
            val updatedData = mutate(previousData)

            if (updatedData == previousData) {
                SafeLog.d(
                    TAG,
                    "No changes detected after $operationName – skipping persistence"
                )
                resetAutoLockTimer()
                return Result.success(Unit)
            }

            session.updateData(updatedData)

            val saveResult = saveCurrentVault()
            if (saveResult.isFailure) {
                session.updateData(previousData)
                val cause = saveResult.exceptionOrNull()
                SafeLog.e(
                    TAG,
                    "Failed to save vault after $operationName: vaultId=${SafeLog.redact(session.vaultId)}",
                    cause
                )
                Result.failure(
                    VaultException.SaveFailed(
                        message = "Failed to save vault after $operationName.",
                        cause = cause
                    )
                )
            } else {
                resetAutoLockTimer()
                successLog()
                Result.success(Unit)
            }
        } catch (e: CancellationException) {
            session.updateData(previousData)
            throw e
        } catch (e: VaultException) {
            session.updateData(previousData)
            SafeLog.w(
                TAG,
                "Business rule failed during $operationName: ${e.message}"
            )
            Result.failure(e)
        } catch (e: Exception) {
            session.updateData(previousData)
            SafeLog.e(TAG, "Failed to $operationName", e)
            Result.failure(e)
        }
    }

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
                SafeLog.d(TAG, "Unlocking vault: vaultId=${SafeLog.redact(vaultId)}")

                // Vérifier qu'un vault n'est pas déjà déverrouillé
                currentSession?.let {
                    if (it.vaultId == vaultId) {
                        _activeVaultId.value = vaultId
                        resetAutoLockTimer()
                        SafeLog.w(
                            TAG,
                            "Vault already unlocked: vaultId=${SafeLog.redact(vaultId)}"
                        )
                        return@withContext Result.success(Unit)
                    } else {
                        // Verrouiller l'ancien vault d'abord
                        SafeLog.d(
                            TAG,
                            "Locking previous vault: vaultId=${SafeLog.redact(it.vaultId)}"
                        )
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
                            VaultException.FileAccessError(
                                "Invalid SAF URI: ${vaultRegistry.filePath}"
                            )
                        )
                } else {
                    null
                }

                val vaultData = try {
                    if (resolvedUri != null) {
                        vaultFileManager.loadVaultFileFromUri(vaultId, masterPassword, resolvedUri)
                    } else {
                        // File path normal
                        vaultFileManager.loadVaultFile(
                            vaultId,
                            masterPassword,
                            vaultRegistry.filePath
                        )
                    }
                } catch (e: SecurityException) {
                    SafeLog.e(
                        TAG,
                        "Decryption failed for vault: vaultId=${SafeLog.redact(vaultId)}",
                        e
                    )
                    return@withContext Result.failure(
                        VaultException.DecryptionFailed(cause = e)
                    )
                } catch (e: IOException) {
                    SafeLog.e(
                        TAG,
                        "File access error for vault: vaultId=${SafeLog.redact(vaultId)}",
                        e
                    )
                    return@withContext Result.failure(
                        VaultException.FileAccessError(cause = e)
                    )
                } catch (e: IllegalArgumentException) {
                    SafeLog.e(
                        TAG,
                        "Invalid file format for vault: vaultId=${SafeLog.redact(vaultId)}",
                        e
                    )
                    return@withContext Result.failure(
                        VaultException.InvalidFileFormat(cause = e)
                    )
                }

                // Dériver la clé de chiffrement depuis le master password
                val vaultKey = try {
                    val saltBytes = cryptoManager.generateSaltFromString(vaultId)
                    cryptoManager.deriveKey(masterPassword, saltBytes)
                } catch (e: Exception) {
                    SafeLog.e(
                        TAG,
                        "Key derivation failed for vault: vaultId=${SafeLog.redact(vaultId)}",
                        e
                    )
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
                    SafeLog.e(
                        TAG,
                        "Failed to refresh registry metadata for vault: ${SafeLog.redact(vaultId)}",
                        e
                    )
                }

                // Mettre à jour lastAccessed dans le registry
                try {
                    vaultRegistryDao.updateLastAccessed(vaultId, System.currentTimeMillis())
                    vaultRegistryDao.updateLoadedStatus(vaultId, true)
                } catch (e: Exception) {
                    SafeLog.e(
                        TAG,
                        "Failed to update registry for vault: ${SafeLog.redact(vaultId)}",
                        e
                    )
                    // Non-critical error, don't fail the unlock
                }

                // Démarrer le timer d'auto-lock
                startAutoLockTimer(DEFAULT_AUTO_LOCK_MINUTES)

                SafeLog.i(
                    TAG,
                    "Vault unlocked successfully: vaultId=${SafeLog.redact(vaultId)}"
                )
            Result.success(Unit)
        } catch (e: VaultException) {
                SafeLog.e(
                    TAG,
                    "Failed to unlock vault: vaultId=${SafeLog.redact(vaultId)} - ${e.message}",
                    e
                )
            Result.failure(e)
        } catch (e: Exception) {
                SafeLog.e(
                    TAG,
                    "Unexpected error unlocking vault: vaultId=${SafeLog.redact(vaultId)}",
                    e
                )
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
                SafeLog.d(
                    TAG,
                    "Locking vault: vaultId=${SafeLog.redact(session.vaultId)}"
                )

                // Sauvegarder une dernière fois
                saveCurrentVault().onFailure {
                    SafeLog.e(
                        TAG,
                        "Failed to save vault before locking: vaultId=${SafeLog.redact(session.vaultId)}",
                        it
                    )
                }

                // Mettre à jour le statut dans le registry
                vaultRegistryDao.updateLoadedStatus(session.vaultId, false)

                // Nettoyer la session
                session.cleanup()
                currentSession = null
                _activeVaultId.value = null

                SafeLog.i(TAG, "Vault locked successfully")
            } catch (e: Exception) {
                SafeLog.e(
                    TAG,
                    "Error while locking vault: vaultId=${SafeLog.redact(session.vaultId)}",
                    e
                )
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

        return persistSessionMutation(
            session = session,
            operationName = "add entry ${SafeLog.redact(entry.id)}",
            mutate = { currentData ->
                if (currentData.entries.any { it.id == entry.id }) {
                    throw VaultException.EntryAlreadyExists(entry.id)
                }
                currentData.copy(entries = currentData.entries + entry)
            },
            successLog = {
                SafeLog.d(
                    TAG,
                    "Entry added: entryId=${SafeLog.redact(entry.id)}"
                )
            }
        )
    }

    /**
     * Met à jour une entry existante
     */
    suspend fun updateEntry(entry: VaultEntryEntity): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return persistSessionMutation(
            session = session,
            operationName = "update entry ${SafeLog.redact(entry.id)}",
            mutate = { currentData ->
                if (currentData.entries.none { it.id == entry.id }) {
                    throw VaultException.EntryNotFound(entry.id)
                }
                currentData.copy(
                    entries = currentData.entries.map { existing ->
                        if (existing.id == entry.id) entry else existing
                    }
                )
            },
            successLog = {
                SafeLog.d(
                    TAG,
                    "Entry updated: entryId=${SafeLog.redact(entry.id)}"
                )
            }
        )
    }

    /**
     * Supprime une entry
     */
    suspend fun deleteEntry(entryId: String): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return persistSessionMutation(
            session = session,
            operationName = "delete entry ${SafeLog.redact(entryId)}",
            mutate = { currentData ->
                if (currentData.entries.none { it.id == entryId }) {
                    throw VaultException.EntryNotFound(entryId)
                }
                val updatedEntries = currentData.entries.filter { it.id != entryId }
                val updatedEntryTags = currentData.entryTags.filter { it.entryId != entryId }

                currentData.copy(
                    entries = updatedEntries,
                    entryTags = updatedEntryTags
                )
            },
            successLog = {
                SafeLog.d(
                    TAG,
                    "Entry deleted: entryId=${SafeLog.redact(entryId)}"
                )
            }
        )
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

        return persistSessionMutation(
            session = session,
            operationName = "add folder ${SafeLog.redact(folder.id)}",
            mutate = { currentData ->
                if (currentData.folders.any { it.id == folder.id }) {
                    throw VaultException.FolderAlreadyExists(folder.id)
                }
                currentData.copy(folders = currentData.folders + folder)
            },
            successLog = {
                SafeLog.d(
                    TAG,
                    "Folder added: folderId=${SafeLog.redact(folder.id)}"
                )
            }
        )
    }

    /**
     * Met à jour un folder existant
     */
    suspend fun updateFolder(folder: FolderEntity): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return persistSessionMutation(
            session = session,
            operationName = "update folder ${SafeLog.redact(folder.id)}",
            mutate = { currentData ->
                if (currentData.folders.none { it.id == folder.id }) {
                    throw VaultException.FolderNotFound(folder.id)
                }
                currentData.copy(
                    folders = currentData.folders.map { existing ->
                        if (existing.id == folder.id) folder else existing
                    }
                )
            },
            successLog = {
                SafeLog.d(
                    TAG,
                    "Folder updated: folderId=${SafeLog.redact(folder.id)}"
                )
            }
        )
    }

    /**
     * Supprime un folder
     */
    suspend fun deleteFolder(folderId: String): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return persistSessionMutation(
            session = session,
            operationName = "delete folder ${SafeLog.redact(folderId)}",
            mutate = { currentData ->
                if (currentData.folders.none { it.id == folderId }) {
                    throw VaultException.FolderNotFound(folderId)
                }
                val updatedFolders = currentData.folders.filter { it.id != folderId }
                val updatedEntries = currentData.entries.map { entry ->
                    if (entry.folderId == folderId) entry.copy(folderId = null) else entry
                }

                currentData.copy(
                    folders = updatedFolders,
                    entries = updatedEntries
                )
            },
            successLog = {
                SafeLog.d(
                    TAG,
                    "Folder deleted: folderId=${SafeLog.redact(folderId)}"
                )
            }
        )
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

        return persistSessionMutation(
            session = session,
            operationName = "add tag ${SafeLog.redact(tag.id)}",
            mutate = { currentData ->
                if (currentData.tags.any { it.id == tag.id }) {
                    throw VaultException.TagAlreadyExists(tag.id)
                }
                currentData.copy(tags = currentData.tags + tag)
            },
            successLog = {
                SafeLog.d(
                    TAG,
                    "Tag added: tagId=${SafeLog.redact(tag.id)}"
                )
            }
        )
    }

    /**
     * Met à jour un tag existant
     */
    suspend fun updateTag(tag: TagEntity): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return persistSessionMutation(
            session = session,
            operationName = "update tag ${SafeLog.redact(tag.id)}",
            mutate = { currentData ->
                if (currentData.tags.none { it.id == tag.id }) {
                    throw VaultException.TagNotFound(tag.id)
                }
                currentData.copy(
                    tags = currentData.tags.map { existing ->
                        if (existing.id == tag.id) tag else existing
                    }
                )
            },
            successLog = {
                SafeLog.d(
                    TAG,
                    "Tag updated: tagId=${SafeLog.redact(tag.id)}"
                )
            }
        )
    }

    /**
     * Supprime un tag
     */
    suspend fun deleteTag(tagId: String): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return persistSessionMutation(
            session = session,
            operationName = "delete tag ${SafeLog.redact(tagId)}",
            mutate = { currentData ->
                if (currentData.tags.none { it.id == tagId }) {
                    throw VaultException.TagNotFound(tagId)
                }
                val updatedTags = currentData.tags.filter { it.id != tagId }
                val updatedEntryTags = currentData.entryTags.filter { it.tagId != tagId }

                currentData.copy(
                    tags = updatedTags,
                    entryTags = updatedEntryTags
                )
            },
            successLog = {
                SafeLog.d(
                    TAG,
                    "Tag deleted: tagId=${SafeLog.redact(tagId)}"
                )
            }
        )
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

        return persistSessionMutation(
            session = session,
            operationName = "add preset ${SafeLog.redact(preset.id)}",
            mutate = { currentData ->
                if (currentData.presets.any { it.id == preset.id }) {
                    throw VaultException.PresetAlreadyExists(preset.id)
                }
                currentData.copy(presets = currentData.presets + preset)
            },
            successLog = {
                SafeLog.d(
                    TAG,
                    "Preset added: presetId=${SafeLog.redact(preset.id)}"
                )
            }
        )
    }

    /**
     * Met à jour un preset existant
     */
    suspend fun updatePreset(preset: PresetEntity): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return persistSessionMutation(
            session = session,
            operationName = "update preset ${SafeLog.redact(preset.id)}",
            mutate = { currentData ->
                if (currentData.presets.none { it.id == preset.id }) {
                    throw VaultException.PresetNotFound(preset.id)
                }
                currentData.copy(
                    presets = currentData.presets.map { existing ->
                        if (existing.id == preset.id) preset else existing
                    }
                )
            },
            successLog = {
                SafeLog.d(
                    TAG,
                    "Preset updated: presetId=${SafeLog.redact(preset.id)}"
                )
            }
        )
    }

    /**
     * Supprime un preset
     */
    suspend fun deletePreset(presetId: String): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return persistSessionMutation(
            session = session,
            operationName = "delete preset ${SafeLog.redact(presetId)}",
            mutate = { currentData ->
                if (currentData.presets.none { it.id == presetId }) {
                    throw VaultException.PresetNotFound(presetId)
                }
                currentData.copy(presets = currentData.presets.filter { it.id != presetId })
            },
            successLog = {
                SafeLog.d(
                    TAG,
                    "Preset deleted: presetId=${SafeLog.redact(presetId)}"
                )
            }
        )
    }

    // ========== Master Password Management ==========

    /**
     * Active le déverrouillage biométrique pour le vault actuel
     *
     * @param masterPassword Le mot de passe maître (pour le chiffrer avec Keystore)
     * @return Result indiquant le succès ou l'échec
     */
    suspend fun enableBiometricUnlock(masterPassword: String): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return withContext(Dispatchers.IO) {
            try {
                SafeLog.d(
                    TAG,
                    "Enabling biometric unlock for vault: vaultId=${SafeLog.redact(session.vaultId)}"
                )

                val keyAlias = "genpwd_vault_${session.vaultId}_biometric"

                // Fixed: Créer la nouvelle clé AVANT de supprimer l'ancienne pour éviter race condition
                // Si le processus crash entre delete et create, l'utilisateur perdrait l'accès biométrique

                // Étape 1: Chiffrer avec la nouvelle clé (crée automatiquement la clé si inexistante)
                val encryptedData = keystoreManager.encryptString(masterPassword, keyAlias)

                // Étape 2: La clé existe maintenant, on peut procéder en toute sécurité
                // Note: Si l'ancienne clé existait, elle a été écrasée automatiquement par encryptString

                // Mettre à jour la registry avec les données biométriques
                vaultRegistryDao.updateById(session.vaultId) { entry ->
                    entry.copy(
                        biometricUnlockEnabled = true,
                        encryptedMasterPassword = encryptedData.ciphertext,
                        masterPasswordIv = encryptedData.iv
                    )
                }

                SafeLog.d(TAG, "Biometric unlock enabled successfully with new key")
                Result.success(Unit)

            } catch (e: Exception) {
                SafeLog.e(TAG, "Failed to enable biometric unlock", e)
                Result.failure(e)
            }
        }
    }

    /**
     * Change le mot de passe maître du vault actuel
     *
     * @param currentPassword Mot de passe actuel (pour vérification)
     * @param newPassword Nouveau mot de passe
     * @return Result indiquant le succès ou l'échec
     */
    suspend fun changeMasterPassword(
        currentPassword: String,
        newPassword: String
    ): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return withContext(Dispatchers.IO) {
            try {
                SafeLog.d(
                    TAG,
                    "Changing master password for vault: vaultId=${SafeLog.redact(session.vaultId)}"
                )

                // 1. Vérifier le mot de passe actuel
                val currentSalt = cryptoManager.generateSaltFromString(session.vaultId)
                val currentKey = cryptoManager.deriveKey(currentPassword, currentSalt)

                // Comparer les clés pour vérifier le mot de passe
                if (!currentKey.encoded.contentEquals(session.vaultKey.encoded)) {
                    return@withContext Result.failure(Exception("Mot de passe actuel incorrect"))
                }

                // 2. Dériver la nouvelle clé avec le nouveau mot de passe
                val newSalt = cryptoManager.generateSaltFromString(session.vaultId)
                val newKey = cryptoManager.deriveKey(newPassword, newSalt)

                // 3. Créer une nouvelle session avec la nouvelle clé
                val newSession = session.copy(vaultKey = newKey)

                // 4. Sauvegarder le vault avec la nouvelle clé
                val vaultData = session.vaultData.value

                when {
                    newSession.fileUri != null -> {
                        vaultFileManager.updateVaultFileAtUri(
                            fileUri = newSession.fileUri,
                            data = vaultData,
                            vaultKey = newKey
                        )
                    }
                    else -> {
                        vaultFileManager.saveVaultFile(
                            vaultId = newSession.vaultId,
                            data = vaultData,
                            vaultKey = newKey,
                            strategy = newSession.storageStrategy,
                            customPath = null
                        )
                    }
                }

                // 5. Désactiver la biométrie (l'ancien mot de passe chiffré n'est plus valide)
                vaultRegistryDao.updateById(session.vaultId) { entry ->
                    entry.copy(
                        biometricUnlockEnabled = false,
                        encryptedMasterPassword = null,
                        masterPasswordIv = null
                    )
                }

                // 6. Mettre à jour la session avec la nouvelle clé
                currentSession = newSession

                SafeLog.d(TAG, "Master password changed successfully, biometric disabled")
                Result.success(Unit)

            } catch (e: Exception) {
                SafeLog.e(TAG, "Failed to change master password", e)
                Result.failure(e)
            }
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
                SafeLog.d(
                    TAG,
                    "Saving vault: vaultId=${SafeLog.redact(session.vaultId)}"
                )

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
                SafeLog.e(
                    TAG,
                    "Failed to save vault: vaultId=${SafeLog.redact(session.vaultId)}",
                    e
                )
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

        session.lastInteractionTimestamp = System.currentTimeMillis()
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
     * Indique si la session courante est expirée selon un délai en heures.
     */
    fun isSessionExpired(timeoutHours: Long): Boolean {
        val session = currentSession ?: return true
        val now = System.currentTimeMillis()
        val timeoutMillis = TimeUnit.HOURS.toMillis(timeoutHours)
        val expired = (now - session.lastInteractionTimestamp) > timeoutMillis

        if (expired) {
            SafeLog.d(
                TAG,
                "Session expired for vault: ${SafeLog.redact(session.vaultId)}"
            )
        }

        return expired
    }

    /**
     * Nettoie la session si elle est expirée.
     * @return true si un verrouillage a été effectué
     */
    suspend fun clearExpiredSession(timeoutHours: Long): Boolean {
        return if (isSessionExpired(timeoutHours)) {
            SafeLog.d(TAG, "Clearing expired session after timeout of $timeoutHours hours")
            lockVault()
            true
        } else {
            false
        }
    }

    /**
     * Nettoie les ressources de session et annule les tâches actives.
     */
    fun cleanup() {
        sessionScope.cancel()
        sessionScope = newSessionScope()
        currentSession?.cleanup()
        currentSession = null
        _activeVaultId.value = null
    }
}
