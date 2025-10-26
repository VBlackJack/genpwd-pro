package com.julien.genpwdpro

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
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
}
