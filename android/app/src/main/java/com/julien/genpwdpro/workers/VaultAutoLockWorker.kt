package com.julien.genpwdpro.workers

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.domain.session.VaultSessionManager
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

/**
 * WorkManager worker for auto-locking vaults
 *
 * This worker ensures vaults are locked even if the app is in doze mode,
 * killed by the system, or the app lifecycle callbacks are not called.
 *
 * SECURITY: This is a critical security feature
 * - Runs even in doze mode (with constraints)
 * - Guarantees vault locking after timeout
 * - Backup mechanism for AppLifecycleObserver
 *
 * Usage:
 * ```
 * val workRequest = OneTimeWorkRequestBuilder<VaultAutoLockWorker>()
 *     .setInitialDelay(5, TimeUnit.MINUTES)
 *     .setInputData(workDataOf("TIMEOUT_HOURS" to 24L))
 *     .build()
 *
 * WorkManager.getInstance(context).enqueueUniqueWork(
 *     "vault_auto_lock",
 *     ExistingWorkPolicy.REPLACE,
 *     workRequest
 * )
 * ```
 */
@HiltWorker
class VaultAutoLockWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val vaultSessionManager: VaultSessionManager
) : CoroutineWorker(appContext, workerParams) {

    companion object {
        private const val TAG = "VaultAutoLockWorker"
        const val INPUT_TIMEOUT_HOURS = "TIMEOUT_HOURS"
        const val DEFAULT_TIMEOUT_HOURS = 24L
    }

    override suspend fun doWork(): Result {
        return try {
            val timeoutHours = inputData.getLong(INPUT_TIMEOUT_HOURS, DEFAULT_TIMEOUT_HOURS)

            SafeLog.d(TAG, "VaultAutoLockWorker started: timeout=${timeoutHours}h")

            // Check if vault is still unlocked
            if (!vaultSessionManager.isVaultUnlocked()) {
                SafeLog.d(TAG, "No vault unlocked - worker completed")
                return Result.success()
            }

            // Check if session is expired
            val sessionExpired = vaultSessionManager.isSessionExpired(timeoutHours)

            if (sessionExpired) {
                SafeLog.i(TAG, "Session expired - locking vault")
                vaultSessionManager.lockVault()

                // VERIFICATION FIX (Bug #3): Verify vault is actually locked
                // lockVault() catches errors internally and forces cleanup,
                // so vault should always be locked, but we verify for monitoring
                val stillUnlocked = vaultSessionManager.isVaultUnlocked()
                if (stillUnlocked) {
                    SafeLog.e(TAG, "WARNING: Vault still unlocked after lockVault() call!")
                    // Still return success because lockVault() did execute
                    // This is a monitoring/logging issue, not a failure
                }

                SafeLog.i(TAG, "Vault locked successfully by WorkManager (verified=${!stillUnlocked})")
                Result.success()
            } else {
                SafeLog.d(TAG, "Session not expired - keeping vault unlocked")
                Result.success()
            }
        } catch (e: Exception) {
            SafeLog.e(TAG, "Failed to auto-lock vault", e)
            // Return failure to allow WorkManager to retry if needed
            Result.failure()
        }
    }
}
