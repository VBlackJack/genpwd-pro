package com.julien.genpwdpro.data.sync

import android.content.Context
import androidx.work.*
import com.julien.genpwdpro.data.sync.models.SyncInterval
import com.julien.genpwdpro.data.sync.workers.SyncWorker
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

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
    @ApplicationContext private val context: Context
) {

    private val workManager = WorkManager.getInstance(context)

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
    ) {
        // Annuler la sync précédente si elle existe
        cancelPeriodicSync()

        // Convertir l'intervalle en millisecondes
        val intervalMillis = when (interval) {
            SyncInterval.MANUAL -> return // Pas de sync automatique
            SyncInterval.REALTIME -> return // TODO: Implémenter observer temps réel
            SyncInterval.EVERY_15_MIN -> 15L
            SyncInterval.EVERY_30_MIN -> 30L
            SyncInterval.HOURLY -> 60L
            SyncInterval.DAILY -> 1440L
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

        // Créer les données d'entrée
        val inputData = workDataOf(
            SyncWorker.KEY_VAULT_ID to vaultId,
            SyncWorker.KEY_MASTER_PASSWORD to masterPassword
        )

        // Créer la requête de travail périodique
        val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(
            intervalMillis,
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

        // Enregistrer le travail
        workManager.enqueueUniquePeriodicWork(
            SyncWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            syncRequest
        )
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
    ) {
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

        // Créer les données d'entrée
        val inputData = workDataOf(
            SyncWorker.KEY_VAULT_ID to vaultId,
            SyncWorker.KEY_MASTER_PASSWORD to masterPassword
        )

        // Créer la requête de travail unique
        val syncRequest = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(constraints)
            .setInputData(inputData)
            .addTag(SyncWorker.ONE_TIME_WORK_TAG)
            .build()

        // Enregistrer le travail
        workManager.enqueue(syncRequest)
    }

    /**
     * Annule la synchronisation automatique périodique
     */
    fun cancelPeriodicSync() {
        workManager.cancelUniqueWork(SyncWorker.WORK_NAME)
    }

    /**
     * Annule toutes les synchronisations (périodiques et uniques)
     */
    fun cancelAllSync() {
        workManager.cancelAllWorkByTag(SyncWorker.WORK_NAME)
        workManager.cancelAllWorkByTag(SyncWorker.ONE_TIME_WORK_TAG)
    }

    /**
     * Obtient l'info sur la synchronisation automatique
     */
    fun getSyncInfo(): WorkInfo? {
        val workInfos = workManager.getWorkInfosForUniqueWork(SyncWorker.WORK_NAME).get()
        return workInfos.firstOrNull()
    }
}
