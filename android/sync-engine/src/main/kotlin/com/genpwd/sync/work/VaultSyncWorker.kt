package com.genpwd.sync.work

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.WorkerParameters
import com.genpwd.corevault.ProviderKind
import com.genpwd.sync.BuildConfig
import com.genpwd.corevault.VaultId
import com.genpwd.sync.MasterPasswordProvider
import com.genpwd.sync.VaultSyncManager
import com.genpwd.sync.SyncOutcome
import com.genpwd.storage.VaultStorageRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@HiltWorker
class VaultSyncWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val vaultSyncManager: VaultSyncManager,
    private val storageRepository: VaultStorageRepository,
    private val masterPasswordProvider: MasterPasswordProvider,
) : CoroutineWorker(appContext, workerParams) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val accountId = inputData.getString(KEY_ACCOUNT_ID).orEmpty()
        val providerKind = inputData.getString(KEY_PROVIDER_KIND)?.let { ProviderKind.valueOf(it) }
            ?: return@withContext Result.failure()
        val remotePath = inputData.getString(KEY_REMOTE_PATH).orEmpty()
        val masterAlias = inputData.getString(KEY_MASTER_ALIAS)

        val vaultId = VaultId(remotePath = remotePath, provider = providerKind, accountId = accountId)
        val account = storageRepository.getAccount(providerKind, accountId)
            ?: return@withContext Result.retry()
        val vaultMeta = storageRepository.getVaultMeta(vaultId) ?: return@withContext Result.retry()
        val masterPassword = masterPasswordProvider.obtainMasterPassword(vaultId, masterAlias)
            ?: return@withContext Result.retry()

        return@withContext try {
            when (val outcome = vaultSyncManager.syncVault(account, vaultMeta, masterPassword)) {
                is SyncOutcome.Success -> Result.success()
                is SyncOutcome.Conflict -> Result.failure(conflictData(outcome))
                is SyncOutcome.Error -> Result.retry()
            }
        } catch (error: Exception) {
            // SECURITY: Only log in debug builds, and don't expose vault path
            if (BuildConfig.DEBUG) {
                Log.e(TAG, "Sync failed", error)
            }
            Result.retry()
        } finally {
            masterPassword.fill('*')
        }
    }

    private fun conflictData(outcome: SyncOutcome.Conflict): Data =
        Data.Builder()
            .putInt(KEY_CONFLICT_COUNT, outcome.conflicts.size)
            .build()

    private fun CharArray.fill(value: Char) {
        for (i in indices) this[i] = value
    }

    companion object {
        const val KEY_ACCOUNT_ID = "account_id"
        const val KEY_PROVIDER_KIND = "provider_kind"
        const val KEY_REMOTE_PATH = "remote_path"
        const val KEY_MASTER_ALIAS = "master_alias"
        const val KEY_CONFLICT_COUNT = "conflict_count"
        private const val TAG = "VaultSyncWorker"
    }
}
