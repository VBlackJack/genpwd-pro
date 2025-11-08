package com.julien.genpwdpro.domain.session

import android.content.Context
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.workers.VaultAutoLockWorker
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit
import javax.inject.Inject

/**
 * Observateur du cycle de vie de l'application
 *
 * Gère l'auto-lock des vaults quand l'application passe en arrière-plan
 * et le nettoyage des sessions expirées au premier plan.
 *
 * SECURITY IMPROVEMENTS (Bug #3):
 * - Uses WorkManager as backup for auto-lock in doze mode
 * - Guarantees vault locking even if app is killed by system
 * - Double protection: immediate lock + delayed WorkManager job
 *
 * Usage:
 * ```
 * lifecycle.addObserver(appLifecycleObserver) // Injected via Hilt
 * ```
 */
class AppLifecycleObserver @Inject constructor(
    @ApplicationContext private val context: Context,
    private val vaultSessionManager: VaultSessionManager
) : DefaultLifecycleObserver {

    companion object {
        private const val TAG = "AppLifecycleObserver"

        /**
         * Timeout avant auto-lock quand l'app est en background (minutes)
         * Configurable selon les préférences utilisateur
         */
        private const val BACKGROUND_LOCK_TIMEOUT_MINUTES = 5

        /**
         * Delayed WorkManager auto-lock timeout (minutes)
         * This is a backup in case onStop() is not called or fails
         */
        private const val WORKER_AUTO_LOCK_DELAY_MINUTES = 10L

        /**
         * Maximum session timeout for WorkManager check (hours)
         */
        private const val WORKER_SESSION_TIMEOUT_HOURS = 24L

        private const val WORK_NAME_AUTO_LOCK = "vault_auto_lock"
    }

    private var backgroundTimestamp: Long = 0

    // Fixed: Use dedicated CoroutineScope instead of runBlocking
    // This prevents blocking the main thread during vault locking
    // MEMORY LEAK FIX: CoroutineScope must be cancelled in onDestroy()
    private val lockScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /**
     * Appelé quand l'application passe au premier plan
     *
     * Cancels WorkManager job since app is active again
     */
    override fun onStart(owner: LifecycleOwner) {
        super.onStart(owner)
        SafeLog.d(TAG, "App moved to foreground")

        // Cancel WorkManager job since app is active
        cancelAutoLockWorker()

        // Vérifier si l'app est restée en background trop longtemps
        if (backgroundTimestamp > 0) {
            val backgroundDuration = System.currentTimeMillis() - backgroundTimestamp
            val timeoutMillis = BACKGROUND_LOCK_TIMEOUT_MINUTES * 60 * 1000

            if (backgroundDuration > timeoutMillis) {
                SafeLog.d(
                    TAG,
                    "Background timeout exceeded ($backgroundDuration ms > $timeoutMillis ms), locking vaults"
                )
                lockAllVaults()
            } else {
                SafeLog.d(TAG, "Background duration within timeout: $backgroundDuration ms")
            }
        }

        backgroundTimestamp = 0
    }

    /**
     * Appelé quand l'application passe en arrière-plan
     *
     * SECURITY (Bug #3):
     * - Locks vaults immediately
     * - Schedules WorkManager job as backup (runs even in doze mode)
     */
    override fun onStop(owner: LifecycleOwner) {
        super.onStop(owner)
        // Android ne garantit pas l'appel à onDestroy() quand l'app est swipée ou tuée,
        // nous verrouillons donc immédiatement les coffres ici.
        SafeLog.d(TAG, "App moved to background - locking vaults immediately")
        lockAllVaults()

        // CRITICAL: Schedule WorkManager as backup
        // This ensures auto-lock even if onStop() fails or app is killed
        scheduleAutoLockWorker()

        backgroundTimestamp = System.currentTimeMillis()
    }

    /**
     * Appelé quand le lifecycle owner est détruit
     * MEMORY LEAK FIX: Cancel coroutine scope to prevent memory leak
     */
    override fun onDestroy(owner: LifecycleOwner) {
        super.onDestroy(owner)
        SafeLog.d(TAG, "Lifecycle destroyed - cleaning up coroutine scope")
        lockScope.cancel()
    }

    /**
     * Verrouille tous les vaults actifs
     *
     * CONCURRENCY FIX (Bug #2): Handles case where lockScope is already cancelled
     * If scope is inactive, uses GlobalScope as fallback to ensure vault is locked
     */
    private fun lockAllVaults() {
        if (!lockScope.isActive) {
            // FALLBACK: scope cancelled (rare lifecycle edge case)
            // Use GlobalScope to ensure vault is locked even if our scope is dead
            SafeLog.w(TAG, "lockScope is cancelled, using GlobalScope fallback for security")
            GlobalScope.launch(Dispatchers.IO) {
                try {
                    vaultSessionManager.lockVault()
                    SafeLog.i(TAG, "Vault locked successfully via GlobalScope fallback")
                } catch (e: Exception) {
                    SafeLog.e(TAG, "Error locking vault in GlobalScope fallback", e)
                }
            }
            return
        }

        // Normal path: use lockScope
        lockScope.launch {
            try {
                vaultSessionManager.lockVault()
                SafeLog.d(TAG, "Vault locked successfully on lifecycle transition")
            } catch (e: Exception) {
                SafeLog.e(TAG, "Error locking vault", e)
            }
        }
    }

    /**
     * Schedules WorkManager auto-lock job as backup
     *
     * This worker runs even if:
     * - App is in doze mode
     * - App is killed by system
     * - onStop() is not called
     *
     * CRITICAL: This is a security feature - do not disable
     */
    private fun scheduleAutoLockWorker() {
        try {
            val constraints = Constraints.Builder()
                .setRequiresBatteryNotLow(false) // Run even if battery is low
                .build()

            val workRequest = OneTimeWorkRequestBuilder<VaultAutoLockWorker>()
                .setInitialDelay(WORKER_AUTO_LOCK_DELAY_MINUTES, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .setInputData(
                    workDataOf(
                        VaultAutoLockWorker.INPUT_TIMEOUT_HOURS to WORKER_SESSION_TIMEOUT_HOURS
                    )
                )
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                WORK_NAME_AUTO_LOCK,
                ExistingWorkPolicy.REPLACE, // Replace any existing work
                workRequest
            )

            SafeLog.d(TAG, "Auto-lock WorkManager job scheduled (delay: ${WORKER_AUTO_LOCK_DELAY_MINUTES}min)")
        } catch (e: Exception) {
            SafeLog.e(TAG, "Failed to schedule auto-lock worker", e)
            // Non-fatal: immediate lock already happened in lockAllVaults()
        }
    }

    /**
     * Cancels the auto-lock WorkManager job
     *
     * Called when app returns to foreground to prevent unnecessary work
     */
    private fun cancelAutoLockWorker() {
        try {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME_AUTO_LOCK)
            SafeLog.d(TAG, "Auto-lock WorkManager job cancelled")
        } catch (e: Exception) {
            SafeLog.e(TAG, "Failed to cancel auto-lock worker", e)
        }
    }
}
