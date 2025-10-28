package com.julien.genpwdpro.presentation.utils

import android.app.Activity
import android.view.WindowManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalView

/**
 * Applique dynamiquement le flag [WindowManager.LayoutParams.FLAG_SECURE] sur la fenêtre
 * de l'activité hôte uniquement pour les écrans sensibles.
 */
@Composable
fun SecureWindow(enabled: Boolean = true) {
    val view = LocalView.current

    DisposableEffect(view, enabled) {
        val window = (view.context as? Activity)?.window

        if (enabled) {
            window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }

        onDispose {
            if (enabled) {
                window?.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            }
        }
    }
}
