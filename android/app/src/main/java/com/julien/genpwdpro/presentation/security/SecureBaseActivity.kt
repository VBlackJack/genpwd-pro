package com.julien.genpwdpro.presentation.security

import androidx.appcompat.app.AppCompatActivity

/**
 * Base activity that exposes a [SecureScreenDelegate] for enforcing FLAG_SECURE across the app.
 */
abstract class SecureBaseActivity : AppCompatActivity(), SecureDelegateOwner {

    final override val secureScreenDelegate: SecureScreenDelegate by lazy(LazyThreadSafetyMode.NONE) {
        SecureScreenDelegate(this)
    }

    /**
     * Helper for subclasses to toggle FLAG_SECURE on the main window.
     */
    protected fun secureSensitiveContent(enabled: Boolean) {
        secureScreenDelegate.setNavigationSecure(enabled)
    }
}

interface SecureDelegateOwner {
    val secureScreenDelegate: SecureScreenDelegate
}
