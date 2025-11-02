package com.julien.genpwdpro.presentation.extensions

import android.app.Activity
import android.os.Build
import android.view.WindowManager
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import com.julien.genpwdpro.presentation.security.SecureDelegateOwner
import java.util.WeakHashMap

/**
 * Active ou désactive dynamiquement le flag [WindowManager.LayoutParams.FLAG_SECURE]
 * sur la fenêtre de l'activité hôte.
 */
fun Activity.setSecureScreen(enabled: Boolean) {
    if (this is SecureDelegateOwner) {
        secureScreenDelegate.setNavigationSecure(enabled)
        return
    }
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
    private val registry = WeakHashMap<Activity, SecureEntry>()

    fun register(activity: Activity, owner: Any) {
        synchronized(lock) {
            val entry = registry[activity]
            if (entry != null) {
                val wasEmpty = entry.owners.isEmpty()
                if (entry.owners.add(owner) && wasEmpty) {
                    applySecureDecor(activity)
                }
                return
            }

            val lifecycleOwner = activity as? LifecycleOwner
            val owners = mutableSetOf(owner)
            val observer = lifecycleOwner?.let {
                SecureLifecycleObserver(activity)
                    .also { lifecycleOwner.lifecycle.addObserver(it) }
            }

            registry[activity] = SecureEntry(owners, observer)
            applySecureDecor(activity)
        }
    }

    fun unregister(activity: Activity, owner: Any) {
        synchronized(lock) {
            val entry = registry[activity] ?: return
            val removed = entry.owners.remove(owner)
            if (removed && entry.owners.isEmpty()) {
                tearDown(activity, entry)
            }
        }
    }

    private fun applySecureDecor(activity: Activity) {
        activity.window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )
        // Android 14+ allows disabling recents screenshots explicitly in addition to FLAG_SECURE.
        // On older versions the flag remains the primary mitigation for task previews.
        activity.disableRecentsScreenshots()
    }

    private fun tearDown(activity: Activity, entry: SecureEntry) {
        entry.observer?.let { observer ->
            (activity as? LifecycleOwner)?.lifecycle?.removeObserver(observer)
        }
        clearSecureDecor(activity)
        registry.remove(activity)
    }

    private fun clearSecureDecor(activity: Activity) {
        activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        activity.enableRecentsScreenshots()
    }

    private fun handleResume(activity: Activity) {
        synchronized(lock) {
            if (registry[activity]?.owners?.isNotEmpty() == true) {
                applySecureDecor(activity)
            }
        }
    }

    private fun handlePause(activity: Activity) {
        synchronized(lock) {
            if (registry[activity]?.owners?.isNotEmpty() == true) {
                // Keep task previews suppressed when entering PiP or multi-window modes.
                activity.disableRecentsScreenshots()
            }
        }
    }

    private fun handleDestroy(activity: Activity) {
        synchronized(lock) {
            val entry = registry.remove(activity) ?: return
            entry.observer?.let { observer ->
                (activity as? LifecycleOwner)?.lifecycle?.removeObserver(observer)
            }
            clearSecureDecor(activity)
        }
    }

    private data class SecureEntry(
        val owners: MutableSet<Any>,
        val observer: DefaultLifecycleObserver?
    )

    private class SecureLifecycleObserver(
        private val activity: Activity
    ) : DefaultLifecycleObserver {
        override fun onResume(owner: LifecycleOwner) {
            handleResume(activity)
        }

        override fun onPause(owner: LifecycleOwner) {
            handlePause(activity)
        }

        override fun onDestroy(owner: LifecycleOwner) {
            handleDestroy(activity)
        }
    }
}

private fun Activity.disableRecentsScreenshots() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        runCatching { setRecentsScreenshotEnabled(false) }
    }
}

private fun Activity.enableRecentsScreenshots() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        runCatching { setRecentsScreenshotEnabled(true) }
    }
}
