package com.julien.genpwdpro.data.secure

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

@Singleton
class SensitiveActionPreferences @Inject constructor(
    private val securePrefs: SecurePrefs
) {
    // Flows pour toutes les préférences biométriques
    private val requireBiometricFlow = MutableStateFlow(
        securePrefs.getBoolean(KEY_REQUIRE_BIOMETRIC, false)
    )

    private val clipboardTtlFlow = MutableStateFlow(
        securePrefs.getLong(KEY_CLIPBOARD_TTL_MS, DEFAULT_CLIPBOARD_TTL_MS)
    )

    private val requireBiometricForAutofillFlow = MutableStateFlow(
        securePrefs.getBoolean(KEY_REQUIRE_BIOMETRIC_AUTOFILL, false)
    )

    private val requireBiometricForExportFlow = MutableStateFlow(
        securePrefs.getBoolean(KEY_REQUIRE_BIOMETRIC_EXPORT, true) // Activé par défaut pour sécurité
    )

    private val requireBiometricForImportFlow = MutableStateFlow(
        securePrefs.getBoolean(KEY_REQUIRE_BIOMETRIC_IMPORT, false)
    )

    private val requireBiometricOnAppStartFlow = MutableStateFlow(
        securePrefs.getBoolean(KEY_REQUIRE_BIOMETRIC_APP_START, false)
    )

    // StateFlows publics
    val requireBiometricForSensitiveActions: StateFlow<Boolean> = requireBiometricFlow.asStateFlow()
    val clipboardTtlMs: StateFlow<Long> = clipboardTtlFlow.asStateFlow()
    val requireBiometricForAutofill: StateFlow<Boolean> = requireBiometricForAutofillFlow.asStateFlow()
    val requireBiometricForExport: StateFlow<Boolean> = requireBiometricForExportFlow.asStateFlow()
    val requireBiometricForImport: StateFlow<Boolean> = requireBiometricForImportFlow.asStateFlow()
    val requireBiometricOnAppStart: StateFlow<Boolean> = requireBiometricOnAppStartFlow.asStateFlow()

    // Setters pour actions sensibles (copie, vue, suppression)
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

    // Setter pour autofill
    fun setRequireBiometricForAutofill(value: Boolean): Boolean {
        if (!securePrefs.isUnlocked()) {
            return false
        }
        securePrefs.putBoolean(KEY_REQUIRE_BIOMETRIC_AUTOFILL, value)
        requireBiometricForAutofillFlow.value = value
        return true
    }

    // Setter pour export
    fun setRequireBiometricForExport(value: Boolean): Boolean {
        if (!securePrefs.isUnlocked()) {
            return false
        }
        securePrefs.putBoolean(KEY_REQUIRE_BIOMETRIC_EXPORT, value)
        requireBiometricForExportFlow.value = value
        return true
    }

    // Setter pour import
    fun setRequireBiometricForImport(value: Boolean): Boolean {
        if (!securePrefs.isUnlocked()) {
            return false
        }
        securePrefs.putBoolean(KEY_REQUIRE_BIOMETRIC_IMPORT, value)
        requireBiometricForImportFlow.value = value
        return true
    }

    // Setter pour démarrage app
    fun setRequireBiometricOnAppStart(value: Boolean): Boolean {
        if (!securePrefs.isUnlocked()) {
            return false
        }
        securePrefs.putBoolean(KEY_REQUIRE_BIOMETRIC_APP_START, value)
        requireBiometricOnAppStartFlow.value = value
        return true
    }

    fun currentClipboardTtlMs(): Long = clipboardTtlFlow.value

    companion object {
        // Clés de stockage
        const val KEY_REQUIRE_BIOMETRIC = "require_biometric_for_sensitive_actions"
        const val KEY_CLIPBOARD_TTL_MS = "clipboard_ttl_ms"
        const val KEY_REQUIRE_BIOMETRIC_AUTOFILL = "require_biometric_for_autofill"
        const val KEY_REQUIRE_BIOMETRIC_EXPORT = "require_biometric_for_export"
        const val KEY_REQUIRE_BIOMETRIC_IMPORT = "require_biometric_for_import"
        const val KEY_REQUIRE_BIOMETRIC_APP_START = "require_biometric_on_app_start"

        // Valeurs par défaut
        const val DEFAULT_CLIPBOARD_TTL_MS = 30_000L
    }
}
