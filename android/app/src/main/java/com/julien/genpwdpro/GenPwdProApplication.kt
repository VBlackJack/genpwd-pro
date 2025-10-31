package com.julien.genpwdpro

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.google.crypto.tink.aead.AeadConfig
import com.julien.genpwdpro.core.crash.RedactingUncaughtExceptionHandler
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.core.runtime.StrictModeInitializer
import com.julien.genpwdpro.data.inmemory.LegacyInMemoryMigrationManager
import com.julien.genpwdpro.data.inmemory.LegacyMigrationResult
import com.julien.genpwdpro.sync.SyncInitializer
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Application class pour GenPwd Pro
 * Nécessaire pour l'initialisation de Hilt, WorkManager et Sync
 */
@HiltAndroidApp
class GenPwdProApplication : Application(), Configuration.Provider {

    private val applicationScope = CoroutineScope(
        SupervisorJob() +
            Dispatchers.IO +
            CoroutineExceptionHandler { _, throwable ->
                if (throwable is CancellationException) {
                    SafeLog.d(TAG, "Application scope cancelled: ${throwable.message}")
                } else {
                    SafeLog.e(TAG, "Unhandled exception in application scope", throwable)
                }
            }
    )

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    @Inject
    lateinit var syncInitializer: SyncInitializer

    @Inject
    lateinit var legacyMigrationManager: LegacyInMemoryMigrationManager

    override fun onCreate() {
        super.onCreate()

        installCrashHandler()
        initializeTink()

        applicationScope.launch {
            when (val result = legacyMigrationManager.migrateIfNeeded()) {
                is LegacyMigrationResult.Success -> {
                    SafeLog.i(
                        TAG,
                        "Legacy data migrated: vaults=${result.importedVaults}, entries=${result.importedEntries}"
                    )
                }
                is LegacyMigrationResult.PartialSuccess -> {
                    SafeLog.w(
                        TAG,
                        "Legacy migration partially completed: importedVaults=${result.importedVaults}, " +
                            "pendingReauth=${result.failedVaultIds.size}"
                    )
                }
                is LegacyMigrationResult.Failure -> {
                    SafeLog.e(TAG, "Legacy migration failed (${result.reason})", result.cause)
                }
                LegacyMigrationResult.AlreadyMigrated -> {
                    SafeLog.d(TAG, "Legacy migration not required (already migrated)")
                }
                LegacyMigrationResult.NoLegacyData -> {
                    SafeLog.d(TAG, "No legacy data detected; skipping migration")
                }
            }
        }

        StrictModeInitializer.install()

        // Initialiser le système de synchronisation
        // Restaure les providers, réactive l'auto-sync, etc.
        syncInitializer.initialize()
    }

    /**
     * Configure WorkManager avec HiltWorkerFactory pour l'injection de dépendances
     */
    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    private fun initializeTink() {
        runCatching { AeadConfig.register() }
            .onFailure { error ->
                throw IllegalStateException("Unable to initialise Tink AEAD configuration", error)
            }
    }

    private fun installCrashHandler() {
        val current = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler(
            RedactingUncaughtExceptionHandler(current)
        )
    }

    companion object {
        private const val TAG = "GenPwdProApp"
    }
}
