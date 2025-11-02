package com.julien.genpwdpro.data.sync.workers

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.data.sync.AutoSyncSecretStore
import com.julien.genpwdpro.data.sync.VaultSyncManager
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

/**
 * Worker WorkManager responsable de la synchronisation des coffres chiffrés.
 *
 * Cette tâche de fond s'exécute uniquement pour synchroniser le contenu des vaults
 * (fichiers, entrées, pièces jointes) lorsque un fournisseur cloud et un mot de
 * passe maître sont disponibles. Elle complète [com.julien.genpwdpro.workers.CloudSyncWorker],
 * chargé quant à lui de la synchronisation des paramètres applicatifs.
 *
 * Fonctionnalités :
 * - Synchronisation périodique des coffres via [VaultSyncManager]
 * - Vérification et réhydratation du provider avant chaque exécution
 * - Respect des contraintes réseau (Wi-Fi uniquement par défaut)
 * - Politique de retry limitée pour les erreurs transitoires
 */
@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val vaultSyncManager: VaultSyncManager,
    private val secretStore: AutoSyncSecretStore
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "SyncWorker"
        const val WORK_NAME = "vault_auto_sync"
        const val ONE_TIME_WORK_TAG = "vault_one_time_sync"

        // Paramètres du worker
        const val KEY_VAULT_ID = "vault_id"
        const val KEY_CLEAR_SECRET = "clear_secret"
    }

    override suspend fun doWork(): Result {
        SafeLog.d(TAG, "Starting background sync")

        return try {
            val providerReady = vaultSyncManager.rehydrateActiveProvider()
            if (!providerReady) {
                SafeLog.w(TAG, "No active provider configured, skipping sync")
                return Result.success()
            }

            // Vérifier si le provider est authentifié
            if (!vaultSyncManager.isAuthenticated()) {
                SafeLog.w(TAG, "Provider not authenticated, skipping sync")
                return Result.success()
            }

            // Récupérer les paramètres
            val vaultId = inputData.getString(KEY_VAULT_ID)
            val clearSecret = inputData.getBoolean(KEY_CLEAR_SECRET, false)

            if (vaultId == null) {
                SafeLog.e(TAG, "Missing vault ID for background sync")
                return Result.failure()
            }

            if (!secretStore.canAccessSecrets()) {
                SafeLog.w(TAG, "Secure storage unavailable, retrying later")
                return Result.retry()
            }

            val masterPassword = secretStore.getSecret(vaultId)

            if (masterPassword == null) {
                SafeLog.e(
                    TAG,
                    "Master password unavailable for vault ${SafeLog.redact(vaultId)}"
                )
                return Result.failure()
            }

            // Synchroniser le vault
            val result = vaultSyncManager.syncVault(vaultId, masterPassword)

            val outcome = when (result) {
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
            if (clearSecret) {
                when (outcome) {
                    is Result.Success, is Result.Failure -> secretStore.clearSecret(vaultId)
                    is Result.Retry -> Unit
                }
            }
            outcome
        } catch (e: Exception) {
            SafeLog.e(TAG, "Unexpected error during sync", e)

            // Retry en cas d'erreur inattendue
            val outcome = if (runAttemptCount < 3) {
                Result.retry()
            } else {
                Result.failure()
            }
            if (clearSecret && outcome is Result.Failure) {
                secretStore.clearSecret(vaultId)
            }
            outcome
        }
    }
}
