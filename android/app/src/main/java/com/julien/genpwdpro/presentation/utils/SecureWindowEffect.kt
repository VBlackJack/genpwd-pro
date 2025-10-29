package com.julien.genpwdpro.presentation.utils

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import com.julien.genpwdpro.presentation.extensions.registerSecureWindowOwner
import com.julien.genpwdpro.presentation.extensions.unregisterSecureWindowOwner
import com.julien.genpwdpro.presentation.security.SecureDelegateOwner

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
        val delegate = (activity as? SecureDelegateOwner)?.secureScreenDelegate

        if (enabled && activity != null) {
            if (delegate != null) {
                delegate.registerSecureOwner(owner)
            } else {
                activity.registerSecureWindowOwner(owner)
            }
        }

        onDispose {
            if (enabled && activity != null) {
                if (delegate != null) {
                    delegate.unregisterSecureOwner(owner)
                } else {
                    activity.unregisterSecureWindowOwner(owner)
                }
            }
        }
    }
}
