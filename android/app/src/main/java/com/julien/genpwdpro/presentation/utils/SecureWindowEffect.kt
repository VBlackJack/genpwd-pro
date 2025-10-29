package com.julien.genpwdpro.presentation.utils

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import com.julien.genpwdpro.presentation.extensions.registerSecureWindowOwner
import com.julien.genpwdpro.presentation.extensions.unregisterSecureWindowOwner

/**
 * Applique dynamiquement le flag [WindowManager.LayoutParams.FLAG_SECURE] sur la fenêtre
 * de l'activité hôte uniquement pour les écrans sensibles.
 */
@Composable
fun SecureWindow(enabled: Boolean = true) {
    val context = LocalContext.current
    val owner = remember { Any() }

    DisposableEffect(context, enabled) {
        val activity = context as? android.app.Activity

        if (enabled && activity != null) {
            activity.registerSecureWindowOwner(owner)
        }

        onDispose {
            if (enabled && activity != null) {
                activity.unregisterSecureWindowOwner(owner)
            }
        }
    }
}
