package com.julien.genpwdpro.presentation.vault

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

/**
 * Helper pour gérer l'authentification biométrique
 *
 * Supporte :
 * - Empreinte digitale
 * - Reconnaissance faciale
 * - Reconnaissance de l'iris
 * - Device credentials (PIN/Pattern)
 */
class BiometricHelper(private val activity: FragmentActivity) {

    /**
     * Vérifie si la biométrie est disponible sur l'appareil
     */
    fun isBiometricAvailable(): Boolean {
        val biometricManager = BiometricManager.from(activity)
        return when (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)) {
            BiometricManager.BIOMETRIC_SUCCESS -> true
            else -> false
        }
    }

    /**
     * Vérifie si la biométrie ou device credentials sont disponibles
     */
    fun isBiometricOrCredentialsAvailable(): Boolean {
        val biometricManager = BiometricManager.from(activity)
        return when (biometricManager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG or
            BiometricManager.Authenticators.DEVICE_CREDENTIAL
        )) {
            BiometricManager.BIOMETRIC_SUCCESS -> true
            else -> false
        }
    }

    /**
     * Affiche le prompt biométrique
     *
     * @param title Titre du dialogue
     * @param subtitle Sous-titre (nom du vault)
     * @param description Description additionnelle
     * @param allowDeviceCredentials Autoriser PIN/Pattern en fallback
     * @param onSuccess Callback appelé en cas de succès
     * @param onError Callback appelé en cas d'erreur
     */
    fun showBiometricPrompt(
        title: String = "Authentification biométrique",
        subtitle: String? = null,
        description: String? = null,
        allowDeviceCredentials: Boolean = true,
        onSuccess: () -> Unit,
        onError: (errorCode: Int, errorMessage: String) -> Unit
    ) {
        val executor = ContextCompat.getMainExecutor(activity)

        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                onSuccess()
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                onError(errorCode, errString.toString())
            }

            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                // L'utilisateur peut réessayer
            }
        }

        val biometricPrompt = BiometricPrompt(activity, executor, callback)

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .apply {
                if (subtitle != null) setSubtitle(subtitle)
                if (description != null) setDescription(description)
            }
            .apply {
                if (allowDeviceCredentials) {
                    // Permet PIN/Pattern comme fallback
                    setAllowedAuthenticators(
                        BiometricManager.Authenticators.BIOMETRIC_STRONG or
                        BiometricManager.Authenticators.DEVICE_CREDENTIAL
                    )
                } else {
                    // Biométrie uniquement
                    setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                    setNegativeButtonText("Annuler")
                }
            }
            .build()

        biometricPrompt.authenticate(promptInfo)
    }

    companion object {
        /**
         * Codes d'erreur biométriques
         */
        const val ERROR_CANCELED = BiometricPrompt.ERROR_CANCELED
        const val ERROR_USER_CANCELED = BiometricPrompt.ERROR_USER_CANCELED
        const val ERROR_NEGATIVE_BUTTON = BiometricPrompt.ERROR_NEGATIVE_BUTTON
        const val ERROR_NO_BIOMETRICS = BiometricPrompt.ERROR_NO_BIOMETRICS
        const val ERROR_HW_NOT_PRESENT = BiometricPrompt.ERROR_HW_NOT_PRESENT
        const val ERROR_HW_UNAVAILABLE = BiometricPrompt.ERROR_HW_UNAVAILABLE
        const val ERROR_LOCKOUT = BiometricPrompt.ERROR_LOCKOUT
        const val ERROR_LOCKOUT_PERMANENT = BiometricPrompt.ERROR_LOCKOUT_PERMANENT
        const val ERROR_NO_DEVICE_CREDENTIAL = BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL
        const val ERROR_TIMEOUT = BiometricPrompt.ERROR_TIMEOUT
        const val ERROR_UNABLE_TO_PROCESS = BiometricPrompt.ERROR_UNABLE_TO_PROCESS
        const val ERROR_VENDOR = BiometricPrompt.ERROR_VENDOR

        /**
         * Traduit un code d'erreur en message utilisateur
         */
        fun getErrorMessage(errorCode: Int): String {
            return when (errorCode) {
                ERROR_CANCELED, ERROR_USER_CANCELED, ERROR_NEGATIVE_BUTTON ->
                    "Authentification annulée"
                ERROR_NO_BIOMETRICS ->
                    "Aucune biométrie enregistrée. Veuillez configurer une empreinte ou reconnaissance faciale."
                ERROR_HW_NOT_PRESENT ->
                    "Capteur biométrique non disponible sur cet appareil"
                ERROR_HW_UNAVAILABLE ->
                    "Capteur biométrique temporairement indisponible"
                ERROR_LOCKOUT ->
                    "Trop de tentatives. Réessayez dans quelques secondes."
                ERROR_LOCKOUT_PERMANENT ->
                    "Trop de tentatives. Utilisez votre mot de passe."
                ERROR_NO_DEVICE_CREDENTIAL ->
                    "Aucun code PIN/pattern configuré"
                ERROR_TIMEOUT ->
                    "Délai d'authentification dépassé"
                ERROR_UNABLE_TO_PROCESS ->
                    "Impossible de traiter l'authentification"
                else ->
                    "Échec de l'authentification biométrique"
            }
        }
    }
}

/**
 * Extension pour obtenir le BiometricHelper depuis un Context
 */
fun Context.getBiometricHelper(): BiometricHelper? {
    return (this as? FragmentActivity)?.let { BiometricHelper(it) }
}
