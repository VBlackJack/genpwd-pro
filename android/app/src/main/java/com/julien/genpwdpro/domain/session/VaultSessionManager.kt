package com.julien.genpwdpro.domain.session

import android.net.Uri
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ProcessLifecycleOwner
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.data.db.dao.VaultRegistryDao
import com.julien.genpwdpro.data.db.dao.updateById
import com.julien.genpwdpro.data.db.entity.VaultRegistryEntry
import com.julien.genpwdpro.data.models.vault.*
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
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

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
    private val keystoreManager: KeystoreManager,
    private val biometricKeyManager: com.julien.genpwdpro.security.BiometricKeyManager,
    private val unlockRateLimiter: UnlockRateLimiter
) {
    companion object {
        private const val TAG = "VaultSessionManager"
        private const val DEFAULT_AUTO_LOCK_MINUTES = 5
        private const val FOREGROUND_RECHECK_DELAY_MS = 5_000L
    }

    // MEMORY LEAK FIX: Reusable empty StateFlows to prevent memory leaks
    // When no session is active, return these singletons instead of creating new MutableStateFlows
    // that would never be garbage collected
    private val emptyEntriesFlow = MutableStateFlow<List<VaultEntryEntity>>(emptyList()).asStateFlow()
    private val emptyFoldersFlow = MutableStateFlow<List<FolderEntity>>(emptyList()).asStateFlow()
    private val emptyTagsFlow = MutableStateFlow<List<TagEntity>>(emptyList()).asStateFlow()
    private val emptyPresetsFlow = MutableStateFlow<List<PresetEntity>>(emptyList()).asStateFlow()

    /**
     * Session active représentant un vault déverrouillé
     */
    data class VaultSession(
        val vaultId: String,
        val vaultKey: SecretKey,
        val header: VaultFileHeader,
        val kdfSalt: ByteArray,
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

    private val mutationMutex = Mutex()

    // CRITICAL: Protects session state transitions (lock/unlock) to prevent race conditions
    // Without this, concurrent lock/unlock operations could create inconsistent state
    private val sessionStateMutex = Mutex()

    // Flux d'observation de la session active
    private val _activeVaultId = MutableStateFlow<String?>(null)
    val activeVaultId: StateFlow<String?> = _activeVaultId.asStateFlow()

    // État de déverrouillage requis (pour prompt après retour de l'app)
    data class RequiresUnlockState(val vaultId: String, val hasBiometric: Boolean)
    private val _requiresUnlock = MutableStateFlow<RequiresUnlockState?>(null)
    val requiresUnlock: StateFlow<RequiresUnlockState?> = _requiresUnlock.asStateFlow()

    // Biometric key rotation events (emitted by BiometricMaintenanceWorker)
    // Uses SharedFlow with replay=0 so events are only received by active collectors
    private val _biometricRotationEvents = MutableSharedFlow<BiometricRotationEvent>(
        replay = 0,
        extraBufferCapacity = 1 // Buffer one event to avoid losing it if no collector is active
    )
    val biometricRotationEvents: SharedFlow<BiometricRotationEvent> = _biometricRotationEvents.asSharedFlow()

    // Scope pour les coroutines de session
    private var sessionScope = newSessionScope()

    private fun newSessionScope(): CoroutineScope {
        return CoroutineScope(SupervisorJob() + Dispatchers.Default)
    }

    private suspend fun persistSessionMutation(
        session: VaultSession,
        operationName: String,
        mutate: (VaultData) -> VaultData,
        successLog: () -> Unit = {},
    ): Result<Unit> {
        return mutationMutex.withLock {
            val previousData = session.vaultData.value
            try {
                val updatedData = mutate(previousData)

                if (updatedData == previousData) {
                    SafeLog.d(
                        TAG,
                        "No changes detected after $operationName – skipping persistence"
                    )
                    resetAutoLockTimer()
                    return@withLock Result.success(Unit)
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
                    return@withLock Result.failure(
                        VaultException.SaveFailed(
                            message = "Failed to save vault after $operationName.",
                            cause = cause
                        )
                    )
                }

                resetAutoLockTimer()
                successLog()
                Result.success(Unit)
            } catch (e: CancellationException) {
                session.updateData(previousData)
                throw e  // Always rethrow cancellation
            } catch (e: VaultException) {
                session.updateData(previousData)
                SafeLog.w(
                    TAG,
                    "Business rule failed during $operationName: ${e.message}"
                )
                Result.failure(e)
            } catch (e: OutOfMemoryError) {
                // CRITICAL: Don't catch OOM - let it propagate to crash handler
                SafeLog.e(TAG, "CRITICAL: Out of memory during $operationName", e)
                throw e
            } catch (e: StackOverflowError) {
                // CRITICAL: Don't catch stack overflow - let it propagate
                SafeLog.e(TAG, "CRITICAL: Stack overflow during $operationName", e)
                throw e
            } catch (e: Exception) {
                session.updateData(previousData)
                SafeLog.e(TAG, "Failed to $operationName: ${e.javaClass.simpleName}", e)
                Result.failure(e)
            }
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
     * Signale qu'un déverrouillage est requis (appelé après retour de l'app)
     */
    suspend fun setRequiresUnlock(vaultId: String) {
        val vault = vaultRegistryDao.getById(vaultId)
        _requiresUnlock.value = RequiresUnlockState(
            vaultId = vaultId,
            hasBiometric = vault?.biometricUnlockEnabled ?: false
        )
        SafeLog.d(TAG, "Unlock required for vault: $vaultId (biometric=${vault?.biometricUnlockEnabled})")
    }

    /**
     * Efface l'état de déverrouillage requis
     */
    fun clearRequiresUnlock() {
        _requiresUnlock.value = null
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

                // Vérifier le rate limiting AVANT toute tentative de déverrouillage
                when (val rateLimitResult = unlockRateLimiter.checkAndRecordAttempt(vaultId)) {
                    is UnlockRateLimiter.RateLimitResult.LockedOut -> {
                        SafeLog.w(
                            TAG,
                            "Unlock attempt blocked: vaultId=${SafeLog.redact(vaultId)}, " +
                            "locked for ${rateLimitResult.secondsRemaining}s"
                        )
                        return@withContext Result.failure(
                            VaultException.TooManyAttempts(
                                remainingSeconds = rateLimitResult.secondsRemaining,
                                message = "Too many failed unlock attempts. " +
                                    "Vault locked for ${rateLimitResult.secondsRemaining} seconds."
                            )
                        )
                    }
                    is UnlockRateLimiter.RateLimitResult.Allowed -> {
                        SafeLog.d(
                            TAG,
                            "Unlock attempt allowed: vaultId=${SafeLog.redact(vaultId)}, " +
                            "attemptsRemaining=${rateLimitResult.attemptsRemaining}"
                        )
                        // Continue with unlock process
                    }
                }

                // CRITICAL: Check current session state with mutex protection
                // This prevents race conditions where unlock/lock happen concurrently
                sessionStateMutex.withLock {
                    currentSession?.let {
                        if (it.vaultId == vaultId) {
                            _activeVaultId.value = vaultId
                            resetAutoLockTimer()
                            SafeLog.w(
                                TAG,
                                "Vault already unlocked: vaultId=${SafeLog.redact(vaultId)}"
                            )
                            return@withContext Result.success(Unit)
                        }
                        // If different vault is unlocked, we need to lock it first
                        // but we release the mutex to avoid deadlock
                    }
                }

                // Lock previous vault if needed (outside mutex to avoid deadlock)
                currentSession?.let { previousSession ->
                    if (previousSession.vaultId != vaultId) {
                        SafeLog.d(
                            TAG,
                            "Locking previous vault: vaultId=${SafeLog.redact(previousSession.vaultId)}"
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

                val loadResult = try {
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

                // Créer la session
                val session = VaultSession(
                    vaultId = vaultId,
                    vaultKey = loadResult.vaultKey,
                    header = loadResult.header,
                    kdfSalt = loadResult.salt.copyOf(),
                    filePath = vaultRegistry.filePath,
                    storageStrategy = vaultRegistry.storageStrategy,
                    fileUri = resolvedUri,
                    _vaultData = MutableStateFlow(loadResult.data)
                )

                // CRITICAL: Assign session with mutex protection
                sessionStateMutex.withLock {
                    currentSession = session
                    _activeVaultId.value = vaultId
                }

                // Mettre à jour les statistiques et métadonnées
                try {
                    val fileSize = resolvedUri?.let { uri ->
                        vaultFileManager.getVaultFileSizeFromUri(uri)
                    } ?: vaultFileManager.getVaultFileSize(vaultRegistry.filePath)

                    val statistics = calculateStatistics(loadResult.data, fileSize)

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

                // Enregistrer le succès pour réinitialiser le rate limiter
                unlockRateLimiter.recordSuccess(vaultId)

                // Update biometric key last used timestamp if biometric is enabled
                val registry = vaultRegistryDao.getById(vaultId)
                if (registry?.biometricUnlockEnabled == true) {
                    biometricKeyManager.updateLastUsed(vaultId)
                }

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
            // CRITICAL: Get session reference with mutex protection
            val session = sessionStateMutex.withLock {
                currentSession
            } ?: return@withContext

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

                // CRITICAL: Clear session with mutex protection
                sessionStateMutex.withLock {
                    // Nettoyer la session
                    session.cleanup()
                    currentSession = null
                    _activeVaultId.value = null
                }

                SafeLog.i(TAG, "Vault locked successfully")
            } catch (e: Exception) {
                SafeLog.e(
                    TAG,
                    "Error while locking vault: vaultId=${SafeLog.redact(session.vaultId)}",
                    e
                )
                // Forcer le nettoyage même en cas d'erreur
                sessionStateMutex.withLock {
                    session.cleanup()
                    currentSession = null
                    _activeVaultId.value = null
                }
            }
        }
    }

    // ========== Entry Operations ==========

    /**
     * Récupère toutes les entries du vault déverrouillé
     */
    fun getEntries(): StateFlow<List<VaultEntryEntity>> {
        val session = currentSession ?: return emptyEntriesFlow

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
        val session = currentSession ?: return emptyFoldersFlow

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
        val session = currentSession ?: return emptyTagsFlow

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

    /**
     * Adds a tag to an entry (creates many-to-many relationship)
     */
    suspend fun addTagToEntry(entryId: String, tagId: String): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return persistSessionMutation(
            session = session,
            operationName = "add tag to entry ${SafeLog.redact(entryId)}",
            mutate = { currentData ->
                // Validate entry exists
                if (currentData.entries.none { it.id == entryId }) {
                    throw VaultException.EntryNotFound(entryId)
                }
                // Validate tag exists
                if (currentData.tags.none { it.id == tagId }) {
                    throw VaultException.TagNotFound(tagId)
                }
                // Check if relationship already exists
                if (currentData.entryTags.any { it.entryId == entryId && it.tagId == tagId }) {
                    throw IllegalStateException("Tag already assigned to entry")
                }

                currentData.copy(
                    entryTags = currentData.entryTags + EntryTagCrossRef(entryId, tagId)
                )
            },
            successLog = {
                SafeLog.d(
                    TAG,
                    "Tag added to entry: entryId=${SafeLog.redact(entryId)}, tagId=${SafeLog.redact(tagId)}"
                )
            }
        )
    }

    /**
     * Removes a tag from an entry (removes many-to-many relationship)
     */
    suspend fun removeTagFromEntry(entryId: String, tagId: String): Result<Unit> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return persistSessionMutation(
            session = session,
            operationName = "remove tag from entry ${SafeLog.redact(entryId)}",
            mutate = { currentData ->
                val updatedEntryTags = currentData.entryTags.filter {
                    !(it.entryId == entryId && it.tagId == tagId)
                }

                currentData.copy(entryTags = updatedEntryTags)
            },
            successLog = {
                SafeLog.d(
                    TAG,
                    "Tag removed from entry: entryId=${SafeLog.redact(entryId)}, tagId=${SafeLog.redact(tagId)}"
                )
            }
        )
    }

    /**
     * Gets all tags for a specific entry
     */
    fun getTagsForEntry(entryId: String): StateFlow<List<TagEntity>> {
        val session = currentSession ?: return emptyTagsFlow

        return session.vaultData.map { vaultData ->
            val tagIds = vaultData.entryTags
                .filter { it.entryId == entryId }
                .map { it.tagId }

            vaultData.tags.filter { it.id in tagIds }
        }.stateIn(
            scope = sessionScope,
            started = SharingStarted.WhileSubscribed(),
            initialValue = emptyList()
        )
    }

    /**
     * Gets entry count for a specific tag (for statistics)
     */
    suspend fun getEntryCountForTag(tagId: String): Int {
        val session = currentSession ?: return 0
        return session.vaultData.value.entryTags.count { it.tagId == tagId }
    }

    /**
     * Searches tags by name (case-insensitive)
     */
    fun searchTags(query: String): StateFlow<List<TagEntity>> {
        val session = currentSession ?: return emptyTagsFlow

        return session.vaultData.map { vaultData ->
            vaultData.tags.filter { tag ->
                tag.name.contains(query, ignoreCase = true)
            }
        }.stateIn(
            scope = sessionScope,
            started = SharingStarted.WhileSubscribed(),
            initialValue = emptyList()
        )
    }

    // ========== Preset Operations ==========

    /**
     * Récupère tous les presets
     */
    fun getPresets(): StateFlow<List<PresetEntity>> {
        val session = currentSession ?: return emptyPresetsFlow

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
     * SECURITY IMPROVEMENTS (Bug #2):
     * - Uses BiometricKeyManager for versioned keys
     * - Supports key rotation and revocation
     * - Metadata stored in EncryptedSharedPreferences
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

                // Use BiometricKeyManager for versioned key creation
                val encryptedData = biometricKeyManager.createKeyForVault(
                    session.vaultId,
                    masterPassword
                )

                // Mettre à jour la registry avec les données biométriques
                vaultRegistryDao.updateById(session.vaultId) { entry ->
                    entry.copy(
                        biometricUnlockEnabled = true,
                        encryptedMasterPassword = encryptedData.ciphertext,
                        masterPasswordIv = encryptedData.iv
                    )
                }

                SafeLog.i(TAG, "Biometric unlock enabled successfully with versioned key")
                Result.success(Unit)

            } catch (e: Exception) {
                SafeLog.e(TAG, "Failed to enable biometric unlock", e)
                Result.failure(e)
            }
        }
    }

    /**
     * Checks if biometric key should be auto-rotated
     *
     * @return true if key is older than 90 days
     */
    fun shouldRotateBiometricKey(): Boolean {
        val session = currentSession ?: return false
        return biometricKeyManager.shouldRotateKey(session.vaultId)
    }

    /**
     * Emits a biometric rotation event to notify the UI.
     *
     * Called by [BiometricMaintenanceWorker] when key rotation is detected as needed,
     * or after rotation completes/fails.
     *
     * @param event The biometric rotation event to emit
     */
    suspend fun emitBiometricRotationEvent(event: BiometricRotationEvent) {
        SafeLog.d(TAG, "Emitting biometric rotation event: ${event::class.simpleName}")
        _biometricRotationEvents.emit(event)
    }

    /**
     * Performs biometric key rotation for the current vault.
     *
     * This should be called after the user confirms their Master Password
     * in response to a [BiometricRotationEvent.RotationNeeded] event.
     *
     * @param masterPassword The user's Master Password for key derivation
     * @return Result indicating success or failure
     */
    suspend fun rotateBiometricKey(masterPassword: String): Result<Int> {
        val session = currentSession
            ?: return Result.failure(IllegalStateException("No vault unlocked"))

        return try {
            SafeLog.i(TAG, "Starting biometric key rotation for vault: ${SafeLog.redact(session.vaultId)}")

            // Verify password matches current session
            val derivedKey = cryptoManager.deriveKey(masterPassword, session.kdfSalt)
            if (!derivedKey.encoded.contentEquals(session.vaultKey.encoded)) {
                return Result.failure(IllegalArgumentException("Incorrect master password"))
            }

            // Perform the rotation
            val encryptedData = biometricKeyManager.rotateKey(session.vaultId, masterPassword)

            // Get the new key version
            val metadata = biometricKeyManager.getKeyMetadata(session.vaultId)
            val newVersion = metadata?.keyVersion ?: 1

            // Emit success event
            emitBiometricRotationEvent(
                BiometricRotationEvent.RotationCompleted(
                    vaultId = session.vaultId,
                    newKeyVersion = newVersion
                )
            )

            SafeLog.i(TAG, "Biometric key rotation completed: newVersion=$newVersion")
            Result.success(newVersion)
        } catch (e: Exception) {
            SafeLog.e(TAG, "Biometric key rotation failed", e)

            // Emit failure event
            emitBiometricRotationEvent(
                BiometricRotationEvent.RotationFailed(
                    vaultId = session.vaultId,
                    error = e.message ?: "Unknown error",
                    exception = e
                )
            )

            Result.failure(e)
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
            var currentKey: SecretKey? = null
            try {
                SafeLog.d(
                    TAG,
                    "Changing master password for vault: vaultId=${SafeLog.redact(session.vaultId)}"
                )

                // 1. Vérifier le mot de passe actuel
                currentKey = cryptoManager.deriveKey(currentPassword, session.kdfSalt)

                // Comparer les clés pour vérifier le mot de passe
                if (!currentKey.encoded.contentEquals(session.vaultKey.encoded)) {
                    return@withContext Result.failure(Exception("Mot de passe actuel incorrect"))
                }

                // 2. Dériver la nouvelle clé avec le nouveau mot de passe
                val newSalt = cryptoManager.generateSalt()
                val newKey = cryptoManager.deriveKey(newPassword, newSalt)
                val updatedHeader = session.header.copy(
                    kdfSalt = cryptoManager.bytesToHex(newSalt),
                    kdfAlgorithm = VaultFileHeader.DEFAULT_KDF
                )

                // 3. Créer une nouvelle session avec la nouvelle clé
                val newSession = session.copy(
                    vaultKey = newKey,
                    header = updatedHeader,
                    kdfSalt = newSalt.copyOf()
                )

                // 4. Sauvegarder le vault avec la nouvelle clé
                val vaultData = session.vaultData.value

                when {
                    newSession.fileUri != null -> {
                        vaultFileManager.updateVaultFileAtUri(
                            fileUri = newSession.fileUri,
                            data = vaultData,
                            vaultKey = newKey,
                            header = updatedHeader
                        )
                    }
                    else -> {
                        vaultFileManager.saveVaultFile(
                            vaultId = newSession.vaultId,
                            data = vaultData,
                            vaultKey = newKey,
                            header = updatedHeader,
                            strategy = newSession.storageStrategy,
                            customPath = null
                        )
                    }
                }

                // 5. Désactiver et révoquer la biométrie (l'ancien mot de passe chiffré n'est plus valide)
                // Use BiometricKeyManager to properly revoke all keys
                biometricKeyManager.revokeAllKeys(session.vaultId)

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
            } finally {
                // Wipe sensitive key material from memory
                currentKey?.encoded?.fill(0)
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
                val updatedHeader = when {
                    session.fileUri != null -> {
                        vaultFileManager.updateVaultFileAtUri(
                            fileUri = session.fileUri,
                            data = vaultData,
                            vaultKey = session.vaultKey,
                            header = session.header
                        )
                    }

                    else -> {
                        val result = vaultFileManager.saveVaultFile(
                            vaultId = session.vaultId,
                            data = vaultData,
                            vaultKey = session.vaultKey,
                            header = session.header,
                            strategy = session.storageStrategy,
                            customPath = null
                        )
                        result.header
                    }
                }

                currentSession = session.copy(header = updatedHeader)

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

            if (isAppInForeground()) {
                SafeLog.d(TAG, "Auto-lock deferred because app is in foreground")
                while (isActive && isAppInForeground()) {
                    if (currentSession == null) {
                        SafeLog.d(TAG, "Auto-lock cancelled – session cleared while app in foreground")
                        return@launch
                    }
                    delay(FOREGROUND_RECHECK_DELAY_MS)
                }

                if (!isActive || currentSession == null) {
                    SafeLog.d(TAG, "Auto-lock cancelled while waiting for background state")
                    return@launch
                }
            }

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

    private fun isAppInForeground(): Boolean {
        val lifecycleState = ProcessLifecycleOwner.get().lifecycle.currentState
        return lifecycleState.isAtLeast(Lifecycle.State.STARTED)
    }
}
