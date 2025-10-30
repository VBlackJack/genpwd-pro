package com.julien.genpwdpro.data.inmemory

import android.content.Context
import androidx.room.withTransaction
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

/**
 * Coordinates the one-off data migration from the legacy in-memory/cache representation
 * to the encrypted SQLCipher Room database. The migration runs exactly once after the
 * application has been upgraded to the SQLCipher build.
 */
@Singleton
class LegacyMigrationDaos @Inject constructor(
    val vaultDao: VaultDao,
    val entryDao: VaultEntryDao,
    val folderDao: FolderDao,
    val tagDao: TagDao,
    val presetDao: PresetDao
)

@Singleton
class LegacyInMemoryMigrationManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val appDatabase: AppDatabase,
    private val daos: LegacyMigrationDaos,
    private val legacyStore: LegacyInMemoryStore,
    private val migrationStateStore: LegacyMigrationStateStore
) {

    suspend fun migrateIfNeeded(): LegacyMigrationResult = withContext(Dispatchers.IO) {
        resolvePreMigrationOutcome()?.let { return@withContext it }

        val snapshots = legacyStore.loadSnapshots()
        if (snapshots.isEmpty()) {
            migrationStateStore.markMigrationCompleted()
            SafeLog.d(TAG, "No legacy snapshots detected; nothing to migrate")
            return@withContext LegacyMigrationResult.NoLegacyData
        }

        performMigration(snapshots)
    }

    private fun resolvePreMigrationOutcome(): LegacyMigrationResult? {
        if (migrationStateStore.isMigrationCompleted()) {
            SafeLog.d(TAG, "Legacy migration already completed")
            return LegacyMigrationResult.AlreadyMigrated
        }

        val databasePresent = context
            .getDatabasePath(AppDatabase.DATABASE_NAME)
            ?.let { it.exists() && it.length() > 0L } == true
        if (databasePresent && !legacyStore.hasLegacyState()) {
            migrationStateStore.markMigrationCompleted()
            SafeLog.d(
                TAG,
                "SQLCipher database detected and no legacy cache found; marking migration as complete"
            )
            return LegacyMigrationResult.AlreadyMigrated
        }
        return null
    }

    private suspend fun performMigration(
        snapshots: List<LegacyVaultSnapshot>
    ): LegacyMigrationResult {
        val accumulator = MigrationAccumulator()
        try {
            appDatabase.withTransaction {
                snapshots.forEach { snapshot ->
                    importSnapshot(snapshot, accumulator)
                }
            }
        } catch (exception: Exception) {
            SafeLog.e(TAG, "Legacy migration failed", exception)
            migrationStateStore.markReauthenticationRequired(snapshots.map { it.vaultId })
            return LegacyMigrationResult.Failure("transaction_failed", exception)
        }

        return accumulator.buildResult(snapshots)
    }

    private suspend fun importSnapshot(
        snapshot: LegacyVaultSnapshot,
        accumulator: MigrationAccumulator
    ) {
        val vault = snapshot.vault
        if (vault == null) {
            SafeLog.w(
                TAG,
                "Skipping legacy snapshot for vault ${snapshot.vaultId} (metadata missing)"
            )
            accumulator.recordFailure(snapshot.vaultId)
            return
        }

        runCatching {
            daos.vaultDao.insert(vault)
            if (snapshot.folders.isNotEmpty()) {
                daos.folderDao.insertAll(snapshot.folders)
            }
            if (snapshot.tags.isNotEmpty()) {
                daos.tagDao.insertAll(snapshot.tags)
            }
            if (snapshot.presets.isNotEmpty()) {
                snapshot.presets.forEach { preset ->
                    daos.presetDao.insert(preset)
                }
            }
            if (snapshot.entries.isNotEmpty()) {
                daos.entryDao.insertAll(snapshot.entries)
            }
            if (snapshot.entryTags.isNotEmpty()) {
                snapshot.entryTags.forEach { crossRef ->
                    daos.tagDao.addTagToEntry(crossRef)
                }
            }
        }.onSuccess {
            accumulator.recordSuccess(snapshot)
        }.onFailure { throwable ->
            SafeLog.e(
                TAG,
                "Failed to import legacy vault ${snapshot.vaultId}",
                throwable
            )
            accumulator.recordFailure(snapshot.vaultId)
        }
    }

    private fun MigrationAccumulator.buildResult(
        allSnapshots: List<LegacyVaultSnapshot>
    ): LegacyMigrationResult {
        return when {
            failures.isEmpty() -> {
                legacyStore.secureWipe(successfulSnapshots)
                migrationStateStore.clearReauthenticationRequired()
                migrationStateStore.markMigrationCompleted()
                SafeLog.i(
                    TAG,
                    "Legacy migration completed: imported=$importedVaults vault(s), entries=$importedEntries"
                )
                LegacyMigrationResult.Success(importedVaults, importedEntries)
            }
            failures.size == allSnapshots.size -> {
                migrationStateStore.markReauthenticationRequired(failures)
                SafeLog.w(
                    TAG,
                    "Legacy migration failed for all vaults; user re-authentication required"
                )
                LegacyMigrationResult.Failure("all_vaults_failed")
            }
            else -> {
                legacyStore.secureWipe(successfulSnapshots)
                migrationStateStore.markReauthenticationRequired(failures)
                SafeLog.w(
                    TAG,
                    "Legacy migration partially completed; ${failures.size} vault(s) require re-authentication"
                )
                LegacyMigrationResult.PartialSuccess(
                    importedVaults,
                    importedEntries,
                    failures.toSet()
                )
            }
        }
    }

    private class MigrationAccumulator {
        val failures = mutableListOf<String>()
        val successfulSnapshots = mutableListOf<LegacyVaultSnapshot>()
        var importedVaults: Int = 0
        var importedEntries: Int = 0

        fun recordSuccess(snapshot: LegacyVaultSnapshot) {
            importedVaults += 1
            importedEntries += snapshot.entries.size
            successfulSnapshots += snapshot
        }

        fun recordFailure(vaultId: String) {
            failures += vaultId
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
