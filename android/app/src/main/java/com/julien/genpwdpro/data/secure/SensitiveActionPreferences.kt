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

    val requireBiometricForSensitiveActions: StateFlow<Boolean> = requireBiometricFlow.asStateFlow()

    fun setRequireBiometricForSensitiveActions(value: Boolean): Boolean {
        if (!securePrefs.isUnlocked()) {
            return false
        }
        securePrefs.putBoolean(KEY_REQUIRE_BIOMETRIC, value)
        requireBiometricFlow.value = value
        return true
    }

    companion object {
        const val KEY_REQUIRE_BIOMETRIC = "require_biometric_for_sensitive_actions"
    }
}
