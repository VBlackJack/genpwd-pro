package com.julien.genpwdpro.presentation.utils

import android.app.Activity
import android.view.WindowManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalContext

/**
 * Applique dynamiquement le flag [WindowManager.LayoutParams.FLAG_SECURE] sur la fenêtre
 * de l'activité hôte uniquement pour les écrans sensibles.
 */
@Composable
fun SecureWindow(enabled: Boolean = true) {
    val activity = LocalContext.current as? Activity
    val window = activity?.window

    DisposableEffect(window, enabled) {
        if (window != null && enabled) {
            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }

        onDispose {
            if (window != null && enabled) {
                window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            }
        }
    }
}
