package com.julien.genpwdpro.data.encryption

import android.util.Base64
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import javax.inject.Inject
import com.julien.genpwdpro.core.crypto.SecretUtils

/**
 * Gestionnaire de chiffrement AES-256-GCM pour la synchronisation cloud
 *
 * AES-256-GCM Features:
 * - Authenticated encryption (AEAD)
 * - 256-bit key size
 * - 96-bit IV (Initialization Vector)
 * - 128-bit authentication tag
 * - Secure against tampering and replay attacks
 */
class EncryptionManager @Inject constructor() {

    companion object {
        const val CRYPTO_VERSION = 1
        private const val ALGORITHM = "AES"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val KEY_SIZE = 256 // bits
        private const val IV_SIZE = 12 // bytes (96 bits)
        private const val TAG_SIZE = 128 // bits
        const val KDF_ALGORITHM = "PBKDF2WithHmacSHA256"
        const val MIN_KDF_ITERATIONS = 310_000
        const val DEFAULT_KDF_ITERATIONS = 310_000
    }

    /**
     * Génère une nouvelle clé AES-256 aléatoire
     */
    fun generateKey(): SecretKey {
        val keyGenerator = KeyGenerator.getInstance(ALGORITHM)
        keyGenerator.init(KEY_SIZE, SecureRandom())
        return keyGenerator.generateKey()
    }

    /**
     * Encode une clé en Base64 pour stockage/transmission
     */
    fun encodeKey(key: SecretKey): String {
        return Base64.encodeToString(key.encoded, Base64.NO_WRAP)
    }

    /**
     * Décode une clé depuis Base64
     */
    fun decodeKey(encodedKey: String): SecretKey {
        val keyBytes = Base64.decode(encodedKey, Base64.NO_WRAP)
        return try {
            SecretKeySpec(keyBytes, ALGORITHM)
        } finally {
            SecretUtils.wipe(keyBytes)
        }
    }

    /**
     * Chiffre des données avec AES-256-GCM
     *
     * @param plaintext Données à chiffrer
     * @param key Clé de chiffrement AES-256
     * @return EncryptedData contenant le ciphertext et l'IV
     */
    fun encrypt(plaintext: ByteArray, key: SecretKey): EncryptedData {
        // Générer un IV aléatoire unique pour chaque chiffrement
        val iv = ByteArray(IV_SIZE)
        SecureRandom().nextBytes(iv)

        // Initialiser le cipher en mode chiffrement
        val cipher = Cipher.getInstance(TRANSFORMATION)
        val gcmSpec = GCMParameterSpec(TAG_SIZE, iv)
        cipher.init(Cipher.ENCRYPT_MODE, key, gcmSpec)

        // Chiffrer les données
        val ciphertext = cipher.doFinal(plaintext)

        return EncryptedData(
            ciphertext = ciphertext,
            iv = iv
        )
    }

    /**
     * Chiffre une chaîne de caractères
     */
    fun encryptString(plaintext: String, key: SecretKey): EncryptedData {
        val bytes = plaintext.toByteArray(Charsets.UTF_8)
        return try {
            encrypt(bytes, key)
        } finally {
            SecretUtils.wipe(bytes)
        }
    }

    /**
     * Déchiffre des données avec AES-256-GCM
     *
     * @param encryptedData Données chiffrées avec IV
     * @param key Clé de déchiffrement AES-256
     * @return Données déchiffrées
     * @throws javax.crypto.AEADBadTagException si les données ont été altérées
     */
    fun decrypt(encryptedData: EncryptedData, key: SecretKey): ByteArray {
        // Initialiser le cipher en mode déchiffrement
        val cipher = Cipher.getInstance(TRANSFORMATION)
        val gcmSpec = GCMParameterSpec(TAG_SIZE, encryptedData.iv)
        cipher.init(Cipher.DECRYPT_MODE, key, gcmSpec)

        // Déchiffrer les données
        return cipher.doFinal(encryptedData.ciphertext)
    }

    /**
     * Déchiffre une chaîne de caractères
     */
    fun decryptString(encryptedData: EncryptedData, key: SecretKey): String {
        val plaintext = decrypt(encryptedData, key)
        return try {
            String(plaintext, Charsets.UTF_8)
        } finally {
            SecretUtils.wipe(plaintext)
        }
    }

