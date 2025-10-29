package com.julien.genpwdpro.presentation.security

import android.app.Activity
import android.app.Dialog
import android.os.Build
import android.view.WindowManager
import androidx.annotation.VisibleForTesting
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import com.julien.genpwdpro.presentation.extensions.registerSecureWindowOwner
import com.julien.genpwdpro.presentation.extensions.unregisterSecureWindowOwner
import java.util.WeakHashMap

/**
 * Delegate responsible for managing FLAG_SECURE on behalf of Activities, dialogs and bottom sheets.
 */
class SecureScreenDelegate(
    private val activity: Activity
) {

    private val navigationOwner = Any()
    private val dialogOwners = WeakHashMap<Dialog, Any>()

    /**
     * Enables or disables FLAG_SECURE for the primary Activity surface.
     */
    fun setNavigationSecure(enabled: Boolean) {
        if (enabled) {
            registerSecureOwner(navigationOwner)
        } else {
            unregisterSecureOwner(navigationOwner)
        }
    }

    /**
     * Registers a custom owner that should enforce FLAG_SECURE.
     */
    fun registerSecureOwner(owner: Any = Any()) {
        activity.registerSecureWindowOwner(owner)
    }

    /**
     * Unregisters a previously registered owner.
     */
    fun unregisterSecureOwner(owner: Any) {
        activity.unregisterSecureWindowOwner(owner)
    }

    /**
     * Applies FLAG_SECURE to a dialog and keeps it applied until the dialog is dismissed.
     */
    fun secureDialog(dialog: Dialog) {
        val owner = dialogOwners.getOrPut(dialog) { Any() }
        dialog.window?.apply {
            setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                runCatching { setRecentsScreenshotEnabled(false) }
            }
        }
        registerSecureOwner(owner)
        dialog.setOnDismissListener {
            unregisterSecureOwner(owner)
            dialogOwners.remove(dialog)
        }
    }

    /**
     * Applies FLAG_SECURE to dialog fragments (including bottom sheets) and keeps it while visible.
     */
    fun secureDialogFragment(fragment: DialogFragment) {
        fragment.dialog?.let { secureDialog(it) }
        fragment.lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onCreate(ownerLifecycle: LifecycleOwner) {
                fragment.dialog?.let { secureDialog(it) }
            }
        })
    }

    @VisibleForTesting
    internal fun getTrackedDialogCount(): Int = dialogOwners.size
}
