package com.julien.genpwdpro

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

/**
 * Application class pour GenPwd Pro
 * Nécessaire pour l'initialisation de Hilt
 */
@HiltAndroidApp
class GenPwdProApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        // Initialisation globale si nécessaire
    }
}
