package com.julien.genpwdpro.data.encryption

import android.util.Base64
import com.julien.genpwdpro.core.crypto.SecretUtils
import com.julien.genpwdpro.crypto.CryptoEngine
import com.julien.genpwdpro.crypto.TinkAesGcmCryptoEngine
import java.security.SecureRandom
import javax.crypto.SecretKey
import javax.crypto.spec.SecretKeySpec
import javax.inject.Inject

/**
 * Gestionnaire de chiffrement pour la synchronisation cloud basé sur Google Tink.
 *
 * Le moteur sous-jacent ([CryptoEngine]) repose sur AES-256-GCM et gère les clés via les keysets
 * Tink. Toutes les opérations de chiffrement sont effectuées en mémoire : aucune clé n'est
 * persistée en clair et le moteur prend en charge la rotation des clés.
 */
class EncryptionManager @Inject constructor() {

    companion object {
        const val CRYPTO_VERSION = 1
        const val KDF_ALGORITHM = "PBKDF2WithHmacSHA256"
        const val MIN_KDF_ITERATIONS = 310_000
        const val DEFAULT_KDF_ITERATIONS = 310_000
        private const val KEY_SIZE = 256 // bits
        private const val ALGORITHM = "AES"
    }

    /**
     * Crée un nouveau moteur de chiffrement avec un keyset AES-256-GCM fraîchement généré.
     */
    fun createEngine(): CryptoEngine {
        return TinkAesGcmCryptoEngine.create()
    }

    /**
     * Restaure un moteur depuis un keyset sérialisé.
     */
    fun restoreEngine(serializedKeyset: String): CryptoEngine {
        return TinkAesGcmCryptoEngine.fromSerialized(serializedKeyset)
    }

    /**
     * Sérialise le keyset courant du moteur pour stockage sécurisé.
     */
    fun serializeEngine(engine: CryptoEngine): String {
        return engine.exportKeyset()
    }

    /**
     * Chiffre des données avec le moteur fourni.
     *
     * @param plaintext Données à chiffrer
     * @param engine Moteur Tink (AEAD)
     * @return EncryptedData contenant le ciphertext
     */
    fun encrypt(
        plaintext: ByteArray,
        engine: CryptoEngine,
        associatedData: ByteArray = CryptoEngine.EMPTY_AAD
    ): EncryptedData {
        val ciphertext = engine.encrypt(plaintext, associatedData)
        return EncryptedData(
            ciphertext = ciphertext,
            iv = ByteArray(0)
        )
    }

    /**
     * Chiffre une chaîne de caractères
     */
    fun encryptString(
        plaintext: String,
        engine: CryptoEngine,
        associatedData: ByteArray = CryptoEngine.EMPTY_AAD
    ): EncryptedData {
        val bytes = plaintext.toByteArray(Charsets.UTF_8)
        return try {
            encrypt(bytes, engine, associatedData)
        } finally {
            SecretUtils.wipe(bytes)
        }
    }

    /**
     * Déchiffre des données avec le moteur fourni
     *
     * @param encryptedData Données chiffrées
     * @param engine Moteur Tink (AEAD)
     * @return Données déchiffrées
     * @throws javax.crypto.AEADBadTagException si les données ont été altérées
     */
    fun decrypt(
        encryptedData: EncryptedData,
        engine: CryptoEngine,
        associatedData: ByteArray = CryptoEngine.EMPTY_AAD
    ): ByteArray {
        return engine.decrypt(encryptedData.ciphertext, associatedData)
    }

    /**
     * Déchiffre une chaîne de caractères
     */
    fun decryptString(
        encryptedData: EncryptedData,
        engine: CryptoEngine,
        associatedData: ByteArray = CryptoEngine.EMPTY_AAD
    ): String {
        val plaintext = decrypt(encryptedData, engine, associatedData)
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
    fun verifyIntegrity(
        encryptedData: EncryptedData,
        engine: CryptoEngine,
        associatedData: ByteArray = CryptoEngine.EMPTY_AAD
    ): Boolean {
        return try {
            decrypt(encryptedData, engine, associatedData)
            true
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Effectue une rotation de clé sur le moteur fourni.
     */
    fun rotate(engine: CryptoEngine) {
        engine.rotate()
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
 * Lorsque le chiffrement est effectué par [CryptoEngine], le nonce est déjà encapsulé par Tink
 * dans le ciphertext. Le champ [iv] est donc conservé pour compatibilité avec les anciens formats
 * (et peut être vide lorsque Tink est utilisé).
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
