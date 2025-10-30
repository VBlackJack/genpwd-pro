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
     * Obtient un message d'erreur détaillé et actionnable
     */
    fun getErrorMessage(errorCode: Int): String {
        return when (errorCode) {
            BiometricPrompt.ERROR_HW_UNAVAILABLE ->
                "Capteur biométrique temporairement indisponible.\n\n" +
                "Le capteur est peut-être utilisé par une autre application. Réessayez dans quelques instants."

            BiometricPrompt.ERROR_UNABLE_TO_PROCESS ->
                "Impossible de traiter votre biométrie.\n\n" +
                "Le capteur n'a pas pu lire correctement votre empreinte ou votre visage. Assurez-vous que le capteur est propre et bien positionné, puis réessayez."

            BiometricPrompt.ERROR_TIMEOUT ->
                "Temps d'authentification expiré.\n\n" +
                "L'authentification n'a pas été complétée dans le délai imparti. Veuillez réessayer."

            BiometricPrompt.ERROR_NO_SPACE ->
                "Espace de stockage insuffisant.\n\n" +
                "Votre appareil manque d'espace pour effectuer cette opération. Libérez de l'espace et réessayez."

            BiometricPrompt.ERROR_CANCELED ->
                "Opération annulée."

            BiometricPrompt.ERROR_LOCKOUT ->
                "Trop de tentatives échouées.\n\n" +
                "Pour votre sécurité, la biométrie est temporairement bloquée. Attendez 30 secondes avant de réessayer."

            BiometricPrompt.ERROR_VENDOR ->
                "Erreur du capteur biométrique.\n\n" +
                "Le capteur a rencontré une erreur spécifique au fabricant. Redémarrez votre appareil et réessayez."

            BiometricPrompt.ERROR_LOCKOUT_PERMANENT ->
                "Biométrie verrouillée après trop de tentatives.\n\n" +
                "Déverrouillez d'abord votre appareil avec votre code PIN ou mot de passe, puis réessayez."

            BiometricPrompt.ERROR_USER_CANCELED ->
                "Authentification annulée.\n\n" +
                "Vous pouvez réessayer ou utiliser votre mot de passe principal."

            BiometricPrompt.ERROR_NO_BIOMETRICS ->
                "Aucune biométrie enregistrée.\n\n" +
                "Pour utiliser cette fonction, configurez d'abord une empreinte digitale ou reconnaissance faciale dans les paramètres de votre appareil."

            BiometricPrompt.ERROR_HW_NOT_PRESENT ->
                "Capteur biométrique non disponible.\n\n" +
                "Votre appareil ne dispose pas de capteur biométrique. Utilisez votre mot de passe principal."

            BiometricPrompt.ERROR_NEGATIVE_BUTTON ->
                "Authentification annulée."

            BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL ->
                "Aucun code de sécurité configuré.\n\n" +
                "Pour utiliser cette fonction, configurez un code PIN, schéma ou mot de passe dans les paramètres de sécurité de votre appareil."

            BiometricPrompt.ERROR_SECURITY_UPDATE_REQUIRED ->
                "Mise à jour de sécurité requise.\n\n" +
                "Pour des raisons de sécurité, vous devez mettre à jour votre système Android avant d'utiliser la biométrie."

            else ->
                "Échec de l'authentification biométrique.\n\n" +
                "Une erreur inattendue s'est produite (code: $errorCode). Utilisez votre mot de passe principal."
        }
    }

    /**
     * Obtient un message court pour affichage dans un Snackbar
     */
    fun getShortErrorMessage(errorCode: Int): String {
        return when (errorCode) {
            BiometricPrompt.ERROR_HW_UNAVAILABLE -> "Capteur temporairement indisponible"
            BiometricPrompt.ERROR_UNABLE_TO_PROCESS -> "Impossible de lire la biométrie"
            BiometricPrompt.ERROR_TIMEOUT -> "Temps expiré"
            BiometricPrompt.ERROR_NO_SPACE -> "Espace insuffisant"
            BiometricPrompt.ERROR_CANCELED -> "Opération annulée"
            BiometricPrompt.ERROR_LOCKOUT -> "Trop de tentatives"
            BiometricPrompt.ERROR_VENDOR -> "Erreur du capteur"
            BiometricPrompt.ERROR_LOCKOUT_PERMANENT -> "Biométrie verrouillée"
            BiometricPrompt.ERROR_USER_CANCELED -> "Annulé"
            BiometricPrompt.ERROR_NO_BIOMETRICS -> "Aucune biométrie enregistrée"
            BiometricPrompt.ERROR_HW_NOT_PRESENT -> "Pas de capteur biométrique"
            BiometricPrompt.ERROR_NEGATIVE_BUTTON -> "Annulé"
            BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL -> "Aucun code PIN"
            BiometricPrompt.ERROR_SECURITY_UPDATE_REQUIRED -> "Mise à jour requise"
            else -> "Échec de l'authentification"
        }
    }

    /**
     * Obtient un message descriptif pour l'état de disponibilité biométrique
     */
    fun getAvailabilityMessage(availability: BiometricAvailability): String {
        return when (availability) {
            BiometricAvailability.AVAILABLE ->
                "Biométrie disponible et prête à l'emploi"

            BiometricAvailability.NO_HARDWARE ->
                "Votre appareil ne dispose pas de capteur biométrique.\n\n" +
                "Vous ne pourrez pas utiliser le déverrouillage par empreinte digitale ou reconnaissance faciale."

            BiometricAvailability.HARDWARE_UNAVAILABLE ->
                "Capteur biométrique temporairement indisponible.\n\n" +
                "Le capteur est peut-être en cours d'utilisation. Réessayez dans quelques instants."

            BiometricAvailability.NONE_ENROLLED ->
                "Aucune biométrie enregistrée.\n\n" +
                "Pour activer le déverrouillage biométrique, configurez d'abord une empreinte digitale ou reconnaissance faciale dans les paramètres de votre appareil."

            BiometricAvailability.SECURITY_UPDATE_REQUIRED ->
                "Mise à jour de sécurité requise.\n\n" +
                "Votre système Android nécessite une mise à jour de sécurité avant de pouvoir utiliser la biométrie."

            BiometricAvailability.UNSUPPORTED ->
                "Biométrie non supportée.\n\n" +
                "Votre appareil ou version Android ne supporte pas l'authentification biométrique forte."

            BiometricAvailability.UNKNOWN ->
                "État de la biométrie inconnu.\n\n" +
                "Impossible de déterminer si la biométrie est disponible sur cet appareil."
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
