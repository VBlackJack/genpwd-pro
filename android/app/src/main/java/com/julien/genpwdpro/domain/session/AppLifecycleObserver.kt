package com.julien.genpwdpro.domain.session

import android.util.Log
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner

/**
 * Observateur du cycle de vie de l'application
 *
 * Gère l'auto-lock des vaults quand l'application passe en arrière-plan
 * et le nettoyage des sessions expirées au premier plan.
 *
 * Usage:
 * ```
 * lifecycle.addObserver(AppLifecycleObserver(sessionManager, vaultSessionManager))
 * ```
 */
class AppLifecycleObserver(
    private val sessionManager: SessionManager,
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

    /**
     * Appelé quand l'application passe au premier plan
     */
    override fun onStart(owner: LifecycleOwner) {
        super.onStart(owner)
        Log.d(TAG, "App moved to foreground")

        // Vérifier si l'app est restée en background trop longtemps
        if (backgroundTimestamp > 0) {
            val backgroundDuration = System.currentTimeMillis() - backgroundTimestamp
            val timeoutMillis = BACKGROUND_LOCK_TIMEOUT_MINUTES * 60 * 1000

            if (backgroundDuration > timeoutMillis) {
                Log.d(TAG, "Background timeout exceeded ($backgroundDuration ms > $timeoutMillis ms), locking vaults")
                lockAllVaults()
            } else {
                Log.d(TAG, "Background duration within timeout: $backgroundDuration ms")
            }
        }

        backgroundTimestamp = 0
    }

    /**
     * Appelé quand l'application passe en arrière-plan
     */
    override fun onStop(owner: LifecycleOwner) {
        super.onStop(owner)
        Log.d(TAG, "App moved to background")
        backgroundTimestamp = System.currentTimeMillis()

        // Note: On ne lock PAS immédiatement pour permettre un retour rapide
        // Le lock sera effectué uniquement si le timeout est dépassé
    }

    /**
     * Appelé quand l'application est détruite
     */
    override fun onDestroy(owner: LifecycleOwner) {
        super.onDestroy(owner)
        Log.d(TAG, "App destroyed, locking all vaults")
        lockAllVaults()
    }

    /**
     * Verrouille tous les vaults actifs
     */
    private fun lockAllVaults() {
        try {
            sessionManager.lockVault()
            vaultSessionManager.lockVault()
            Log.d(TAG, "All vaults locked successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Error locking vaults", e)
        }
    }
}
