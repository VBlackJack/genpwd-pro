package com.julien.genpwdpro.domain.session

import android.util.Log
import com.julien.genpwdpro.data.local.dao.VaultRegistryDao
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class StartupVaultLocker @Inject constructor(
    private val sessionManager: SessionManager,
    private val vaultSessionManager: VaultSessionManager,
    private val vaultRegistryDao: VaultRegistryDao
) {
    companion object {
        private const val TAG = "StartupVaultLocker"
    }

    suspend fun lockAllVaultsOnStartup() {
        try {
            sessionManager.lockVault()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to lock session manager on startup", e)
        }

        try {
            vaultSessionManager.lockVault()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to lock vault session manager on startup", e)
        }

        try {
            vaultRegistryDao.resetAllLoadedFlags()
            Log.d(TAG, "Vault registry flags reset on startup")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to reset vault registry flags on startup", e)
        }
    }
}
