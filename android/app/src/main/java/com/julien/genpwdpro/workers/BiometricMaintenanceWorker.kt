package com.julien.genpwdpro.workers

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkRequest
import androidx.work.WorkerParameters
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.domain.session.BiometricRotationEvent
import com.julien.genpwdpro.domain.session.VaultSessionManager
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.util.concurrent.TimeUnit

/**
 * WorkManager worker for biometric key maintenance tasks.
 *
 * This worker runs daily to check if any biometric keys need rotation.
 * Biometric keys should be rotated every 90 days for security best practices.
 *
 * SECURITY: This is a proactive security feature that:
 * - Checks if biometric key age exceeds rotation threshold (90 days)
 * - Emits an event to prompt the user to confirm their Master Password
 * - The actual key rotation happens after user confirmation in the UI
 *
 * Note: This worker only checks and notifies. It does NOT perform the rotation
 * automatically because rotation requires the Master Password which we don't store.
 *
 * Usage:
 * ```kotlin
 * // Schedule daily check (call once on app start)
 * BiometricMaintenanceWorker.schedule(context)
 *
 * // Cancel scheduled checks
 * BiometricMaintenanceWorker.cancel(context)
 * ```
 */
@HiltWorker
class BiometricMaintenanceWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val vaultSessionManager: VaultSessionManager
) : CoroutineWorker(appContext, workerParams) {

    companion object {
        private const val TAG = "BiometricMaintenanceWorker"
        const val WORK_NAME = "biometric_maintenance_daily"

        // Work tags for filtering/querying
        const val TAG_BIOMETRIC = "biometric"
        const val TAG_MAINTENANCE = "maintenance"
        const val TAG_DAILY = "daily"

        // Run once per day
        private const val REPEAT_INTERVAL_HOURS = 24L

        // Flex interval: 2 hours flexibility for battery optimization
        private const val FLEX_INTERVAL_HOURS = 2L

        /**
         * Schedules the daily biometric maintenance check.
         *
         * This should be called once during app initialization.
         * Uses [ExistingPeriodicWorkPolicy.KEEP] to avoid rescheduling
         * if the work already exists.
         *
         * @param context Application context
         */
        fun schedule(context: Context) {
            SafeLog.d(TAG, "Scheduling daily biometric maintenance check")

            // Light constraints - this is a simple check, not network-bound
            val constraints = Constraints.Builder()
                .setRequiresBatteryNotLow(true) // Don't run when battery is critically low
                .build()

            val maintenanceWorkRequest = PeriodicWorkRequestBuilder<BiometricMaintenanceWorker>(
                REPEAT_INTERVAL_HOURS,
                TimeUnit.HOURS,
                FLEX_INTERVAL_HOURS,
                TimeUnit.HOURS
            )
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.LINEAR,
                    WorkRequest.MIN_BACKOFF_MILLIS,
                    TimeUnit.MILLISECONDS
                )
                .addTag(TAG_BIOMETRIC)
                .addTag(TAG_MAINTENANCE)
                .addTag(TAG_DAILY)
                .build()

            // Use KEEP policy - don't reschedule if already scheduled
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(
                    WORK_NAME,
                    ExistingPeriodicWorkPolicy.KEEP,
                    maintenanceWorkRequest
                )

            SafeLog.i(TAG, "Biometric maintenance check scheduled: every $REPEAT_INTERVAL_HOURS hours")
        }

        /**
         * Cancels the scheduled biometric maintenance checks.
         *
         * @param context Application context
         */
        fun cancel(context: Context) {
            SafeLog.d(TAG, "Cancelling biometric maintenance checks")
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }

        /**
         * Checks if the maintenance worker is currently scheduled.
         *
         * @param context Application context
         * @return True if worker is scheduled
         */
        suspend fun isScheduled(context: Context): Boolean {
            return try {
                val workInfos = WorkManager.getInstance(context)
                    .getWorkInfosForUniqueWork(WORK_NAME)
                    .get()

                workInfos.any { !it.state.isFinished }
            } catch (e: Exception) {
                SafeLog.e(TAG, "Failed to check if worker is scheduled", e)
                false
            }
        }
    }

    override suspend fun doWork(): Result {
        SafeLog.d(TAG, "Starting biometric maintenance check...")

        return try {
            // Check if a vault is currently unlocked
            if (!vaultSessionManager.isVaultUnlocked()) {
                SafeLog.d(TAG, "No vault unlocked - skipping biometric key check")
                return Result.success()
            }

            val vaultId = vaultSessionManager.getCurrentVaultId()
            if (vaultId == null) {
                SafeLog.d(TAG, "No active vault ID - skipping biometric key check")
                return Result.success()
            }

            // Check if biometric key needs rotation
            val shouldRotate = vaultSessionManager.shouldRotateBiometricKey()

            if (shouldRotate) {
                SafeLog.i(TAG, "Biometric key rotation needed for vault: ${SafeLog.redact(vaultId)}")

                // Emit event to notify UI that rotation is needed
                // The UI will prompt the user to enter their Master Password
                vaultSessionManager.emitBiometricRotationEvent(
                    BiometricRotationEvent.RotationNeeded(
                        vaultId = vaultId,
                        reason = "Biometric key is older than 90 days"
                    )
                )

                SafeLog.i(TAG, "Biometric rotation event emitted - awaiting user confirmation")
            } else {
                SafeLog.d(TAG, "Biometric key is up to date - no rotation needed")
            }

            Result.success()
        } catch (e: Exception) {
            SafeLog.e(TAG, "Biometric maintenance check failed", e)

            // Non-critical failure - retry on next scheduled run
            // Don't use Result.retry() to avoid excessive retries
            Result.success()
        }
    }
}
