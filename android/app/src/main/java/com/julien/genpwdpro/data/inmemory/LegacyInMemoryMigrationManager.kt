package com.julien.genpwdpro.data.inmemory

import android.content.Context
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.data.db.dao.FolderDao
import com.julien.genpwdpro.data.db.dao.PresetDao
import com.julien.genpwdpro.data.db.dao.TagDao
import com.julien.genpwdpro.data.db.dao.VaultDao
import com.julien.genpwdpro.data.db.dao.VaultEntryDao
import com.julien.genpwdpro.data.db.database.AppDatabase
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import androidx.room.withTransaction

/**
 * Coordinates the one-off data migration from the legacy in-memory/cache representation
 * to the encrypted SQLCipher Room database. The migration runs exactly once after the
 * application has been upgraded to the SQLCipher build.
 */
@Singleton
class LegacyInMemoryMigrationManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val appDatabase: AppDatabase,
    private val vaultDao: VaultDao,
    private val entryDao: VaultEntryDao,
    private val folderDao: FolderDao,
    private val tagDao: TagDao,
    private val presetDao: PresetDao,
    private val legacyStore: LegacyInMemoryStore,
    private val migrationStateStore: LegacyMigrationStateStore
) {

    suspend fun migrateIfNeeded(): LegacyMigrationResult = withContext(Dispatchers.IO) {
        if (migrationStateStore.isMigrationCompleted()) {
            SafeLog.d(TAG, "Legacy migration already completed")
            return@withContext LegacyMigrationResult.AlreadyMigrated
        }

        val databasePresent = context.getDatabasePath(AppDatabase.DATABASE_NAME)?.let { it.exists() && it.length() > 0L } == true
        if (databasePresent && !legacyStore.hasLegacyState()) {
            migrationStateStore.markMigrationCompleted()
            SafeLog.d(TAG, "SQLCipher database detected and no legacy cache found; marking migration as complete")
            return@withContext LegacyMigrationResult.AlreadyMigrated
        }

        val snapshots = legacyStore.loadSnapshots()
        if (snapshots.isEmpty()) {
            migrationStateStore.markMigrationCompleted()
            SafeLog.d(TAG, "No legacy snapshots detected; nothing to migrate")
            return@withContext LegacyMigrationResult.NoLegacyData
        }

        val failures = mutableListOf<String>()
        val successfulSnapshots = mutableListOf<LegacyVaultSnapshot>()
        var importedVaults = 0
        var importedEntries = 0

        try {
            appDatabase.withTransaction {
                snapshots.forEach { snapshot ->
                    val vault = snapshot.vault
                    if (vault == null) {
                        SafeLog.w(TAG, "Skipping legacy snapshot for vault ${snapshot.vaultId} (metadata missing)")
                        failures += snapshot.vaultId
                        return@forEach
                    }

                    runCatching {
                        vaultDao.insert(vault)
                        if (snapshot.folders.isNotEmpty()) {
                            folderDao.insertAll(snapshot.folders)
                        }
                        if (snapshot.tags.isNotEmpty()) {
                            tagDao.insertAll(snapshot.tags)
                        }
                        if (snapshot.presets.isNotEmpty()) {
                            snapshot.presets.forEach { preset ->
                                presetDao.insert(preset)
                            }
                        }
                        if (snapshot.entries.isNotEmpty()) {
                            entryDao.insertAll(snapshot.entries)
                        }
                        if (snapshot.entryTags.isNotEmpty()) {
                            snapshot.entryTags.forEach { crossRef ->
                                tagDao.addTagToEntry(crossRef)
                            }
                        }
                        importedVaults += 1
                        importedEntries += snapshot.entries.size
                        successfulSnapshots += snapshot
                    }.onFailure { throwable ->
                        SafeLog.e(TAG, "Failed to import legacy vault ${snapshot.vaultId}", throwable)
                        failures += snapshot.vaultId
                    }
                }
            }
        } catch (throwable: Throwable) {
            SafeLog.e(TAG, "Legacy migration failed", throwable)
            migrationStateStore.markReauthenticationRequired(snapshots.map { it.vaultId })
            return@withContext LegacyMigrationResult.Failure("transaction_failed", throwable)
        }

        return@withContext when {
            failures.isEmpty() -> {
                legacyStore.secureWipe(successfulSnapshots)
                migrationStateStore.clearReauthenticationRequired()
                migrationStateStore.markMigrationCompleted()
                SafeLog.i(TAG, "Legacy migration completed: imported=$importedVaults vault(s), entries=$importedEntries")
                LegacyMigrationResult.Success(importedVaults, importedEntries)
            }
            failures.size == snapshots.size -> {
                migrationStateStore.markReauthenticationRequired(failures)
                SafeLog.w(TAG, "Legacy migration failed for all vaults; user re-authentication required")
                LegacyMigrationResult.Failure("all_vaults_failed")
            }
            else -> {
                legacyStore.secureWipe(successfulSnapshots)
                migrationStateStore.markReauthenticationRequired(failures)
                SafeLog.w(TAG, "Legacy migration partially completed; ${failures.size} vault(s) require re-authentication")
                LegacyMigrationResult.PartialSuccess(importedVaults, importedEntries, failures.toSet())
            }
        }
    }

    companion object {
        private const val TAG = "LegacyMigration"
    }
}

sealed class LegacyMigrationResult {
    object AlreadyMigrated : LegacyMigrationResult()
    object NoLegacyData : LegacyMigrationResult()
    data class Success(val importedVaults: Int, val importedEntries: Int) : LegacyMigrationResult()
    data class PartialSuccess(
        val importedVaults: Int,
        val importedEntries: Int,
        val failedVaultIds: Set<String>
    ) : LegacyMigrationResult()
    data class Failure(val reason: String, val cause: Throwable? = null) : LegacyMigrationResult()
}
