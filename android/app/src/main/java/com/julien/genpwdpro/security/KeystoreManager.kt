package com.julien.genpwd-pro.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Gestionnaire Android Keystore
 *
 * Android Keystore avantages:
 * - Stockage matériel sécurisé (TEE/Secure Element)
 * - Clés non extractibles
 * - Protection contre les attaques par force brute
 * - Invalidation automatique si l'appareil est déverrouillé
 * - Support de la biométrie
 *
 * Algorithme: AES-256-GCM (AEAD)
 * Taille de clé: 256 bits
 * Mode: GCM (Galois/Counter Mode)
 * Padding: NoPadding (GCM inclut l'authentification)
 */
@Singleton
class KeystoreManager @Inject constructor() {

    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val ENCRYPTION_ALGORITHM = KeyProperties.KEY_ALGORITHM_AES
        private const val BLOCK_MODE = KeyProperties.BLOCK_MODE_GCM
        private const val PADDING = KeyProperties.ENCRYPTION_PADDING_NONE
        private const val TRANSFORMATION = "$ENCRYPTION_ALGORITHM/$BLOCK_MODE/$PADDING"
        private const val KEY_SIZE = 256
        private const val TAG_SIZE = 128
        private const val IV_SIZE = 12 // 96 bits

        // Noms des clés dans le Keystore
        private const val MASTER_KEY_ALIAS = "genpwd_master_key"
        private const val SYNC_KEY_ALIAS = "genpwd_sync_key"
        private const val APP_LOCK_KEY_ALIAS = "genpwd_app_lock_key"
    }

    private val keyStore: KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply {
        load(null)
    }

    /**
     * Génère ou récupère la clé maître pour l'application
     * Cette clé est utilisée pour chiffrer les données sensibles locales
     *
     * @param requireBiometric Si true, la clé nécessite l'authentification biométrique
     * @param userAuthenticationValiditySeconds Durée de validité après auth (0 = toujours)
     */
    fun getMasterKey(
        requireBiometric: Boolean = false,
        userAuthenticationValiditySeconds: Int = 0
    ): SecretKey {
        return getOrCreateKey(
            alias = MASTER_KEY_ALIAS,
            requireBiometric = requireBiometric,
            userAuthenticationValiditySeconds = userAuthenticationValiditySeconds
        )
    }

    /**
     * Génère ou récupère la clé de synchronisation cloud
     */
    fun getSyncKey(): SecretKey {
        return getOrCreateKey(
            alias = SYNC_KEY_ALIAS,
            requireBiometric = false
        )
    }

    /**
     * Génère ou récupère la clé de verrouillage de l'application
     * Requiert l'authentification biométrique
     */
    fun getAppLockKey(): SecretKey {
        return getOrCreateKey(
            alias = APP_LOCK_KEY_ALIAS,
            requireBiometric = true,
            userAuthenticationValiditySeconds = 30 // Valide 30 secondes après auth
        )
    }

    /**
     * Génère ou récupère une clé depuis le Keystore
     */
    private fun getOrCreateKey(
        alias: String,
        requireBiometric: Boolean = false,
        userAuthenticationValiditySeconds: Int = 0
    ): SecretKey {
        // Vérifier si la clé existe déjà
        if (keyStore.containsAlias(alias)) {
            val entry = keyStore.getEntry(alias, null) as KeyStore.SecretKeyEntry
            return entry.secretKey
        }

        // Créer une nouvelle clé
        val keyGenerator = KeyGenerator.getInstance(
            ENCRYPTION_ALGORITHM,
            ANDROID_KEYSTORE
        )

        val builder = KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(BLOCK_MODE)
            .setEncryptionPaddings(PADDING)
            .setKeySize(KEY_SIZE)
            .setRandomizedEncryptionRequired(true) // IV aléatoire requis

        // Configuration de l'authentification utilisateur
        if (requireBiometric || userAuthenticationValiditySeconds > 0) {
            builder.setUserAuthenticationRequired(true)

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                // Android 11+: Authentification biométrique forte
                builder.setUserAuthenticationParameters(
                    userAuthenticationValiditySeconds,
                    KeyProperties.AUTH_BIOMETRIC_STRONG
                )
            } else {
                // Android 9-10: Délai de validité uniquement
                builder.setUserAuthenticationValidityDurationSeconds(
                    userAuthenticationValiditySeconds
                )
            }
        }

        keyGenerator.init(builder.build())
        return keyGenerator.generateKey()
    }

    /**
     * Obtient un Cipher configuré pour le chiffrement
     * À utiliser avec BiometricPrompt.CryptoObject si authentification requise
     */
    fun getEncryptCipher(alias: String = MASTER_KEY_ALIAS): Cipher {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        val key = getOrCreateKey(alias)
        cipher.init(Cipher.ENCRYPT_MODE, key)
        return cipher
    }

    /**
     * Obtient un Cipher configuré pour le déchiffrement
     * À utiliser avec BiometricPrompt.CryptoObject si authentification requise
     */
    fun getDecryptCipher(alias: String = MASTER_KEY_ALIAS, iv: ByteArray): Cipher {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        val key = getOrCreateKey(alias)
        val spec = GCMParameterSpec(TAG_SIZE, iv)
        cipher.init(Cipher.DECRYPT_MODE, key, spec)
        return cipher
    }

    /**
     * Chiffre des données avec une clé du Keystore
     */
    fun encrypt(data: ByteArray, alias: String = MASTER_KEY_ALIAS): EncryptedKeystoreData {
        val cipher = getEncryptCipher(alias)
        val ciphertext = cipher.doFinal(data)
        val iv = cipher.iv

        return EncryptedKeystoreData(
            ciphertext = ciphertext,
            iv = iv,
            keyAlias = alias
        )
    }

    /**
     * Déchiffre des données avec une clé du Keystore
     */
    fun decrypt(encryptedData: EncryptedKeystoreData): ByteArray {
        val cipher = getDecryptCipher(encryptedData.keyAlias, encryptedData.iv)
        return cipher.doFinal(encryptedData.ciphertext)
    }

    /**
     * Chiffre une chaîne de caractères
     */
    fun encryptString(plaintext: String, alias: String = MASTER_KEY_ALIAS): EncryptedKeystoreData {
        return encrypt(plaintext.toByteArray(Charsets.UTF_8), alias)
    }

    /**
     * Déchiffre une chaîne de caractères
     */
    fun decryptString(encryptedData: EncryptedKeystoreData): String {
        val plaintext = decrypt(encryptedData)
        return String(plaintext, Charsets.UTF_8)
    }

    /**
     * Supprime une clé du Keystore
     */
    fun deleteKey(alias: String) {
        if (keyStore.containsAlias(alias)) {
            keyStore.deleteEntry(alias)
        }
    }

    /**
     * Supprime toutes les clés de l'application
     */
    fun deleteAllKeys() {
        listOf(MASTER_KEY_ALIAS, SYNC_KEY_ALIAS, APP_LOCK_KEY_ALIAS).forEach { alias ->
            deleteKey(alias)
        }
    }

    /**
     * Vérifie si une clé existe
     */
    fun hasKey(alias: String): Boolean {
        return keyStore.containsAlias(alias)
    }

    /**
     * Liste toutes les clés de l'application
     */
    fun listKeys(): List<String> {
        return keyStore.aliases().toList().filter {
            it.startsWith("genpwd_")
        }
    }

    /**
     * Vérifie si le Keystore matériel est disponible
     */
    fun isHardwareBackedKeystore(): Boolean {
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            try {
                val key = getMasterKey()
                val keyFactory = javax.crypto.SecretKeyFactory.getInstance(
                    key.algorithm,
                    ANDROID_KEYSTORE
                )
                val keyInfo = keyFactory.getKeySpec(
                    key,
                    android.security.keystore.KeyInfo::class.java
                ) as android.security.keystore.KeyInfo

                // Vérifier si la clé est dans un environnement sécurisé (TEE/SE)
                keyInfo.isInsideSecureHardware
            } catch (e: Exception) {
                false
            }
        } else {
            false
        }
    }
}

/**
 * Données chiffrées par le Keystore
 */
data class EncryptedKeystoreData(
    val ciphertext: ByteArray,
    val iv: ByteArray,
    val keyAlias: String
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as EncryptedKeystoreData

        if (!ciphertext.contentEquals(other.ciphertext)) return false
        if (!iv.contentEquals(other.iv)) return false
        if (keyAlias != other.keyAlias) return false

        return true
    }

    override fun hashCode(): Int {
        var result = ciphertext.contentHashCode()
        result = 31 * result + iv.contentHashCode()
        result = 31 * result + keyAlias.hashCode()
        return result
    }
}