    /**
     * Vérifie l'intégrité des données sans les déchiffrer
     * Utile pour valider avant synchronisation
     */
    fun verifyIntegrity(encryptedData: EncryptedData, key: SecretKey): Boolean {
        return try {
            decrypt(encryptedData, key)
            true
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Dérive une clé depuis un mot de passe utilisateur (PBKDF2)
     * NOTE: Pour production, utiliser plutôt Android Keystore
     */
    fun deriveKeyFromPassword(
        password: String,
        salt: ByteArray,
        iterations: Int = DEFAULT_KDF_ITERATIONS
    ): SecretKey {
        require(iterations >= MIN_KDF_ITERATIONS) {
            "KDF iterations ($iterations) below required floor $MIN_KDF_ITERATIONS"
        }

        val factory = javax.crypto.SecretKeyFactory.getInstance(KDF_ALGORITHM)
        val passwordChars = password.toCharArray()
        val spec = javax.crypto.spec.PBEKeySpec(
            passwordChars,
            salt,
            iterations,
            KEY_SIZE
        )
        return try {
            val tmp = factory.generateSecret(spec)
            val encoded = tmp.encoded
            try {
                SecretKeySpec(encoded, ALGORITHM)
            } finally {
                SecretUtils.wipe(encoded)
            }
        } finally {
            spec.clearPassword()
            SecretUtils.wipe(passwordChars)
        }
    }

    /**
     * Build a serialisable metadata header (JSON/TLV/etc.) pairing with [EncryptedData].
     *
     * The header must include:
     * - version ([CRYPTO_VERSION])
     * - KDF algorithm + iterations
     * - salt (Base64) used for key derivation
     * - nonce/IV (Base64) used for AES-GCM
     */
    fun buildMetadataHeader(iv: ByteArray, salt: ByteArray, iterations: Int = DEFAULT_KDF_ITERATIONS): EncryptionMetadata {
        require(iv.size == IV_SIZE) { "Nonce must be $IV_SIZE bytes" }
        require(iterations >= MIN_KDF_ITERATIONS) { "KDF iterations below security floor" }
        return EncryptionMetadata(
            version = CRYPTO_VERSION,
            kdf = EncryptionMetadata.KdfMetadata(KDF_ALGORITHM, iterations),
            salt = Base64.encodeToString(salt, Base64.NO_WRAP),
            nonce = Base64.encodeToString(iv, Base64.NO_WRAP)
        )
    }

    /**
     * Génère un salt aléatoire pour PBKDF2
     */
    fun generateSalt(size: Int = 32): ByteArray {
        val salt = ByteArray(size)
        SecureRandom().nextBytes(salt)
        return salt
    }
}

/**
 * Données chiffrées avec AES-256-GCM.
 *
 * Ce conteneur doit être stocké avec un en-tête structuré (JSON/TLV) généré via
 * [EncryptionManager.buildMetadataHeader] qui encode la version (`v`), la stratégie KDF,
 * le salt et le nonce (IV 96 bits). Aucun Additional Authenticated Data (AAD) n'est utilisé
 * pour l'instant, mais l'en-tête doit être protégé via le tag GCM côté stockage.
 */
data class EncryptedData(
    val ciphertext: ByteArray,
    val iv: ByteArray
) {
    /**
     * Encode en Base64 pour stockage/transmission
     */
    fun toBase64(): EncryptedDataEncoded {
        return EncryptedDataEncoded(
            ciphertext = Base64.encodeToString(ciphertext, Base64.NO_WRAP),
            iv = Base64.encodeToString(iv, Base64.NO_WRAP)
        )
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as EncryptedData

        if (!ciphertext.contentEquals(other.ciphertext)) return false
        if (!iv.contentEquals(other.iv)) return false

        return true
    }

    override fun hashCode(): Int {
        var result = ciphertext.contentHashCode()
        result = 31 * result + iv.contentHashCode()
        return result
    }
}

/**
 * Données chiffrées encodées en Base64 (pour JSON/DB)
 */
data class EncryptedDataEncoded(
    val ciphertext: String,
    val iv: String
) {
    /**
     * Décode depuis Base64
     */
    fun toEncryptedData(): EncryptedData {
        return EncryptedData(
            ciphertext = Base64.decode(ciphertext, Base64.NO_WRAP),
            iv = Base64.decode(iv, Base64.NO_WRAP)
        )
    }
}

/**
 * Métadonnées de chiffrement sérialisables pour stocker le contexte de dérivation.
 */
data class EncryptionMetadata(
    val version: Int,
    val kdf: KdfMetadata,
    val salt: String,
    val nonce: String
) {
    data class KdfMetadata(
        val algorithm: String,
        val iterations: Int
    )
}
