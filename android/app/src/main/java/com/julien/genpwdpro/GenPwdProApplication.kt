package com.julien.genpwdpro

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.google.crypto.tink.aead.AeadConfig
import com.julien.genpwdpro.core.crash.RedactingUncaughtExceptionHandler
import com.julien.genpwdpro.core.runtime.StrictModeInitializer
import com.julien.genpwdpro.sync.SyncInitializer
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

/**
 * Application class pour GenPwd Pro
 * Nécessaire pour l'initialisation de Hilt, WorkManager et Sync
 */
@HiltAndroidApp
class GenPwdProApplication : Application(), Configuration.Provider {

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    @Inject
    lateinit var syncInitializer: SyncInitializer

    override fun onCreate() {
        super.onCreate()

        installCrashHandler()
        initializeTink()

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

}
