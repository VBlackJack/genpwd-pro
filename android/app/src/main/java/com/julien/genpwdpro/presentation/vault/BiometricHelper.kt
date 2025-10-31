package com.julien.genpwdpro.presentation.vault

import android.content.Context
import android.content.ContextWrapper
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
 *
 * Compatible avec FragmentActivity (requis pour BiometricPrompt)
 */
class BiometricHelper(private val activity: FragmentActivity) {

    /**
     * Vérifie si la biométrie est disponible sur l'appareil
     */
    fun isBiometricAvailable(): Boolean {
        val biometricManager = BiometricManager.from(activity)
        return when (
            biometricManager.canAuthenticate(
                BiometricManager.Authenticators.BIOMETRIC_STRONG
            )
        ) {
            BiometricManager.BIOMETRIC_SUCCESS -> true
            else -> false
        }
    }

    /**
     * Vérifie si la biométrie ou device credentials sont disponibles
     */
    fun isBiometricOrCredentialsAvailable(): Boolean {
        val biometricManager = BiometricManager.from(activity)
        return when (
            biometricManager.canAuthenticate(
                BiometricManager.Authenticators.BIOMETRIC_STRONG or
                    BiometricManager.Authenticators.DEVICE_CREDENTIAL
            )
        ) {
            BiometricManager.BIOMETRIC_SUCCESS -> true
            else -> false
        }
    }

    /**
     * Affiche le prompt biométrique avec messages améliorés
     *
     * @param title Titre du dialogue (par défaut contextualisé)
     * @param subtitle Sous-titre explicatif
     * @param description Description détaillée de l'action
     * @param allowDeviceCredentials Autoriser PIN/Pattern en fallback
     * @param onSuccess Callback appelé en cas de succès
     * @param onError Callback appelé en cas d'erreur avec code et message
     */
    fun showBiometricPrompt(
        title: String = "Authentification sécurisée",
        subtitle: String? = "Confirmez votre identité",
        description: String? = "Utilisez votre empreinte digitale ou reconnaissance faciale pour continuer en toute sécurité.",
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
         * Traduit un code d'erreur en message utilisateur détaillé
         * avec des instructions claires pour l'utilisateur
         */
        fun getErrorMessage(errorCode: Int): String {
            return when (errorCode) {
                ERROR_CANCELED, ERROR_USER_CANCELED, ERROR_NEGATIVE_BUTTON ->
                    "Authentification annulée. Vous pouvez réessayer ou utiliser votre mot de passe principal."

                ERROR_NO_BIOMETRICS ->
                    "Aucune biométrie enregistrée sur cet appareil.\n\n" +
                    "Pour utiliser cette fonction, configurez d'abord une empreinte digitale ou reconnaissance faciale dans les paramètres de votre appareil."

                ERROR_HW_NOT_PRESENT ->
                    "Capteur biométrique non disponible.\n\n" +
                    "Votre appareil ne dispose pas de capteur d'empreinte digitale ou de reconnaissance faciale. Vous pouvez utiliser votre mot de passe principal pour déverrouiller vos coffres."

                ERROR_HW_UNAVAILABLE ->
                    "Capteur biométrique temporairement indisponible.\n\n" +
                    "Le capteur est peut-être utilisé par une autre application. Veuillez réessayer dans quelques instants."

                ERROR_LOCKOUT ->
                    "Trop de tentatives échouées.\n\n" +
                    "Pour votre sécurité, la biométrie est temporairement désactivée. Veuillez patienter 30 secondes avant de réessayer, ou utilisez votre mot de passe principal."

                ERROR_LOCKOUT_PERMANENT ->
                    "Biométrie verrouillée.\n\n" +
                    "Après plusieurs tentatives échouées, la biométrie a été verrouillée. Pour des raisons de sécurité, veuillez déverrouiller votre appareil avec votre PIN/mot de passe, puis réessayez."

                ERROR_NO_DEVICE_CREDENTIAL ->
                    "Aucun code de sécurité configuré.\n\n" +
                    "Pour utiliser cette fonction, configurez d'abord un code PIN, un schéma ou un mot de passe dans les paramètres de sécurité de votre appareil."

                ERROR_TIMEOUT ->
                    "Temps d'authentification expiré.\n\n" +
                    "Vous n'avez pas authentifié dans le délai imparti. Veuillez réessayer."

                ERROR_UNABLE_TO_PROCESS ->
                    "Impossible de traiter l'authentification.\n\n" +
                    "Le capteur n'a pas pu lire correctement votre biométrie. Assurez-vous que votre doigt/visage est bien positionné et réessayez."

                else ->
                    "Échec de l'authentification biométrique.\n\n" +
                    "Une erreur inattendue s'est produite (code: $errorCode). Vous pouvez utiliser votre mot de passe principal."
            }
        }

        /**
         * Obtient un message court pour l'erreur (sans les détails)
         */
        fun getShortErrorMessage(errorCode: Int): String {
            return when (errorCode) {
                ERROR_CANCELED, ERROR_USER_CANCELED, ERROR_NEGATIVE_BUTTON ->
                    "Authentification annulée"
                ERROR_NO_BIOMETRICS ->
                    "Aucune biométrie enregistrée"
                ERROR_HW_NOT_PRESENT ->
                    "Capteur non disponible"
                ERROR_HW_UNAVAILABLE ->
                    "Capteur temporairement indisponible"
                ERROR_LOCKOUT ->
                    "Trop de tentatives"
                ERROR_LOCKOUT_PERMANENT ->
                    "Biométrie verrouillée"
                ERROR_NO_DEVICE_CREDENTIAL ->
                    "Aucun code PIN/pattern configuré"
                ERROR_TIMEOUT ->
                    "Temps expiré"
                ERROR_UNABLE_TO_PROCESS ->
                    "Impossible de traiter l'authentification"
                else ->
                    "Échec de l'authentification"
            }
        }
    }
}

/**
 * Trouve la FragmentActivity en parcourant la chaîne de ContextWrapper
 * FragmentActivity est requise pour BiometricPrompt
 */
fun Context.findActivity(): FragmentActivity? {
    var context = this
    while (context is ContextWrapper) {
        if (context is FragmentActivity) return context
        context = context.baseContext
    }
    return null
}

/**
 * Extension pour obtenir le BiometricHelper depuis un Context
 */
fun Context.getBiometricHelper(): BiometricHelper? {
    return findActivity()?.let { BiometricHelper(it) }
}
