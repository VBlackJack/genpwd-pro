package com.julien.genpwdpro.data.crypto

import android.util.Base64
import com.goterl.lazysodium.LazySodiumAndroid
import com.goterl.lazysodium.SodiumAndroid
import com.goterl.lazysodium.interfaces.PwHash
import com.sun.jna.NativeLong
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Gestionnaire de cryptographie pour les vaults
 *
 * Utilise:
 * - Argon2id (via Lazysodium/libsodium) pour la dérivation de clé du master password
 * - AES-256-GCM pour le chiffrement des données sensibles
 */
@Singleton
class VaultCryptoManager @Inject constructor() {

    companion object {
        private const val AES_KEY_SIZE = 256
        private const val GCM_IV_LENGTH = 12
        private const val GCM_TAG_LENGTH = 128
        private const val SALT_LENGTH = 32 // libsodium uses 16 bytes for Argon2, but we keep 32 for compatibility

        // Argon2id parameters (mapped to libsodium constants)
        // Using MODERATE preset: balance between security and performance
        private const val ARGON2_OPS_LIMIT = 3L // PwHash.OPSLIMIT_MODERATE value
        private const val ARGON2_MEM_LIMIT = 268435456L // PwHash.MEMLIMIT_MODERATE value (256 MB)
    }

    private val lazySodium: LazySodiumAndroid = LazySodiumAndroid(SodiumAndroid())
    private val secureRandom = SecureRandom()

    /**
     * Paramètres de configuration Argon2id
     * Note: Lazysodium uses opsLimit and memLimit instead of iterations/memory/parallelism
     */
    data class Argon2Params(
        val opsLimit: Long = ARGON2_OPS_LIMIT,
        val memLimit: Long = ARGON2_MEM_LIMIT,
        // Legacy fields for compatibility with database (VaultEntity)
        val iterations: Int = 3,
        val memory: Int = 65536,
        val parallelism: Int = 4
    )

    /**
     * Résultat de la création d'un vault avec toutes les données nécessaires
     */
    data class VaultCreationResult(
        val salt: String,                    // Hex string
        val masterPasswordHash: String,      // Argon2id hash
        val encryptedKey: String,            // Clé de chiffrement chiffrée (hex)
        val keyIv: String,                   // IV pour la clé (hex)
        val derivedKey: SecretKey            // Clé dérivée (à ne pas stocker!)
    )

    /**
     * Génère un salt aléatoire
     */
    fun generateSalt(): ByteArray {
        val salt = ByteArray(SALT_LENGTH)
        secureRandom.nextBytes(salt)
        return salt
    }

    /**
     * Génère un IV aléatoire pour GCM
     */
    fun generateIV(): ByteArray {
        val iv = ByteArray(GCM_IV_LENGTH)
        secureRandom.nextBytes(iv)
        return iv
    }

    /**
     * Génère une clé AES-256 aléatoire
     */
    fun generateAESKey(): SecretKey {
        val keyGenerator = KeyGenerator.getInstance("AES")
        keyGenerator.init(AES_KEY_SIZE, secureRandom)
        return keyGenerator.generateKey()
    }

    /**
     * Dérive une clé depuis un master password avec Argon2id
     *
     * @param masterPassword Le mot de passe maître
     * @param salt Le salt (32 bytes, only first 16 used for libsodium)
     * @param params Paramètres Argon2id
     * @return Clé dérivée de 32 bytes (256 bits)
     */
    fun deriveKey(
        masterPassword: String,
        salt: ByteArray,
        params: Argon2Params = Argon2Params()
    ): SecretKey {
        require(salt.size >= PwHash.SALTBYTES) { "Salt must be at least ${PwHash.SALTBYTES} bytes" }

        // Lazysodium requires exactly 16 bytes for Argon2 salt
        val sodiumSalt = salt.copyOf(PwHash.SALTBYTES)

        // Derive 32 bytes for AES-256 key
        val derivedKey = ByteArray(32)
        val passwordBytes = masterPassword.toByteArray(Charsets.UTF_8)

        val success = lazySodium.cryptoPwHash(
            derivedKey,
            derivedKey.size,
            passwordBytes,
            passwordBytes.size,
            sodiumSalt,
            NativeLong(params.opsLimit),
            NativeLong(params.memLimit),
            PwHash.Alg.PWHASH_ALG_ARGON2ID13
        )

        require(success) { "Failed to derive key with Argon2id" }

        return SecretKeySpec(derivedKey, "AES")
    }

    /**
     * Crée un hash Argon2id du master password (pour vérification)
     * Note: salt parameter kept for API compatibility but cryptoPwHashStr generates its own salt internally
     */
    fun hashPassword(
        masterPassword: String,
        salt: ByteArray,
        params: Argon2Params = Argon2Params()
    ): String {
        // cryptoPwHashStr returns an encoded hash string compatible with libsodium
        // Format: $argon2id$v=19$m=65536,t=2,p=1$<salt>$<hash>
        val hash = lazySodium.cryptoPwHashStr(
            masterPassword,
            NativeLong(params.opsLimit),
            NativeLong(params.memLimit)
        )

        return hash ?: throw IllegalStateException("Failed to hash password with Argon2id")
    }

