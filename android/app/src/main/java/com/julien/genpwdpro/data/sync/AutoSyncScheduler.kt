package com.julien.genpwdpro.data.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.WorkQuery
import androidx.work.WorkRequest
import androidx.work.getWorkInfosFlow
import androidx.work.workDataOf
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.data.sync.models.SyncInterval
import com.julien.genpwdpro.data.sync.workers.SyncWorker
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map

/**
 * Planificateur de synchronisation automatique
 *
 * Fonctionnalités:
 * - Programme le SyncWorker selon l'intervalle configuré
 * - Applique des contraintes (WiFi, batterie)
 * - Annule/reprend la sync automatique
 * - Gère la sync unique immédiate
 */
@Singleton
class AutoSyncScheduler @Inject constructor(
    @ApplicationContext private val context: Context,
    private val secretStore: AutoSyncSecretStore
) {

    private val workManager = WorkManager.getInstance(context)
    private val prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    /**
     * Programme la synchronisation automatique périodique
     *
     * @param vaultId ID du vault à synchroniser
     * @param masterPassword Mot de passe maître (stocké temporairement)
     * @param interval Intervalle de synchronisation
     * @param wifiOnly Synchroniser uniquement en WiFi
     */
    fun schedulePeriodicSync(
        vaultId: String,
        masterPassword: String,
        interval: SyncInterval = SyncInterval.HOURLY,
        wifiOnly: Boolean = true
    ): Boolean {
        val intervalMinutes = when (interval) {
            SyncInterval.MANUAL -> {
                SafeLog.w(TAG, "Ignoring periodic sync request for MANUAL interval")
                return false
            }
            SyncInterval.REALTIME -> {
                SafeLog.w(TAG, "Realtime auto-sync not yet supported")
                return false
            }
            SyncInterval.EVERY_15_MIN -> 15L
            SyncInterval.EVERY_30_MIN -> 30L
            SyncInterval.HOURLY -> 60L
            SyncInterval.DAILY -> 1440L
        }

        cancelPeriodicSync()

        if (!secretStore.persistSecret(vaultId, masterPassword)) {
            SafeLog.w(
                TAG,
                "Secret store unavailable; skipping periodic sync scheduling for ${SafeLog.redact(vaultId)}"
            )
            return false
        }

        // Créer les contraintes
        val constraints = Constraints.Builder()
            .apply {
                if (wifiOnly) {
                    setRequiredNetworkType(NetworkType.UNMETERED)
                } else {
                    setRequiredNetworkType(NetworkType.CONNECTED)
                }
            }
            .setRequiresBatteryNotLow(true) // Ne pas sync si batterie faible
            .build()

        val inputData = workDataOf(
            SyncWorker.KEY_VAULT_ID to vaultId,
            SyncWorker.KEY_CLEAR_SECRET to false
        )

        val schedulingResult = runCatching {
            val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(
                intervalMinutes,
                TimeUnit.MINUTES,
                15, // Flex interval de 15 minutes
                TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .setInputData(inputData)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    WorkRequest.MIN_BACKOFF_MILLIS,
                    TimeUnit.MILLISECONDS
                )
                .addTag(SyncWorker.WORK_NAME)
                .build()

            workManager.enqueueUniquePeriodicWork(
                SyncWorker.WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                syncRequest
            )

            rememberScheduledVault(vaultId)
            true
        }

        return schedulingResult.getOrElse { error ->
            SafeLog.e(
                TAG,
                "Failed to enqueue periodic sync for ${SafeLog.redact(vaultId)}",
                error
            )
            secretStore.clearSecret(vaultId)
            forgetScheduledVault()
            false
        }
    }

    /**
     * Programme une synchronisation unique immédiate
     *
     * @param vaultId ID du vault
     * @param masterPassword Mot de passe maître
     * @param wifiOnly Synchroniser uniquement en WiFi
     */
    fun scheduleOneTimeSync(
        vaultId: String,
        masterPassword: String,
        wifiOnly: Boolean = false
    ): Boolean {
        // Créer les contraintes
        val constraints = Constraints.Builder()
            .apply {
                if (wifiOnly) {
                    setRequiredNetworkType(NetworkType.UNMETERED)
                } else {
                    setRequiredNetworkType(NetworkType.CONNECTED)
                }
            }
            .build()

        if (!secretStore.persistSecret(vaultId, masterPassword)) {
            SafeLog.w(
                TAG,
                "Secret store unavailable; skipping one-time sync scheduling for ${SafeLog.redact(vaultId)}"
            )
            return false
        }

        val inputData = workDataOf(
            SyncWorker.KEY_VAULT_ID to vaultId,
            SyncWorker.KEY_CLEAR_SECRET to true
        )

        val schedulingResult = runCatching {
            val syncRequest = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(constraints)
                .setInputData(inputData)
                .addTag(SyncWorker.ONE_TIME_WORK_TAG)
                .build()

            workManager.enqueue(syncRequest)
            true
        }

        return schedulingResult.getOrElse { error ->
            SafeLog.e(
                TAG,
                "Failed to enqueue one-time sync for ${SafeLog.redact(vaultId)}",
                error
            )
            secretStore.clearSecret(vaultId)
            false
        }
    }

    /**
     * Annule la synchronisation automatique périodique
     */
    fun cancelPeriodicSync() {
        workManager.cancelUniqueWork(SyncWorker.WORK_NAME)
        forgetScheduledVault()?.let(secretStore::clearSecret)
    }

    /**
     * Annule toutes les synchronisations (périodiques et uniques)
     */
    fun cancelAllSync() {
        workManager.cancelAllWorkByTag(SyncWorker.WORK_NAME)
        workManager.cancelAllWorkByTag(SyncWorker.ONE_TIME_WORK_TAG)
        forgetScheduledVault()?.let(secretStore::clearSecret)
    }

    /**
     * Obtient l'info sur la synchronisation automatique
     */
    fun observePeriodicSync(): Flow<WorkInfo?> {
        val query = WorkQuery.Builder.fromUniqueWorkNames(listOf(SyncWorker.WORK_NAME)).build()
        return workManager.getWorkInfosFlow(query)
            .map { infos -> infos.firstOrNull() }
            .catch { error ->
                SafeLog.w(TAG, "Unable to observe periodic sync status", error)
                emit(null)
            }
    }

    private fun rememberScheduledVault(vaultId: String) {
        prefs.edit().putString(KEY_SCHEDULED_VAULT, vaultId).apply()
    }

    private fun forgetScheduledVault(): String? {
        val stored = prefs.getString(KEY_SCHEDULED_VAULT, null)
        prefs.edit().remove(KEY_SCHEDULED_VAULT).apply()
        return stored
    }
}

private const val PREF_NAME = "auto_sync_scheduler"
private const val KEY_SCHEDULED_VAULT = "scheduled_vault_id"
private const val TAG = "AutoSyncScheduler"
