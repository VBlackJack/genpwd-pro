package com.julien.genpwdpro.workers

import android.content.Context
import com.julien.genpwdpro.core.log.SafeLog
import androidx.hilt.work.HiltWorker
import androidx.work.*
import com.julien.genpwdpro.data.local.preferences.SettingsDataStore
import com.julien.genpwdpro.data.sync.SyncManager
import com.julien.genpwdpro.data.sync.SyncResult
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.flow.first

/**
 * Worker WorkManager dédié à la synchronisation des paramètres applicatifs
 * (préférences, configuration, politiques de génération).
 *
 * Il fonctionne en parallèle de [com.julien.genpwdpro.data.sync.workers.SyncWorker]
 * qui gère, lui, la synchronisation des coffres chiffrés. Les deux workers sont
 * planifiés séparément afin d'éviter qu'une tâche lourde sur les vaults bloque
 * la propagation des paramètres.
 */
@HiltWorker
class CloudSyncWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val syncManager: SyncManager
) : CoroutineWorker(appContext, workerParams) {

    companion object {
        private const val TAG = "CloudSyncWorker"
        const val WORK_NAME = "cloud_sync_periodic"

        // Work tags
        const val TAG_SYNC = "sync"
        const val TAG_PERIODIC = "periodic"

        /**
         * Planifie la synchronisation automatique
         *
         * @param context Context de l'application
         * @param intervalMillis Intervalle entre les syncs (en millisecondes)
         * @param wifiOnly Si true, sync uniquement sur WiFi
         */
        fun schedule(
            context: Context,
            intervalMillis: Long,
            wifiOnly: Boolean = true
        ) {
            SafeLog.d(TAG, "Scheduling periodic sync: interval=$intervalMillis ms, wifiOnly=$wifiOnly")

            // Contraintes
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(
                    if (wifiOnly) NetworkType.UNMETERED else NetworkType.CONNECTED
                )
                .setRequiresBatteryNotLow(true) // Ne pas épuiser la batterie
                .build()

            // Convertir millisecondes en minutes (minimum 15 minutes pour PeriodicWorkRequest)
            val intervalMinutes = (intervalMillis / 60000).coerceAtLeast(15)

            // Créer la requête périodique
            val syncWorkRequest = PeriodicWorkRequestBuilder<CloudSyncWorker>(
                intervalMinutes,
                TimeUnit.MINUTES,
                // Flex interval: 5 minutes de flexibilité
                5,
                TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    WorkRequest.MIN_BACKOFF_MILLIS,
                    TimeUnit.MILLISECONDS
                )
                .addTag(TAG_SYNC)
                .addTag(TAG_PERIODIC)
                .build()

            // Planifier (remplace l'ancien si existe)
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(
                    WORK_NAME,
                    ExistingPeriodicWorkPolicy.UPDATE,
                    syncWorkRequest
                )

            SafeLog.i(TAG, "Periodic sync scheduled successfully: every $intervalMinutes minutes")
        }

        /**
         * Annule la synchronisation automatique
         */
        fun cancel(context: Context) {
            SafeLog.d(TAG, "Cancelling periodic sync")
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }

        /**
         * Déclenche une synchronisation immédiate (one-time)
         */
        fun syncNow(context: Context, wifiOnly: Boolean = false) {
            SafeLog.d(TAG, "Triggering immediate sync")

            val constraints = Constraints.Builder()
                .setRequiredNetworkType(
                    if (wifiOnly) NetworkType.UNMETERED else NetworkType.CONNECTED
                )
                .build()

            val syncWorkRequest = OneTimeWorkRequestBuilder<CloudSyncWorker>()
                .setConstraints(constraints)
                .addTag(TAG_SYNC)
                .build()

            WorkManager.getInstance(context).enqueue(syncWorkRequest)
        }
    }

    /**
     * Exécute la synchronisation
     */
    override suspend fun doWork(): Result {
        SafeLog.d(TAG, "Starting background sync...")

        return try {
            // Initialiser SyncManager
            syncManager.initialize()

            // Récupérer les paramètres actuels
            val settingsDataStore = SettingsDataStore(applicationContext)
            val currentSettings = settingsDataStore.settingsFlow.first()

            // Effectuer la synchronisation complète
            val syncResult = syncManager.performFullSync(currentSettings)

            when (syncResult) {
                is SyncResult.Success -> {
                    SafeLog.i(TAG, "Background sync successful")
                    Result.success()
                }
                is SyncResult.Conflict -> {
                    SafeLog.w(TAG, "Conflict detected during background sync, auto-resolving...")

                    // Auto-résoudre avec NEWEST_WINS
                    val resolved = syncManager.resolveConflict(
                        conflict = syncResult,
                        strategy = com.julien.genpwdpro.data.sync.ConflictResolutionStrategy.NEWEST_WINS
                    )

                    // Appliquer les paramètres résolus si c'est la version distante
                    if (resolved == syncResult.remoteData) {
                        val remoteSettings = syncManager.downloadSettings()
                        if (remoteSettings != null) {
                            settingsDataStore.saveSettings(remoteSettings)
                            SafeLog.d(TAG, "Applied remote settings after conflict resolution")
                        }
                    }

                    SafeLog.i(TAG, "Background sync successful (conflict resolved)")
                    Result.success()
                }
                is SyncResult.Error -> {
                    SafeLog.e(TAG, "Background sync failed: ${syncResult.message}")

                    // Retry si c'est une erreur réseau temporaire
                    if (isRetryableError(syncResult.message)) {
                        SafeLog.d(TAG, "Error is retryable, will retry later")
                        Result.retry()
                    } else {
                        SafeLog.d(TAG, "Error is not retryable, giving up")
                        Result.failure()
                    }
                }
            }
        } catch (e: Exception) {
            SafeLog.e(TAG, "Background sync crashed", e)

            // Retry en cas d'exception
            if (runAttemptCount < 3) {
                SafeLog.d(TAG, "Attempt $runAttemptCount, will retry")
                Result.retry()
            } else {
                SafeLog.e(TAG, "Max retry attempts reached, giving up")
                Result.failure()
            }
        }
    }

    /**
     * Détermine si une erreur justifie un retry
     */
    private fun isRetryableError(message: String): Boolean {
        val retryableKeywords = listOf(
            "network",
            "timeout",
            "connection",
            "unreachable",
            "unavailable"
        )

        val lowerMessage = message.lowercase()
        return retryableKeywords.any { lowerMessage.contains(it) }
    }
}
