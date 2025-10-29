package com.julien.genpwdpro.presentation.extensions

import android.app.Activity
import android.view.WindowManager
import java.util.WeakHashMap

/**
 * Active ou désactive dynamiquement le flag [WindowManager.LayoutParams.FLAG_SECURE]
 * sur la fenêtre de l'activité hôte.
 */
fun Activity.setSecureScreen(enabled: Boolean) {
    if (enabled) {
        SecureWindowController.register(this, SecureWindowController.NavigationOwner)
    } else {
        SecureWindowController.unregister(this, SecureWindowController.NavigationOwner)
    }
}

internal fun Activity.registerSecureWindowOwner(owner: Any) {
    SecureWindowController.register(this, owner)
}

internal fun Activity.unregisterSecureWindowOwner(owner: Any) {
    SecureWindowController.unregister(this, owner)
}

private object SecureWindowController {
    object NavigationOwner

    private val lock = Any()
    private val registry = WeakHashMap<Activity, MutableSet<Any>>()

    fun register(activity: Activity, owner: Any) {
        synchronized(lock) {
            val owners = registry.getOrPut(activity) { mutableSetOf() }
            val wasEmpty = owners.isEmpty()
            if (owners.add(owner) && wasEmpty) {
                activity.window.setFlags(
                    WindowManager.LayoutParams.FLAG_SECURE,
                    WindowManager.LayoutParams.FLAG_SECURE
                )
            }
        }
    }

    fun unregister(activity: Activity, owner: Any) {
        synchronized(lock) {
            val owners = registry[activity] ?: return
            val removed = owners.remove(owner)
            if (removed && owners.isEmpty()) {
                activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                registry.remove(activity)
            }
        }
    }
}
