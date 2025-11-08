package com.julien.genpwdpro.domain.session

import com.julien.genpwdpro.core.log.SafeLog
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Observateur du cycle de vie de l'application
 *
 * Gère l'auto-lock des vaults quand l'application passe en arrière-plan
 * et le nettoyage des sessions expirées au premier plan.
 *
 * Usage:
 * ```
 * lifecycle.addObserver(AppLifecycleObserver(vaultSessionManager))
 * ```
 */
class AppLifecycleObserver(
    private val vaultSessionManager: VaultSessionManager
) : DefaultLifecycleObserver {

    companion object {
        private const val TAG = "AppLifecycleObserver"

        /**
         * Timeout avant auto-lock quand l'app est en background (minutes)
         * Configurable selon les préférences utilisateur
         */
        private const val BACKGROUND_LOCK_TIMEOUT_MINUTES = 5
    }

    private var backgroundTimestamp: Long = 0

    // Fixed: Use dedicated CoroutineScope instead of runBlocking
    // This prevents blocking the main thread during vault locking
    // MEMORY LEAK FIX: CoroutineScope must be cancelled in onDestroy()
    private val lockScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /**
     * Appelé quand l'application passe au premier plan
     */
    override fun onStart(owner: LifecycleOwner) {
        super.onStart(owner)
        SafeLog.d(TAG, "App moved to foreground")

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
     */
    override fun onStop(owner: LifecycleOwner) {
        super.onStop(owner)
        // Android ne garantit pas l'appel à onDestroy() quand l'app est swipée ou tuée,
        // nous verrouillons donc immédiatement les coffres ici.
        SafeLog.d(TAG, "App moved to background - locking vaults immediately")
        lockAllVaults()
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
     * Fixed: Uses coroutine scope instead of runBlocking to prevent main thread blocking
     */
    private fun lockAllVaults() {
        lockScope.launch {
            try {
                vaultSessionManager.lockVault()
                SafeLog.d(TAG, "Vault locked successfully on lifecycle transition")
            } catch (e: Exception) {
                SafeLog.e(TAG, "Error locking vault", e)
            }
        }
    }
}
