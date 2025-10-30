package com.julien.genpwdpro.data.crypto

import android.util.Base64
import com.goterl.lazysodium.LazySodiumAndroid
import com.goterl.lazysodium.SodiumAndroid
import com.goterl.lazysodium.interfaces.PwHash
import com.julien.genpwdpro.core.crypto.SecretUtils
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
 * - Argon2id (via Lazysodium) pour la dérivation de clé du master password
 * - AES-256-GCM pour le chiffrement des données sensibles
 */
@Singleton
class VaultCryptoManager @Inject constructor() {

    companion object {
        private const val AES_KEY_SIZE = 256
        private const val GCM_IV_LENGTH = 12
        private const val GCM_TAG_LENGTH = 128
        private const val SALT_LENGTH = 32 // On garde 32 bytes pour compatibilité DB
        private const val LIBSODIUM_SALT_LENGTH = 16 // libsodium utilise 16 bytes
        private const val KEY_LENGTH = 32 // AES-256 = 32 bytes
        private const val ARGON2_ITERATIONS = 3
        private const val ARGON2_MEMORY = 65536 // 64 MB (en KB pour libsodium)
        private const val ARGON2_PARALLELISM = 4

        const val IV_LENGTH = GCM_IV_LENGTH // Export pour VaultFileManager
    }

    private val lazySodium: LazySodiumAndroid = LazySodiumAndroid(SodiumAndroid())
    private val secureRandom = SecureRandom()

    /**
     * Paramètres de configuration Argon2id
     */
    data class Argon2Params(
        val iterations: Int = ARGON2_ITERATIONS,
        val memory: Int = ARGON2_MEMORY,
        val parallelism: Int = ARGON2_PARALLELISM
    )