    /**
     * Vérifie un master password contre son hash
     */
    fun verifyPassword(hash: String, masterPassword: String): Boolean {
        return try {
            lazySodium.cryptoPwHashStrVerify(hash, masterPassword)
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Crée un nouveau vault avec toutes les clés nécessaires
     *
     * Cette fonction:
     * 1. Génère un salt aléatoire
     * 2. Dérive une clé depuis le master password (Argon2id)
     * 3. Génère une clé de chiffrement AES-256 aléatoire
     * 4. Chiffre la clé AES avec la clé dérivée
     * 5. Hash le master password pour vérification future
     *
     * @param masterPassword Le mot de passe maître du vault
     * @param params Paramètres Argon2id
     * @return VaultCreationResult avec toutes les données à stocker
     */
    fun createVault(
        masterPassword: String,
        params: Argon2Params = Argon2Params()
    ): VaultCreationResult {
        // 1. Générer un salt aléatoire
        val salt = generateSalt()

        // 2. Dériver une clé depuis le master password
        val derivedKey = deriveKey(masterPassword, salt, params)

        // 3. Générer une clé de chiffrement aléatoire (celle-ci sera utilisée pour chiffrer les données)
        val vaultKey = generateAESKey()

        // 4. Chiffrer la clé de vault avec la clé dérivée
        val keyIv = generateIV()
        val encryptedKeyBytes = encryptAESGCM(vaultKey.encoded, derivedKey, keyIv)

        // 5. Hash le master password pour vérification
        val passwordHash = hashPassword(masterPassword, salt, params)

        return VaultCreationResult(
            salt = bytesToHex(salt),
            masterPasswordHash = passwordHash,
            encryptedKey = bytesToHex(encryptedKeyBytes),
            keyIv = bytesToHex(keyIv),
            derivedKey = derivedKey
        )
    }

    /**
     * Déverrouille un vault existant
     *
     * @param masterPassword Le mot de passe maître
     * @param salt Le salt stocké (hex string)
     * @param encryptedKey La clé chiffrée (hex string)
     * @param keyIv L'IV de la clé (hex string)
     * @param params Paramètres Argon2id
     * @return La clé de vault déchiffrée, ou null si le mot de passe est incorrect
     */
    fun unlockVault(
        masterPassword: String,
        salt: String,
        encryptedKey: String,
        keyIv: String,
        params: Argon2Params = Argon2Params()
    ): SecretKey? {
        return try {
            // 1. Dériver la clé depuis le master password
            val derivedKey = deriveKey(masterPassword, hexToBytes(salt), params)

            // 2. Déchiffrer la clé de vault
            val vaultKeyBytes = decryptAESGCM(
                hexToBytes(encryptedKey),
                derivedKey,
                hexToBytes(keyIv)
            )

            // 3. Créer la clé secrète
            SecretKeySpec(vaultKeyBytes, "AES")
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Chiffre des données avec AES-256-GCM
     *
     * @param plaintext Données à chiffrer
     * @param key Clé de chiffrement
     * @param iv IV (12 bytes)
     * @return Données chiffrées (contient le tag d'authentification)
     */
    fun encryptAESGCM(plaintext: ByteArray, key: SecretKey, iv: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val parameterSpec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
        cipher.init(Cipher.ENCRYPT_MODE, key, parameterSpec)
        return cipher.doFinal(plaintext)
    }

    /**
     * Chiffre une chaîne de caractères avec AES-256-GCM
     */
    fun encryptString(plaintext: String, key: SecretKey, iv: ByteArray): ByteArray {
        return encryptAESGCM(plaintext.toByteArray(Charsets.UTF_8), key, iv)
    }

    /**
     * Déchiffre des données avec AES-256-GCM
     *
     * @param ciphertext Données chiffrées
     * @param key Clé de déchiffrement
     * @param iv IV (12 bytes)
     * @return Données déchiffrées
     * @throws javax.crypto.AEADBadTagException si le tag d'authentification est invalide
     */
    fun decryptAESGCM(ciphertext: ByteArray, key: SecretKey, iv: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val parameterSpec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
        cipher.init(Cipher.DECRYPT_MODE, key, parameterSpec)
        return cipher.doFinal(ciphertext)
    }

    /**
     * Déchiffre vers une chaîne de caractères
     */
    fun decryptString(ciphertext: ByteArray, key: SecretKey, iv: ByteArray): String {
        val decrypted = decryptAESGCM(ciphertext, key, iv)
        return String(decrypted, Charsets.UTF_8)
    }

    /**
     * Convertit bytes → hex string
     */
    fun bytesToHex(bytes: ByteArray): String {
        return bytes.joinToString("") { "%02x".format(it) }
    }

    /**
     * Convertit hex string → bytes
     */
    fun hexToBytes(hex: String): ByteArray {
        require(hex.length % 2 == 0) { "Hex string must have even length" }
        return hex.chunked(2)
            .map { it.toInt(16).toByte() }
            .toByteArray()
    }

    /**
     * Convertit bytes → Base64
     */
    fun bytesToBase64(bytes: ByteArray): String {
        return Base64.encodeToString(bytes, Base64.NO_WRAP)
    }

    /**
     * Convertit Base64 → bytes
     */
    fun base64ToBytes(base64: String): ByteArray {
        return Base64.decode(base64, Base64.NO_WRAP)
    }

    /**
     * Nettoie la mémoire (wipe les clés sensibles)
     */
    fun wipeKey(key: SecretKey) {
        val encoded = key.encoded
        encoded.fill(0)
    }

    /**
     * Nettoie un char array (pour les mots de passe)
     */
    fun wipePassword(password: CharArray) {
        password.fill(0.toChar())
    }
}
