package com.julien.genpwdpro.domain.session

import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.data.db.dao.VaultRegistryDao
import javax.inject.Inject
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

/**
 * Coordonne le verrouillage initial des coffres lors du démarrage de l'application.
 *
 * - Verrouille la session file-based et la session legacy en mémoire.
 * - Réinitialise les indicateurs `isLoaded` du registre Room.
 * - Retente automatiquement en cas d'erreur et applique une solution de repli granulaire.
 */
class VaultStartupLocker @Inject constructor(
    private val vaultSessionManager: VaultSessionManager,
    private val sessionManager: SessionManager,
    private val vaultRegistryDao: VaultRegistryDao,
    private val ioDispatcher: CoroutineDispatcher = kotlinx.coroutines.Dispatchers.IO
) {

    companion object {
        private const val TAG = "VaultStartupLocker"
        private const val MAX_RESET_ATTEMPTS = 2
        private const val RETRY_DELAY_MS = 50L
    }

    data class StartupLockResult(
        val fileSessionLocked: Boolean,
        val legacySessionLocked: Boolean,
        val registryResetSucceeded: Boolean,
        val fallbackApplied: Boolean,
        val errors: List<String>
    ) {
        val isSecure: Boolean
            get() = fileSessionLocked && legacySessionLocked && (registryResetSucceeded || fallbackApplied)
    }

    /**
     * Effectue les actions de verrouillage et renvoie un résultat détaillé.
     */
    suspend fun secureStartup(): StartupLockResult {
        val errors = mutableListOf<String>()

        val fileSessionLocked = runCatching {
            vaultSessionManager.lockVault()
        }.onFailure { throwable ->
            errors += "File vault lock failed: ${throwable.message}"
            SafeLog.e(TAG, "Unable to lock file-based vault session", throwable)
        }.isSuccess

        val legacySessionLocked = runCatching {
            sessionManager.lockVault()
        }.onFailure { throwable ->
            errors += "Legacy session lock failed: ${throwable.message}"
            SafeLog.e(TAG, "Unable to lock legacy session", throwable)
        }.isSuccess

        var registryResetSucceeded = false
        repeat(MAX_RESET_ATTEMPTS) { attempt ->
            val resetAttempt = runCatching {
                withContext(ioDispatcher) { vaultRegistryDao.resetAllLoadedFlags() }
            }

            if (resetAttempt.isSuccess) {
                registryResetSucceeded = true
                SafeLog.d(TAG, "Registry reset succeeded on attempt ${attempt + 1}")
                return@repeat
            } else {
                val throwable = resetAttempt.exceptionOrNull()
                errors += "Registry reset attempt ${attempt + 1} failed: ${throwable?.message}"
                SafeLog.w(TAG, "Failed to reset registry flags (attempt ${attempt + 1})", throwable)
                if (attempt < MAX_RESET_ATTEMPTS - 1) {
                    delay(RETRY_DELAY_MS)
                }
            }
        }

        var fallbackApplied = false
        if (!registryResetSucceeded) {
            fallbackApplied = applyFallbackReset(errors)
        }

        return StartupLockResult(
            fileSessionLocked = fileSessionLocked,
            legacySessionLocked = legacySessionLocked,
            registryResetSucceeded = registryResetSucceeded,
            fallbackApplied = fallbackApplied,
            errors = errors
        )
    }

    private suspend fun applyFallbackReset(errors: MutableList<String>): Boolean {
        return runCatching {
            withContext(ioDispatcher) {
                val loadedIds = vaultRegistryDao.getLoadedVaultIds()
                if (loadedIds.isEmpty()) {
                    SafeLog.d(TAG, "Fallback reset not required: no loaded vaults reported")
                    return@withContext true
                }

                var success = true
                loadedIds.forEach { id ->
                    runCatching {
                        vaultRegistryDao.updateLoadedStatus(id, false)
                    }.onFailure { throwable ->
                        success = false
                        errors += "Fallback update failed for $id: ${throwable.message}"
                        SafeLog.e(
                            TAG,
                            "Failed to clear loaded flag for vault: vaultId=${SafeLog.redact(id)}",
                            throwable
                        )
                    }
                }

                success
            }
        }.onFailure { throwable ->
            errors += "Fallback reset failed: ${throwable.message}"
            SafeLog.e(TAG, "Fallback reset failed", throwable)
        }.getOrDefault(false)
    }
}
