package com.julien.genpwdpro.data.sync.workers

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.julien.genpwdpro.data.sync.VaultSyncManager
import com.julien.genpwdpro.core.log.SafeLog
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

/**
 * Worker pour la synchronisation automatique en arrière-plan
 *
 * Fonctionnalités:
 * - Synchronisation périodique des vaults
 * - Respect des contraintes réseau (WiFi uniquement)
 * - Gestion de la batterie
 * - Retry automatique en cas d'échec
 *
 * Planification:
 * - Utilise WorkManager pour la planification
 * - S'exécute selon l'intervalle configuré
 * - Respecte les politiques d'économie d'énergie d'Android
 */
@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val vaultSyncManager: VaultSyncManager
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "SyncWorker"
        const val WORK_NAME = "vault_auto_sync"
        const val ONE_TIME_WORK_TAG = "vault_one_time_sync"

        // Paramètres du worker
        const val KEY_VAULT_ID = "vault_id"
        const val KEY_MASTER_PASSWORD = "master_password"
    }

    override suspend fun doWork(): Result {
        SafeLog.d(TAG, "Starting background sync")

        return try {
            // Vérifier si le provider est authentifié
            if (!vaultSyncManager.isAuthenticated()) {
                SafeLog.w(TAG, "Provider not authenticated, skipping sync")
                return Result.success()
            }

            // Récupérer les paramètres
            val vaultId = inputData.getString(KEY_VAULT_ID)
            val masterPassword = inputData.getString(KEY_MASTER_PASSWORD)

            if (vaultId == null || masterPassword == null) {
                SafeLog.e(TAG, "Missing vault ID or master password")
                return Result.failure()
            }

            // Synchroniser le vault
            val result = vaultSyncManager.syncVault(vaultId, masterPassword)

            when (result) {
                is com.julien.genpwdpro.data.sync.models.SyncResult.Success -> {
                    SafeLog.d(TAG, "Sync completed successfully")
                    Result.success()
                }
                is com.julien.genpwdpro.data.sync.models.SyncResult.Error -> {
                    SafeLog.e(TAG, "Sync failed: ${result.message}")
                    // Retry en cas d'erreur
                    if (runAttemptCount < 3) {
                        Result.retry()
                    } else {
                        Result.failure()
                    }
                }
                is com.julien.genpwdpro.data.sync.models.SyncResult.Conflict -> {
                    SafeLog.w(TAG, "Conflict detected, manual resolution required")
                    // Ne pas retry en cas de conflit
                    Result.failure()
                }
            }
        } catch (e: Exception) {
            SafeLog.e(TAG, "Unexpected error during sync", e)

            // Retry en cas d'erreur inattendue
            if (runAttemptCount < 3) {
                Result.retry()
            } else {
                Result.failure()
            }
        }
    }
}
