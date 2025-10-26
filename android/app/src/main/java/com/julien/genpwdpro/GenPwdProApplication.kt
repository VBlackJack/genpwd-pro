package com.julien.genpwdpro

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

/**
 * Application class pour GenPwd Pro
 * Nécessaire pour l'initialisation de Hilt et WorkManager
 */
@HiltAndroidApp
class GenPwdProApplication : Application(), Configuration.Provider {

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    override fun onCreate() {
        super.onCreate()
        // Initialisation globale si nécessaire
    }

    /**
     * Configure WorkManager avec HiltWorkerFactory pour l'injection de dépendances
     */
    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()
}
