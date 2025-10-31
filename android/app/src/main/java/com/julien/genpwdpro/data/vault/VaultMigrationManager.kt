package com.julien.genpwdpro.data.vault

import android.content.Context
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.data.crypto.VaultCryptoManager
import com.julien.genpwdpro.data.db.dao.FolderDao
import com.julien.genpwdpro.data.db.dao.PresetDao
import com.julien.genpwdpro.data.db.dao.TagDao
import com.julien.genpwdpro.data.db.dao.VaultDao
import com.julien.genpwdpro.data.db.dao.VaultEntryDao
import com.julien.genpwdpro.data.db.dao.VaultRegistryDao
import com.julien.genpwdpro.data.db.entity.EntryTagCrossRef
import com.julien.genpwdpro.data.db.entity.VaultEntity
import com.julien.genpwdpro.data.db.entity.VaultRegistryEntry
import com.julien.genpwdpro.data.models.vault.StorageStrategy
import com.julien.genpwdpro.data.models.vault.VaultData
import com.julien.genpwdpro.data.models.vault.VaultMetadata
import com.julien.genpwdpro.data.models.vault.VaultStatistics
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.crypto.SecretKey
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.first

/**
 * Gestionnaire de migration des vaults
 *
 * Responsable de:
 * - Détection automatique si migration nécessaire
 * - Création de backups avant migration
 * - Migration Room → fichiers .gpv
 * - Rollback en cas d'erreur
 * - Progression de la migration
 */
