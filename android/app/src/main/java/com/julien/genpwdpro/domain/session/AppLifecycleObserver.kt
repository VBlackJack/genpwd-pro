package com.julien.genpwdpro.domain.session

import android.util.Log
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.runBlocking

/**
 * Observateur du cycle de vie de l'application
 *
 * Gère l'auto-lock des vaults quand l'application passe en arrière-plan
 * en déclenchant immédiatement le verrouillage lors de onStop.
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
    }

    /**
     * Appelé quand l'application passe au premier plan
     */
    override fun onStart(owner: LifecycleOwner) {
        super.onStart(owner)
        Log.d(TAG, "App moved to foreground")
    }

    /**
     * Appelé quand l'application passe en arrière-plan
     */
    override fun onStop(owner: LifecycleOwner) {
        super.onStop(owner)
        Log.d(TAG, "App moved to background - locking all vaults")
        lockAllVaults()
    }

    /**
     * Verrouille tous les vaults actifs
     */
    private fun lockAllVaults() {
        try {
            runBlocking {
                sessionManager.lockVault()
                vaultSessionManager.lockVault()
            }
            Log.d(TAG, "All vaults locked successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Error locking vaults", e)
        }
    }
}
