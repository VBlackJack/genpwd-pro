package com.julien.genpwdpro.security

import android.content.Context
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Gestionnaire d'authentification biométrique
 *
 * Supporte:
 * - Empreinte digitale
 * - Reconnaissance faciale
 * - Reconnaissance iris
 * - PIN/Pattern/Password comme fallback
 *
 * Niveaux de sécurité:
 * - BIOMETRIC_STRONG: Biométrie de classe 3 (la plus sécurisée)
 * - DEVICE_CREDENTIAL: PIN/Pattern/Password de l'appareil
 */
@Singleton
class BiometricManager @Inject constructor() {

    companion object {
        private const val AUTHENTICATORS = BIOMETRIC_STRONG or DEVICE_CREDENTIAL
    }

    /**
     * Vérifie si la biométrie est disponible sur cet appareil
     */
    fun isBiometricAvailable(context: Context): BiometricAvailability {
        val biometricManager = androidx.biometric.BiometricManager.from(context)

        return when (biometricManager.canAuthenticate(AUTHENTICATORS)) {
            androidx.biometric.BiometricManager.BIOMETRIC_SUCCESS ->
                BiometricAvailability.AVAILABLE

            androidx.biometric.BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE ->
                BiometricAvailability.NO_HARDWARE

            androidx.biometric.BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE ->
                BiometricAvailability.HARDWARE_UNAVAILABLE

            androidx.biometric.BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED ->
                BiometricAvailability.NONE_ENROLLED

            androidx.biometric.BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED ->
                BiometricAvailability.SECURITY_UPDATE_REQUIRED

            androidx.biometric.BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED ->
                BiometricAvailability.UNSUPPORTED

            androidx.biometric.BiometricManager.BIOMETRIC_STATUS_UNKNOWN ->
                BiometricAvailability.UNKNOWN

            else -> BiometricAvailability.UNKNOWN
        }
    }

    /**
     * Affiche le prompt d'authentification biométrique
     *
     * @param activity Activity pour afficher le prompt
     * @param title Titre du dialogue
     * @param subtitle Sous-titre explicatif
     * @param onSuccess Callback en cas de succès
     * @param onError Callback en cas d'erreur
     * @param onFailure Callback en cas d'échec d'authentification
     */
    fun authenticate(
        activity: FragmentActivity,
        title: String = "Authentification requise",
        subtitle: String = "Utilisez votre empreinte digitale ou votre visage",
        onSuccess: (BiometricPrompt.AuthenticationResult) -> Unit,
        onError: (Int, String) -> Unit = { _, _ -> },
        onFailure: () -> Unit = {}
    ) {
        val executor = ContextCompat.getMainExecutor(activity)

        val biometricPrompt = BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    onSuccess(result)
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    onError(errorCode, errString.toString())
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    onFailure()
                }
            }
        )

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(AUTHENTICATORS)
            .build()

        biometricPrompt.authenticate(promptInfo)
    }

    /**
     * Affiche le prompt pour chiffrer des données
     * Utilise une CryptoObject pour lier l'authentification au chiffrement
     */
    fun authenticateWithCrypto(
        activity: FragmentActivity,
        cryptoObject: BiometricPrompt.CryptoObject,
        title: String = "Authentification requise",
        subtitle: String = "Chiffrement biométrique",
        onSuccess: (BiometricPrompt.AuthenticationResult) -> Unit,
        onError: (Int, String) -> Unit = { _, _ -> }
    ) {
        val executor = ContextCompat.getMainExecutor(activity)

        val biometricPrompt = BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    onSuccess(result)
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    onError(errorCode, errString.toString())
                }
            }
        )

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(BIOMETRIC_STRONG) // DEVICE_CREDENTIAL non supporté avec CryptoObject
            .setNegativeButtonText("Annuler")
            .build()

        biometricPrompt.authenticate(promptInfo, cryptoObject)
    }

    /**
     * Obtient un message d'erreur lisible
     */
    fun getErrorMessage(errorCode: Int): String {
        return when (errorCode) {
            BiometricPrompt.ERROR_HW_UNAVAILABLE ->
                "Matériel biométrique indisponible"
            BiometricPrompt.ERROR_UNABLE_TO_PROCESS ->
                "Impossible de traiter l'authentification"
            BiometricPrompt.ERROR_TIMEOUT ->
                "Délai d'attente dépassé"
            BiometricPrompt.ERROR_NO_SPACE ->
                "Espace insuffisant"
            BiometricPrompt.ERROR_CANCELED ->
                "Opération annulée"
            BiometricPrompt.ERROR_LOCKOUT ->
                "Trop de tentatives. Réessayez plus tard"
            BiometricPrompt.ERROR_VENDOR ->
                "Erreur du fabricant"
            BiometricPrompt.ERROR_LOCKOUT_PERMANENT ->
                "Verrouillage permanent. Utilisez votre code PIN"
            BiometricPrompt.ERROR_USER_CANCELED ->
                "Annulé par l'utilisateur"
            BiometricPrompt.ERROR_NO_BIOMETRICS ->
                "Aucune biométrie configurée"
            BiometricPrompt.ERROR_HW_NOT_PRESENT ->
                "Pas de matériel biométrique"
            BiometricPrompt.ERROR_NEGATIVE_BUTTON ->
                "Bouton Annuler appuyé"
            BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL ->
                "Aucun code PIN configuré"
            BiometricPrompt.ERROR_SECURITY_UPDATE_REQUIRED ->
                "Mise à jour de sécurité requise"
            else -> "Erreur d'authentification ($errorCode)"
        }
    }
}

/**
 * Disponibilité de la biométrie
 */
enum class BiometricAvailability {
    AVAILABLE,                      // Disponible et prêt
    NO_HARDWARE,                    // Pas de capteur biométrique
    HARDWARE_UNAVAILABLE,           // Capteur temporairement indisponible
    NONE_ENROLLED,                  // Pas de biométrie enregistrée
    SECURITY_UPDATE_REQUIRED,       // Mise à jour système requise
    UNSUPPORTED,                    // Non supporté
    UNKNOWN                         // État inconnu
}

/**
 * Résultat d'authentification biométrique
 */
sealed class BiometricResult {
    data class Success(val result: BiometricPrompt.AuthenticationResult) : BiometricResult()
    data class Error(val errorCode: Int, val message: String) : BiometricResult()
    object Failure : BiometricResult()
    object Cancelled : BiometricResult()
}
