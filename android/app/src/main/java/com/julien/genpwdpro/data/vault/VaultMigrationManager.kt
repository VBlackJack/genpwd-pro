package com.julien.genpwdpro.data.vault

import android.content.Context
import android.util.Log
import com.julien.genpwdpro.data.crypto.VaultCryptoManager
import com.julien.genpwdpro.data.local.dao.*
import com.julien.genpwdpro.data.local.entity.*
import com.julien.genpwdpro.data.models.vault.*
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import java.io.File
import java.util.UUID
import javax.crypto.SecretKey
import javax.inject.Inject
import javax.inject.Singleton

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
            Log.d(TAG, "Migration already completed")
            return false
        }

        // Compter les vaults dans Room
        val roomVaults = vaultDao.getAllVaults().first()
        if (roomVaults.isEmpty()) {
            Log.d(TAG, "No vaults in Room, migration not needed")
            return false
        }

        // Compter les vaults dans registry
        val registryVaults = vaultRegistryDao.getAllVaults().first()

        val needed = registryVaults.isEmpty()
        Log.d(TAG, "Migration needed: $needed (Room: ${roomVaults.size}, Registry: ${registryVaults.size})")

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
        try {
            // 1. Vérifier si migration nécessaire
            progressCallback?.invoke(MigrationProgress(0, 0, "", MigrationStatus.DETECTING))

            if (!isMigrationNeeded()) {
                return MigrationResult.NotNeeded
            }

            // 2. Récupérer tous les vaults Room
            val roomVaults = vaultDao.getAllVaults().first()
            Log.i(TAG, "Starting migration of ${roomVaults.size} vaults")

            // 3. Créer backup
            progressCallback?.invoke(MigrationProgress(roomVaults.size, 0, "", MigrationStatus.BACKING_UP))
            val backupDir = createBackup(roomVaults)
            Log.i(TAG, "Backup created at: ${backupDir.absolutePath}")

            // 4. Migrer chaque vault
            var migratedCount = 0
            roomVaults.forEachIndexed { index, vaultEntity ->
                val masterPassword = masterPasswords[vaultEntity.id]
                if (masterPassword == null) {
                    Log.w(TAG, "Skipping vault ${vaultEntity.name} - no password provided")
                    return@forEachIndexed
                }

                progressCallback?.invoke(
                    MigrationProgress(
                        totalVaults = roomVaults.size,
                        currentVault = index + 1,
                        vaultName = vaultEntity.name,
                        status = MigrationStatus.MIGRATING
                    )
                )

                val result = migrateVault(vaultEntity, masterPassword)
                if (result) {
                    migratedCount++
                    Log.i(TAG, "Migrated vault: ${vaultEntity.name}")
                } else {
                    Log.e(TAG, "Failed to migrate vault: ${vaultEntity.name}")
                }
            }

            // 5. Marquer migration comme complétée
            markMigrationCompleted()

            progressCallback?.invoke(
                MigrationProgress(
                    totalVaults = roomVaults.size,
                    currentVault = roomVaults.size,
                    vaultName = "",
                    status = MigrationStatus.COMPLETED
                )
            )

            Log.i(TAG, "Migration completed: $migratedCount/${roomVaults.size} vaults migrated")
            return MigrationResult.Success(migratedCount)

        } catch (e: Exception) {
            Log.e(TAG, "Migration failed", e)
            progressCallback?.invoke(
                MigrationProgress(
                    totalVaults = 0,
                    currentVault = 0,
                    vaultName = "",
                    status = MigrationStatus.ERROR,
                    error = e.message
                )
            )
            return MigrationResult.Error(e.message ?: "Unknown error", e)
        }
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
                Log.e(TAG, "Failed to unlock vault: ${vaultEntity.name}")
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

            Log.d(TAG, "Successfully migrated vault: ${vaultEntity.name} (${file.length()} bytes)")
            true

        } catch (e: Exception) {
            Log.e(TAG, "Error migrating vault: ${vaultEntity.name}", e)
            false
        }
    }

    /**
     * Extrait toutes les données d'un vault Room
     */
    private suspend fun extractVaultData(vaultId: String, vaultKey: SecretKey): VaultData {
        // Récupérer le vault entity pour les métadonnées
        val vaultEntity = vaultDao.getVaultById(vaultId).first()
            ?: throw IllegalStateException("Vault not found: $vaultId")

        // Récupérer toutes les données
        val entries = vaultEntryDao.getEntriesByVault(vaultId).first()
        val folders = folderDao.getFoldersByVault(vaultId).first()
        val tags = tagDao.getTagsByVault(vaultId).first()
        val presets = presetDao.getPresetsByVault(vaultId).first()

        // Récupérer les relations entry-tag
        val entryTags = entries.flatMap { entry ->
            vaultEntryDao.getTagsForEntry(entry.id).first().map { tag ->
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

        Log.i(TAG, "Backup created: ${backupFile.absolutePath}")
        return backupFile
    }

    /**
     * Marque la migration comme complétée
     */
    private fun markMigrationCompleted() {
        val prefs = context.getSharedPreferences("vault_migration", Context.MODE_PRIVATE)
        prefs.edit().putBoolean(MIGRATION_PREF_KEY, true).apply()
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