@Singleton
class VaultMigrationManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val vaultDao: VaultDao,
    private val vaultEntryDao: VaultEntryDao,
    private val folderDao: FolderDao,
    private val tagDao: TagDao,
    private val presetDao: PresetDao,
    private val vaultRegistryDao: VaultRegistryDao,
    private val vaultFileManager: VaultFileManager,
    private val cryptoManager: VaultCryptoManager
) {

    companion object {
        private const val TAG = "VaultMigrationManager"
        private const val MIGRATION_PREF_KEY = "vault_migration_completed"
        private const val BACKUP_DIR_NAME = "vault_backups"
    }

    /**
     * État de la migration
     */
    data class MigrationProgress(
        val totalVaults: Int,
        val currentVault: Int,
        val vaultName: String,
        val status: MigrationStatus,
        val error: String? = null
    )

    enum class MigrationStatus {
        DETECTING,
        BACKING_UP,
        MIGRATING,
        COMPLETED,
        ERROR,
        ROLLBACK
    }

    /**
     * Résultat de la migration
     */
    sealed class MigrationResult {
        data class Success(val migratedCount: Int) : MigrationResult()
        data class Error(val message: String, val cause: Throwable?) : MigrationResult()
        object NotNeeded : MigrationResult()
    }

    /**
     * Détecte si une migration est nécessaire
     *
     * Migration nécessaire si:
     * - Des vaults existent dans Room
     * - Aucun vault dans vault_registry
     * - Migration pas déjà effectuée
     */
    suspend fun isMigrationNeeded(): Boolean {
        // Vérifier si migration déjà effectuée
        val prefs = context.getSharedPreferences("vault_migration", Context.MODE_PRIVATE)
        if (prefs.getBoolean(MIGRATION_PREF_KEY, false)) {
            SafeLog.d(TAG, "Migration already completed")
            return false
        }

        // Compter les vaults dans Room
        val roomVaults = vaultDao.getAllVaults().first()
        if (roomVaults.isEmpty()) {
            SafeLog.d(TAG, "No vaults in Room, migration not needed")
            return false
        }

        // Compter les vaults dans registry
        val registryVaults = vaultRegistryDao.getAllVaults().first()

        val needed = registryVaults.isEmpty()
        SafeLog.d(
            TAG,
            "Migration needed: $needed (Room: ${roomVaults.size}, Registry: ${registryVaults.size})"
        )

        return needed
    }

    /**
     * Effectue la migration complète
     *
     * @param masterPasswords Map de vaultId → masterPassword
     * @param progressCallback Callback pour la progression
     */
    suspend fun migrateAllVaults(
        masterPasswords: Map<String, String>,
        progressCallback: ((MigrationProgress) -> Unit)? = null
    ): MigrationResult {
        return try {
            progressCallback.notify(MigrationStatus.DETECTING, total = 0)

            val roomVaults = prepareMigration() ?: return MigrationResult.NotNeeded
            progressCallback.notify(MigrationStatus.BACKING_UP, total = roomVaults.size)

            val backupDir = createBackup(roomVaults)
            SafeLog.i(TAG, "Backup created at: ${SafeLog.redact(backupDir.absolutePath)}")

            val migratedCount = migrateVaults(roomVaults, masterPasswords, progressCallback)

            markMigrationCompleted()
            progressCallback.notify(
                status = MigrationStatus.COMPLETED,
                total = roomVaults.size,
                current = roomVaults.size
            )
            SafeLog.i(
                TAG,
                "Migration completed: $migratedCount/${roomVaults.size} vaults migrated"
            )
            MigrationResult.Success(migratedCount)
        } catch (exception: Exception) {
            SafeLog.e(TAG, "Migration failed", exception)
            progressCallback.notify(
                status = MigrationStatus.ERROR,
                total = 0,
                current = 0,
                error = exception.message
            )
            MigrationResult.Error(exception.message ?: "Unknown error", exception)
        }
    }

    private suspend fun prepareMigration(): List<VaultEntity>? {
        if (!isMigrationNeeded()) {
            return null
        }
        val roomVaults = vaultDao.getAllVaults().first()
        SafeLog.i(TAG, "Starting migration of ${roomVaults.size} vaults")
        return roomVaults
    }

    private suspend fun migrateVaults(
        roomVaults: List<VaultEntity>,
        masterPasswords: Map<String, String>,
        progressCallback: ((MigrationProgress) -> Unit)?
    ): Int {
        var migratedCount = 0
        roomVaults.forEachIndexed { index, vaultEntity ->
            val masterPassword = masterPasswords[vaultEntity.id]
            if (masterPassword == null) {
                SafeLog.w(
                    TAG,
                    "Skipping vault ${SafeLog.redact(vaultEntity.id)} - no password provided"
                )
                return@forEachIndexed
            }

            progressCallback.notify(
                status = MigrationStatus.MIGRATING,
                total = roomVaults.size,
                current = index + 1,
                vaultName = vaultEntity.name
            )

            if (migrateVault(vaultEntity, masterPassword)) {
                migratedCount++
                SafeLog.i(TAG, "Migrated vault: ${SafeLog.redact(vaultEntity.id)}")
            } else {
                SafeLog.e(TAG, "Failed to migrate vault: ${SafeLog.redact(vaultEntity.id)}")
            }
        }
        return migratedCount
    }

    /**
     * Migre un vault individuel Room → .gpv
     */
    private suspend fun migrateVault(
        vaultEntity: VaultEntity,
        masterPassword: String
    ): Boolean {
        return try {
            // 1. Déverrouiller le vault pour obtenir la clé
            val vaultKey = cryptoManager.unlockVault(
                masterPassword = masterPassword,
                salt = vaultEntity.salt,
                encryptedKey = vaultEntity.encryptedKey,
                keyIv = vaultEntity.keyIv
            ) ?: run {
                SafeLog.e(TAG, "Failed to unlock vault: ${SafeLog.redact(vaultEntity.id)}")
                return false
            }

            // 2. Extraire toutes les données du vault
            val vaultData = extractVaultData(vaultEntity.id, vaultKey)

            // 3. Créer le fichier .gpv
            val file = vaultFileManager.saveVaultFile(
                vaultId = vaultEntity.id,
                data = vaultData,
                vaultKey = vaultKey,
                strategy = StorageStrategy.APP_STORAGE, // Par défaut: survit à la désinstallation
                customPath = null
            )

            // 4. Créer l'entrée dans vault_registry
            val registryEntry = VaultRegistryEntry(
                id = vaultEntity.id,
                name = vaultEntity.name,
                filePath = file.absolutePath,
                storageStrategy = StorageStrategy.APP_STORAGE,
                fileSize = file.length(),
                lastModified = file.lastModified(),
                lastAccessed = vaultEntity.lastAccessedAt,
                isDefault = vaultEntity.isDefault,
                isLoaded = false,
                statistics = vaultData.metadata.statistics,
                description = vaultEntity.description,
                createdAt = vaultEntity.createdAt
            )

            vaultRegistryDao.insert(registryEntry)

            SafeLog.d(
                TAG,
                "Successfully migrated vault: ${SafeLog.redact(vaultEntity.id)} (${file.length()} bytes)"
            )
            true
        } catch (e: Exception) {
            SafeLog.e(TAG, "Error migrating vault: ${SafeLog.redact(vaultEntity.id)}", e)
            false
        }
    }

    /**
     * Extrait toutes les données d'un vault Room
     */
    private suspend fun extractVaultData(vaultId: String, vaultKey: SecretKey): VaultData {
        // Récupérer le vault entity pour les métadonnées
        val vaultEntity = vaultDao.getById(vaultId)
            ?: throw IllegalStateException("Vault not found: $vaultId")

        // Récupérer toutes les données
        val entries = vaultEntryDao.getEntriesByVault(vaultId).first()
        val folders = folderDao.getFoldersByVault(vaultId).first()
        val tags = tagDao.getTagsByVault(vaultId).first()
        val presets = presetDao.getPresetsByVault(vaultId).first()

        // Récupérer les relations entry-tag
        val entryTags = entries.flatMap { entry ->
            tagDao.getTagsForEntry(entry.id).first().map { tag ->
                EntryTagCrossRef(entryId = entry.id, tagId = tag.id)
            }
        }

        // Créer les métadonnées
        val metadata = VaultMetadata(
            vaultId = vaultEntity.id,
            name = vaultEntity.name,
            description = vaultEntity.description,
            isDefault = vaultEntity.isDefault,
            createdAt = vaultEntity.createdAt,
            modifiedAt = vaultEntity.modifiedAt,
            statistics = VaultStatistics(
                entryCount = entries.size,
                folderCount = folders.size,
                presetCount = presets.size,
                tagCount = tags.size,
                totalSize = 0L // Sera calculé après
            )
        )

        return VaultData(
            metadata = metadata,
            entries = entries,
            folders = folders,
            tags = tags,
            presets = presets,
            entryTags = entryTags
        )
    }

    /**
     * Crée un backup de la base de données Room
     */
    private suspend fun createBackup(vaults: List<VaultEntity>): File {
        val backupDir = File(context.filesDir, BACKUP_DIR_NAME).apply {
            if (!exists()) mkdirs()
        }

        val timestamp = System.currentTimeMillis()
        val backupFile = File(backupDir, "room_backup_$timestamp.json")

        // Sauvegarder les métadonnées des vaults en JSON
        val gson = com.google.gson.GsonBuilder()
            .setPrettyPrinting()
            .create()

        val backupData = vaults.map { vault ->
            mapOf(
                "id" to vault.id,
                "name" to vault.name,
                "description" to vault.description,
                "createdAt" to vault.createdAt,
                "isDefault" to vault.isDefault
            )
        }

        backupFile.writeText(gson.toJson(backupData))

        SafeLog.i(TAG, "Backup created: ${SafeLog.redact(backupFile.absolutePath)}")
        return backupFile
    }

    /**
     * Marque la migration comme complétée
     */
    private fun markMigrationCompleted() {
        val prefs = context.getSharedPreferences("vault_migration", Context.MODE_PRIVATE)
        prefs.edit().putBoolean(MIGRATION_PREF_KEY, true).apply()
    }

    private fun ((MigrationProgress) -> Unit)?.notify(
        status: MigrationStatus,
        total: Int,
        current: Int = 0,
        vaultName: String = "",
        error: String? = null
    ) {
        this?.invoke(
            MigrationProgress(
                totalVaults = total,
                currentVault = current,
                vaultName = vaultName,
                status = status,
                error = error
            )
        )
    }

    /**
     * Réinitialise le flag de migration (pour debug/tests)
     */
    fun resetMigrationFlag() {
        val prefs = context.getSharedPreferences("vault_migration", Context.MODE_PRIVATE)
        prefs.edit().putBoolean(MIGRATION_PREF_KEY, false).apply()
    }

    /**
     * Obtient le répertoire des backups
     */
    fun getBackupDirectory(): File {
        return File(context.filesDir, BACKUP_DIR_NAME)
    }

    /**
     * Liste tous les backups disponibles
     */
    fun listBackups(): List<File> {
        val backupDir = getBackupDirectory()
        if (!backupDir.exists()) return emptyList()

        return backupDir.listFiles()
            ?.filter { it.name.startsWith("room_backup_") && it.extension == "json" }
            ?.sortedByDescending { it.lastModified() }
            ?: emptyList()
    }
}
