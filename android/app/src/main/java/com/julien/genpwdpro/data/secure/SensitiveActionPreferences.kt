package com.julien.genpwdpro.data.secure

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SensitiveActionPreferences @Inject constructor(
    private val securePrefs: SecurePrefs
) {
    private val requireBiometricFlow = MutableStateFlow(
        securePrefs.getBoolean(KEY_REQUIRE_BIOMETRIC, false)
    )

    private val clipboardTtlFlow = MutableStateFlow(
        securePrefs.getLong(KEY_CLIPBOARD_TTL_MS, DEFAULT_CLIPBOARD_TTL_MS)
    )

    val requireBiometricForSensitiveActions: StateFlow<Boolean> = requireBiometricFlow.asStateFlow()
    val clipboardTtlMs: StateFlow<Long> = clipboardTtlFlow.asStateFlow()

    fun setRequireBiometricForSensitiveActions(value: Boolean): Boolean {
        if (!securePrefs.isUnlocked()) {
            return false
        }
        securePrefs.putBoolean(KEY_REQUIRE_BIOMETRIC, value)
        requireBiometricFlow.value = value
        return true
    }

    fun setClipboardTtlMs(value: Long): Boolean {
        if (!securePrefs.isUnlocked()) {
            return false
        }
        securePrefs.putLong(KEY_CLIPBOARD_TTL_MS, value)
        clipboardTtlFlow.value = value
        return true
    }

    fun currentClipboardTtlMs(): Long = clipboardTtlFlow.value

    companion object {
        const val KEY_REQUIRE_BIOMETRIC = "require_biometric_for_sensitive_actions"
        const val KEY_CLIPBOARD_TTL_MS = "clipboard_ttl_ms"
        const val DEFAULT_CLIPBOARD_TTL_MS = 30_000L
    }
}
