package com.julien.genpwdpro.presentation.extensions

import android.app.Activity
import android.view.WindowManager

/**
 * Active ou désactive dynamiquement le flag [WindowManager.LayoutParams.FLAG_SECURE]
 * sur la fenêtre de l'activité hôte.
 */
fun Activity.setSecureScreen(enabled: Boolean) {
    if (enabled) {
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )
    } else {
        window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }
}
