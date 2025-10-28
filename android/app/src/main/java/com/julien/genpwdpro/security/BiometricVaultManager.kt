package com.julien.genpwdpro.security

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Log
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.julien.genpwdpro.data.local.dao.VaultRegistryDao
import com.julien.genpwdpro.data.local.dao.updateById
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.suspendCancellableCoroutine
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

/**
 * Gestionnaire pour le déverrouillage biométrique des vaults
 *
 * Responsabilités :
 * - Chiffrer le master password avec Android Keystore
 * - Stocker le password chiffré dans vault_registry
 * - Déchiffrer le password avec biométrie pour unlock
 * - Gérer les clés dans Android Keystore
 *
 * Architecture :
 * ```
 * User enables biometric
 *   → Encrypt master password with Keystore key
 *   → Store encrypted password + IV in vault_registry
 *
 * User unlocks with biometric
 *   → Show biometric prompt
 *   → Decrypt password with Keystore key
 *   → Return decrypted password
 *   → VaultSessionManager uses it to unlock vault
 * ```
 *
 * Sécurité :
 * - Clés stockées dans Android Keystore (hardware-backed si dispo)
 * - Clés nécessitent biométrie pour utilisation
 * - AES-256-GCM pour chiffrement
 * - IV unique par vault
 */
@Singleton
class BiometricVaultManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val vaultRegistryDao: VaultRegistryDao
) {
    companion object {
        private const val TAG = "BiometricVaultManager"
        private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
        private const val KEY_PREFIX = "vault_biometric_"
        private const val TRANSFORMATION = "${KeyProperties.KEY_ALGORITHM_AES}/" +
                "${KeyProperties.BLOCK_MODE_GCM}/" +
                "${KeyProperties.ENCRYPTION_PADDING_NONE}"
        private const val GCM_TAG_LENGTH = 128
    }

    private val keyStore: KeyStore by lazy {
        KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
    }

    /**
     * Active le déverrouillage biométrique pour un vault
     *
     * Flow :
     * 1. Génère une clé dans Keystore (ou réutilise existante)
     * 2. Affiche un prompt biométrique pour authentifier l'utilisateur
     * 3. Chiffre le master password avec le cipher authentifié
     * 4. Stocke password chiffré + IV dans vault_registry
     *
     * @param activity FragmentActivity nécessaire pour BiometricPrompt
     * @param vaultId ID du vault
     * @param masterPassword Master password en clair (sera chiffré)
     * @return Result.success si activé, Result.failure si erreur/annulé
     */
    suspend fun enableBiometric(
        activity: FragmentActivity,
        vaultId: String,
        masterPassword: String
    ): Result<Unit> {
        return try {
            Log.d(TAG, "Enabling biometric for vault: $vaultId")

            // 1. Obtenir ou créer la clé Keystore
            val secretKey = getOrCreateKey(vaultId)

            // 2. Préparer le cipher pour chiffrement
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, secretKey)

            // 3. Afficher le prompt biométrique et chiffrer
            val encryptionResult = showBiometricPromptForEncryption(
                activity,
                cipher,
                masterPassword.toByteArray(Charsets.UTF_8)
            )

            // 4. Mettre à jour vault_registry
            vaultRegistryDao.updateById(vaultId) { entry ->
                entry.copy(
                    biometricUnlockEnabled = true,
                    encryptedMasterPassword = encryptionResult.encryptedData,
                    masterPasswordIv = encryptionResult.iv
                )
            }

            Log.i(TAG, "Biometric enabled successfully for vault: $vaultId")
            Result.success(Unit)

        } catch (e: Exception) {
            Log.e(TAG, "Failed to enable biometric for vault: $vaultId", e)
            Result.failure(e)
        }
    }

    /**
     * Déverrouille un vault avec biométrie
     *
     * Flow :
     * 1. Récupère password chiffré + IV depuis vault_registry
     * 2. Affiche prompt biométrique
     * 3. Déchiffre le password avec la clé Keystore
     * 4. Retourne le password en clair
     *
     * @param activity FragmentActivity nécessaire pour BiometricPrompt
     * @param vaultId ID du vault
     * @return Result.success(password) si déverrouillé, Result.failure si erreur/annulé
     */
    suspend fun unlockWithBiometric(
        activity: FragmentActivity,
        vaultId: String
    ): Result<String> {
        return try {
            Log.d(TAG, "Unlocking vault with biometric: $vaultId")

            // 1. Récupérer les données chiffrées
            val vaultRegistry = vaultRegistryDao.getById(vaultId)
                ?: return Result.failure(IllegalStateException("Vault not found: $vaultId"))

            if (!vaultRegistry.biometricUnlockEnabled) {
                return Result.failure(IllegalStateException("Biometric not enabled for vault: $vaultId"))
            }

            val encryptedPassword = vaultRegistry.encryptedMasterPassword
                ?: return Result.failure(IllegalStateException("Encrypted password not found"))

            val iv = vaultRegistry.masterPasswordIv
                ?: return Result.failure(IllegalStateException("IV not found"))

            // 2. Préparer le cipher pour déchiffrement
            val secretKey = getOrCreateKey(vaultId)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, secretKey, GCMParameterSpec(GCM_TAG_LENGTH, iv))

            // 3. Afficher le prompt biométrique et déchiffrer
            val decryptedPassword = showBiometricPrompt(activity, cipher, encryptedPassword)

            Log.i(TAG, "Vault unlocked successfully with biometric: $vaultId")
            Result.success(decryptedPassword)

        } catch (e: Exception) {
            Log.e(TAG, "Failed to unlock with biometric: $vaultId", e)
            Result.failure(e)
        }
    }

    /**
     * Désactive le déverrouillage biométrique
     *
     * @param vaultId ID du vault
     * @return Result.success si désactivé, Result.failure si erreur
     */
    suspend fun disableBiometric(vaultId: String): Result<Unit> {
        return try {
            Log.d(TAG, "Disabling biometric for vault: $vaultId")

            // Supprimer les données biométriques de vault_registry
            vaultRegistryDao.updateById(vaultId) { entry ->
                entry.copy(
                    biometricUnlockEnabled = false,
                    encryptedMasterPassword = null,
                    masterPasswordIv = null
                )
            }

            // Supprimer la clé du Keystore
            deleteKey(vaultId)

            Log.i(TAG, "Biometric disabled successfully for vault: $vaultId")
            Result.success(Unit)

        } catch (e: Exception) {
            Log.e(TAG, "Failed to disable biometric for vault: $vaultId", e)
            Result.failure(e)
        }
    }

    /**
     * Vérifie si la biométrie STRONG est disponible sur l'appareil
     *
     * IMPORTANT : Nous acceptons UNIQUEMENT BIOMETRIC_STRONG (empreinte Class 3, iris, face 3D)
     * car les opérations cryptographiques avec CryptoObject ne sont pas supportées
     * par BIOMETRIC_WEAK (empreinte Class 2, face 2D).
     *
     * @return true si BIOMETRIC_STRONG disponible, false sinon
     */
    fun isBiometricAvailable(): Boolean {
        return try {
            val biometricManager = androidx.biometric.BiometricManager.from(context)
            val result = biometricManager.canAuthenticate(
                androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
            )
            Log.d(TAG, "Biometric STRONG availability check result: $result")
            result == androidx.biometric.BiometricManager.BIOMETRIC_SUCCESS
        } catch (e: Exception) {
            Log.e(TAG, "Error checking biometric availability", e)
            false
        }
    }

    // ========== Private Methods ==========

    /**
     * Obtient ou crée une clé dans Android Keystore
     */
    private fun getOrCreateKey(vaultId: String): SecretKey {
        val keyAlias = getKeyAlias(vaultId)

        // Vérifier si la clé existe déjà
        if (keyStore.containsAlias(keyAlias)) {
            return keyStore.getKey(keyAlias, null) as SecretKey
        }

        // Créer une nouvelle clé
        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            KEYSTORE_PROVIDER
        )

        val builder = KeyGenParameterSpec.Builder(
            keyAlias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(true) // Nécessite biométrie
            .setInvalidatedByBiometricEnrollment(true) // Invalide si biométrie change

        // Configuration de l'authentification biométrique
        // Timeout = 0 : chaque opération cryptographique nécessite BiometricPrompt
        // Cela permet d'utiliser le CryptoObject dans BiometricPrompt pour l'encryption ET le déchiffrement
        // Note: WEAK biometric est configuré dans BiometricPrompt.PromptInfo, pas dans la clé Keystore
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            // API 30+ : utiliser setUserAuthenticationParameters
            builder.setUserAuthenticationParameters(
                0,  // 0 = nécessite BiometricPrompt pour chaque opération
                KeyProperties.AUTH_BIOMETRIC_STRONG
            )
        } else {
            // API 24-29 : utiliser setUserAuthenticationValidityDurationSeconds
            @Suppress("DEPRECATION")
            builder.setUserAuthenticationValidityDurationSeconds(0)
        }

        val keyGenParameterSpec = builder.build()

        keyGenerator.init(keyGenParameterSpec)
        return keyGenerator.generateKey()
    }

    /**
     * Supprime une clé du Keystore
     */
    private fun deleteKey(vaultId: String) {
        val keyAlias = getKeyAlias(vaultId)
        if (keyStore.containsAlias(keyAlias)) {
            keyStore.deleteEntry(keyAlias)
        }
    }

    /**
     * Génère l'alias de clé pour un vault
     */
    private fun getKeyAlias(vaultId: String): String {
        return "$KEY_PREFIX$vaultId"
    }

    /**
     * Résultat du chiffrement avec biométrie
     */
    private data class EncryptionResult(
        val encryptedData: ByteArray,
        val iv: ByteArray
    )

    /**
     * Affiche le prompt biométrique et chiffre les données
     */
    private suspend fun showBiometricPromptForEncryption(
        activity: FragmentActivity,
        cipher: Cipher,
        plainData: ByteArray
    ): EncryptionResult = suspendCancellableCoroutine { continuation ->

        val executor = ContextCompat.getMainExecutor(activity)

        val biometricPrompt = BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)

                    try {
                        // Chiffrer les données
                        val authenticatedCipher = result.cryptoObject?.cipher
                            ?: throw IllegalStateException("Cipher not available")

                        val encryptedBytes = authenticatedCipher.doFinal(plainData)
                        val iv = authenticatedCipher.iv

                        continuation.resume(EncryptionResult(encryptedBytes, iv))
                    } catch (e: Exception) {
                        Log.e(TAG, "Encryption failed", e)
                        if (continuation.isActive) {
                            continuation.cancel(e)
                        }
                    }
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    Log.w(TAG, "Biometric authentication error: $errString")

                    if (continuation.isActive) {
                        continuation.cancel(
                            Exception("Biometric authentication failed: $errString")
                        )
                    }
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    Log.w(TAG, "Biometric authentication failed")
                    // Ne pas annuler la continuation ici, l'utilisateur peut réessayer
                }
            }
        )

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Activer le déverrouillage biométrique")
            .setSubtitle("Authentifiez-vous pour sécuriser votre coffre")
            .setNegativeButtonText("Annuler")
            .setAllowedAuthenticators(
                androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
            )
            .build()

        val cryptoObject = BiometricPrompt.CryptoObject(cipher)
        biometricPrompt.authenticate(promptInfo, cryptoObject)

        continuation.invokeOnCancellation {
            // Cleanup si la coroutine est annulée
            biometricPrompt.cancelAuthentication()
        }
    }

    /**
     * Affiche le prompt biométrique et déchiffre le password
     */
    private suspend fun showBiometricPrompt(
        activity: FragmentActivity,
        cipher: Cipher,
        encryptedPassword: ByteArray
    ): String = suspendCancellableCoroutine { continuation ->

        val executor = ContextCompat.getMainExecutor(activity)

        val biometricPrompt = BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)

                    try {
                        // Déchiffrer le password
                        val authenticatedCipher = result.cryptoObject?.cipher
                            ?: throw IllegalStateException("Cipher not available")

                        val decryptedBytes = authenticatedCipher.doFinal(encryptedPassword)
                        val password = String(decryptedBytes, Charsets.UTF_8)

                        continuation.resume(password)
                    } catch (e: Exception) {
                        Log.e(TAG, "Decryption failed", e)
                        if (continuation.isActive) {
                            continuation.cancel(e)
                        }
                    }
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    Log.w(TAG, "Biometric authentication error: $errString")

                    if (continuation.isActive) {
                        continuation.cancel(
                            Exception("Biometric authentication failed: $errString")
                        )
                    }
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    Log.w(TAG, "Biometric authentication failed")
                    // Ne pas annuler la continuation ici, l'utilisateur peut réessayer
                }
            }
        )

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Déverrouiller le coffre")
            .setSubtitle("Utilisez votre biométrie pour déverrouiller")
            .setNegativeButtonText("Annuler")
            .setAllowedAuthenticators(
                androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
            )
            .build()

        val cryptoObject = BiometricPrompt.CryptoObject(cipher)
        biometricPrompt.authenticate(promptInfo, cryptoObject)

        continuation.invokeOnCancellation {
            // Cleanup si la coroutine est annulée
            biometricPrompt.cancelAuthentication()
        }
    }
}