    /**
     * Résultat de la création d'un vault avec toutes les données nécessaires
     */
    data class VaultCreationResult(
        val salt: String, // Hex string
        val masterPasswordHash: String, // Argon2id hash
        val encryptedKey: String, // Clé de chiffrement chiffrée (hex)
        val keyIv: String, // IV pour la clé (hex)
        val derivedKey: SecretKey // Clé dérivée (à ne pas stocker!)
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
     * ✅ Migré vers Lazysodium-Android (compatible ARM)
     *
     * @param masterPassword Le mot de passe maître
     * @param salt Le salt (32 bytes, on utilise les 16 premiers pour libsodium)
     * @param params Paramètres Argon2id
     * @return Clé dérivée de 32 bytes (256 bits)
     */
    fun deriveKey(
        masterPassword: String,
        salt: ByteArray,
        params: Argon2Params = Argon2Params()
    ): SecretKey {
        require(salt.size == SALT_LENGTH) { "Salt must be $SALT_LENGTH bytes" }

        // libsodium utilise 16 bytes de salt, on prend les 16 premiers de notre salt de 32 bytes
        val libsodiumSalt = salt.copyOf(LIBSODIUM_SALT_LENGTH)

        // Buffer pour la clé dérivée (32 bytes pour AES-256)
        val keyBytes = ByteArray(KEY_LENGTH)
        val passwordBytes = masterPassword.toByteArray(Charsets.UTF_8)

        return try {
            // Conversion des paramètres: memory est en KB, libsodium attend des bytes
            val opsLimit = params.iterations.toLong() // → long
            val memLimit = NativeLong(params.memory.toLong() * 1024L) // → NativeLong (bytes)

            // Dérivation de clé avec Argon2id via l'interface Native
            // Signature: cryptoPwHash(..., long opsLimit, NativeLong memLimit, Alg alg)
            val success = (lazySodium as PwHash.Native).cryptoPwHash(
                keyBytes,
                keyBytes.size, // int, pas toLong()
                passwordBytes,
                passwordBytes.size, // int, pas toLong()
                libsodiumSalt,
                opsLimit, // long
                memLimit, // NativeLong
                PwHash.Alg.PWHASH_ALG_ARGON2ID13
            )

            if (!success) {
                throw IllegalStateException("Argon2id key derivation failed")
            }

            SecretKeySpec(keyBytes, "AES")
        } finally {
            SecretUtils.wipe(passwordBytes)
            SecretUtils.wipe(libsodiumSalt)
            SecretUtils.wipe(keyBytes)
        }
    }

    /**
     * Crée un hash Argon2id du master password (pour vérification)
     *
     * ✅ Migré vers Lazysodium-Android (compatible ARM)
     *
     * Note: Le paramètre salt est conservé pour compatibilité API mais cryptoPwHashStr
     * génère son propre salt interne (inclus dans le hash retourné au format PHC)
     */
    fun hashPassword(
        masterPassword: String,
        salt: ByteArray,
        params: Argon2Params = Argon2Params()
    ): String {
        require(salt.size == SALT_LENGTH) { "Salt must be $SALT_LENGTH bytes" }

        // Conversion des paramètres: memory est en KB, libsodium attend des bytes
        val opsLimit = params.iterations.toLong() // → long
        val memLimit = NativeLong(params.memory.toLong() * 1024L) // → NativeLong (bytes)

        // cryptoPwHashStr génère un hash au format PHC avec salt inclus
        // Le format est: $argon2id$v=19$m=65536,t=3,p=4$[salt]$[hash]
        // Signature: cryptoPwHashStr(String password, long opsLimit, NativeLong memLimit)
        val hashResult = (lazySodium as PwHash.Lazy).cryptoPwHashStr(
            masterPassword,
            opsLimit, // long
            memLimit // NativeLong
        )

        return hashResult ?: throw IllegalStateException("Argon2id password hashing failed")
    }

    /**
     * Vérifie un master password contre son hash
     *
     * ✅ Migré vers Lazysodium-Android (compatible ARM)
     */
    fun verifyPassword(hash: String, masterPassword: String): Boolean {
        return try {
            // cryptoPwHashStrVerify retourne true si le password correspond au hash
            // Utilise l'interface Lazy pour cryptoPwHashStrVerify
            (lazySodium as PwHash.Lazy).cryptoPwHashStrVerify(hash, masterPassword)
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
        val bytes = plaintext.toByteArray(Charsets.UTF_8)
        return try {
            encryptAESGCM(bytes, key, iv)
        } finally {
            SecretUtils.wipe(bytes)
        }
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
        return try {
            String(decrypted, Charsets.UTF_8)
        } finally {
            SecretUtils.wipe(decrypted)
        }
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

    // ========================================
    // Helper Methods for VaultFileManager
    // ========================================

    /**
     * Génère un salt déterministe depuis une chaîne
     * Utile pour utiliser vaultId comme base du salt
     *
     * @param seed Chaîne source (ex: vaultId)
     * @return Salt de 32 bytes déterministe
     */
    fun generateSaltFromString(seed: String): ByteArray {
        val digest = java.security.MessageDigest.getInstance("SHA-256")
        val seedBytes = seed.toByteArray(Charsets.UTF_8)
        return try {
            digest.digest(seedBytes)
        } finally {
            SecretUtils.wipe(seedBytes)
        }
    }

    /**
     * Chiffre des bytes avec génération automatique d'IV
     * Format de retour: IV (12 bytes) + Ciphertext + Tag
     *
     * Inspiré de KeePass KDBX: IV inclus dans le fichier chiffré
     *
     * @param plaintext Données à chiffrer
     * @param key Clé de chiffrement
     * @return IV + données chiffrées (tout-en-un)
     */
    fun encryptBytes(plaintext: ByteArray, key: SecretKey): ByteArray {
        val iv = generateIV()
        val encrypted = encryptAESGCM(plaintext, key, iv)
        // Concat: IV + encrypted (ciphertext + tag)
        return iv + encrypted
    }

    /**
     * Déchiffre des bytes (extrait l'IV automatiquement)
     * Format d'entrée: IV (12 bytes) + Ciphertext + Tag
     *
     * @param ciphertext IV + données chiffrées
     * @param key Clé de déchiffrement
     * @return Données déchiffrées
     * @throws javax.crypto.AEADBadTagException si le tag d'authentification est invalide
     */
    fun decryptBytes(ciphertext: ByteArray, key: SecretKey): ByteArray {
        require(ciphertext.size > IV_LENGTH) { "Ciphertext too short (must contain IV)" }

        val iv = ciphertext.copyOfRange(0, IV_LENGTH)
        val encrypted = ciphertext.copyOfRange(IV_LENGTH, ciphertext.size)
        return decryptAESGCM(encrypted, key, iv)
    }

    /**
     * Hash un fichier avec SHA-256
     * Utile pour les key files (KeePass-style)
     *
     * @param fileContent Contenu du fichier
     * @return Hash SHA-256 (32 bytes)
     */
    fun hashFile(fileContent: ByteArray): ByteArray {
        val digest = java.security.MessageDigest.getInstance("SHA-256")
        return digest.digest(fileContent)
    }

    /**
     * Dérive une clé avec support optionnel de key file (KeePass-style)
     *
     * Si keyFileContent fourni:
     * 1. Hash le password avec SHA-256
     * 2. Hash le key file avec SHA-256
     * 3. Combine les deux hash
     * 4. Utilise le résultat comme input pour Argon2id
     *
     * Inspiré de KeePass: multi-factor authentication
     *
     * @param masterPassword Mot de passe maître
     * @param salt Salt pour Argon2id
     * @param keyFileContent Contenu du fichier clé optionnel (second facteur)
     * @param params Paramètres Argon2id
     * @return Clé dérivée
     */
    fun deriveKeyWithKeyFile(
        masterPassword: String,
        salt: ByteArray,
        keyFileContent: ByteArray? = null,
        params: Argon2Params = Argon2Params()
    ): SecretKey {
        require(salt.size == SALT_LENGTH) { "Salt must be $SALT_LENGTH bytes" }

        // Créer une composite key si key file fourni
        val compositePassword = if (keyFileContent != null) {
            val digest = java.security.MessageDigest.getInstance("SHA-256")

            // Hash password
            val passwordBytes = masterPassword.toByteArray(Charsets.UTF_8)
            val passwordHash = digest.digest(passwordBytes)
            SecretUtils.wipe(passwordBytes)

            // Hash key file
            digest.reset()
            val keyFileHash = digest.digest(keyFileContent)

            // Combine: hash(passwordHash + keyFileHash)
            digest.reset()
            val combined = passwordHash + keyFileHash
            val compositeHash = digest.digest(combined)

            try {
                // Convertir en string pour Argon2id
                bytesToHex(compositeHash)
            } finally {
                SecretUtils.wipe(combined)
                SecretUtils.wipe(compositeHash)
                SecretUtils.wipe(passwordHash)
                SecretUtils.wipe(keyFileHash)
            }
        } else {
            masterPassword
        }

        // Dériver la clé avec Argon2id
        return deriveKey(compositePassword, salt, params)
    }

    // ========================================
    // Memory Security
    // ========================================

    /**
     * Nettoie la mémoire (wipe les clés sensibles)
     */
    fun wipeKey(key: SecretKey) {
        key.encoded?.let { SecretUtils.wipe(it) }
    }

    /**
     * Nettoie un char array (pour les mots de passe)
     */
    fun wipePassword(password: CharArray) {
        SecretUtils.wipe(password)
    }
}
