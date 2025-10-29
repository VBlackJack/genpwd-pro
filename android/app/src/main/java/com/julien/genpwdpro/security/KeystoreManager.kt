package com.julien.genpwdpro.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.inject.Inject
import javax.inject.Singleton

enum class KeystoreAlias(
    private val baseAlias: String,
    private val version: Int
) {
    MASTER("genpwd_master_key", 2),
    SYNC("genpwd_sync_key", 2),
    APP_LOCK("genpwd_app_lock_key", 2),
    SQL_CIPHER("genpwd_sqlcipher_key", 2);

    val alias: String = "${baseAlias}_v$version"
    val legacyAliases: Set<String> = buildSet {
        add(baseAlias)
        for (legacyVersion in 1 until version) {
            add("${baseAlias}_v$legacyVersion")
        }
    }

    fun matches(candidate: String): Boolean {
        return candidate == alias || legacyAliases.contains(candidate)
    }
}

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

        private val MASTER_KEY_ALIAS = KeystoreAlias.MASTER.alias
        private val SYNC_KEY_ALIAS = KeystoreAlias.SYNC.alias
        private val APP_LOCK_KEY_ALIAS = KeystoreAlias.APP_LOCK.alias
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
            alias = KeystoreAlias.MASTER,
            requireBiometric = requireBiometric,
            userAuthenticationValiditySeconds = userAuthenticationValiditySeconds
        )
    }

    /**
     * Génère ou récupère la clé de synchronisation cloud
     */
    fun getSyncKey(): SecretKey {
        return getOrCreateKey(
            alias = KeystoreAlias.SYNC,
            requireBiometric = false
        )
    }

    /**
     * Génère ou récupère la clé de verrouillage de l'application
     * Requiert l'authentification biométrique
     */
    fun getAppLockKey(): SecretKey {
        return getOrCreateKey(
            alias = KeystoreAlias.APP_LOCK,
            requireBiometric = true,
            userAuthenticationValiditySeconds = 30 // Valide 30 secondes après auth
        )
    }

    /**
     * Génère ou récupère une clé depuis le Keystore
     */
    private fun getOrCreateKey(
        alias: KeystoreAlias,
        requireBiometric: Boolean = false,
        userAuthenticationValiditySeconds: Int = 0
    ): SecretKey {
        return getExistingKey(alias.alias) ?: createKey(
            alias = alias.alias,
            requireBiometric = requireBiometric,
            userAuthenticationValiditySeconds = userAuthenticationValiditySeconds
        )
    }

    private fun getExistingKey(alias: String): SecretKey? {
        return runCatching {
            if (keyStore.containsAlias(alias)) {
                val entry = keyStore.getEntry(alias, null) as KeyStore.SecretKeyEntry
                entry.secretKey
            } else {
                null
            }
        }.getOrElse { throw it }
    }

    private fun createKey(
        alias: String,
        requireBiometric: Boolean,
        userAuthenticationValiditySeconds: Int
    ): SecretKey {
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
            .setRandomizedEncryptionRequired(true)

        if (requireBiometric || userAuthenticationValiditySeconds > 0) {
            builder.setUserAuthenticationRequired(true)
            builder.setInvalidatedByBiometricEnrollment(true)

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                builder.setUserAuthenticationParameters(
                    userAuthenticationValiditySeconds,
                    KeyProperties.AUTH_BIOMETRIC_STRONG
                )
            } else {
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
        val key = resolveKeyForEncryption(alias)
        cipher.init(Cipher.ENCRYPT_MODE, key)
        return cipher
    }

    /**
     * Obtient un Cipher configuré pour le déchiffrement
     * À utiliser avec BiometricPrompt.CryptoObject si authentification requise
     */
    fun getDecryptCipher(alias: String = MASTER_KEY_ALIAS, iv: ByteArray): Cipher {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        val key = getExistingKey(alias)
            ?: throw IllegalStateException("Keystore alias $alias introuvable pour le déchiffrement")
        val spec = GCMParameterSpec(TAG_SIZE, iv)
        cipher.init(Cipher.DECRYPT_MODE, key, spec)
        return cipher
    }

    /**
     * Chiffre des données avec une clé du Keystore
     */
    fun encrypt(data: ByteArray, alias: String = MASTER_KEY_ALIAS): EncryptedKeystoreData {
        val canonicalAlias = canonicalAlias(alias)
        val cipher = getEncryptCipher(canonicalAlias)
        val plaintextCopy = data.copyOf()

        return try {
            val ciphertext = cipher.doFinal(plaintextCopy)
            val iv = cipher.iv

            require(iv.size == IV_SIZE) { "GCM IV must be $IV_SIZE bytes" }

            EncryptedKeystoreData(
                ciphertext = ciphertext,
                iv = iv,
                keyAlias = canonicalAlias
            )
        } finally {
            plaintextCopy.fill(0)
        }
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
        val plaintextBytes = plaintext.toByteArray(Charsets.UTF_8)
        return try {
            encrypt(plaintextBytes, alias)
        } finally {
            plaintextBytes.fill(0)
        }
    }

    /**
     * Déchiffre une chaîne de caractères
     */
    fun decryptString(encryptedData: EncryptedKeystoreData): String {
        val plaintext = decrypt(encryptedData)
        val result = String(plaintext, Charsets.UTF_8)
        plaintext.fill(0)
        return result
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
        KeystoreAlias.values().forEach { descriptor ->
            (descriptor.legacyAliases + descriptor.alias).forEach { alias ->
                deleteKey(alias)
            }
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

    fun isCurrentAlias(alias: String, descriptor: KeystoreAlias): Boolean {
        return descriptor.alias == alias
    }

    fun isLegacyAlias(alias: String, descriptor: KeystoreAlias): Boolean {
        return descriptor.legacyAliases.contains(alias)
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

    private fun resolveKeyForEncryption(alias: String): SecretKey {
        val descriptor = resolveAliasDescriptor(alias)
        return if (descriptor != null) {
            val (requireBiometric, validitySeconds) = defaultConfig(descriptor)
            getOrCreateKey(descriptor, requireBiometric, validitySeconds)
        } else {
            getExistingKey(alias) ?: createKey(alias, false, 0)
        }
    }

    private fun resolveAliasDescriptor(alias: String): KeystoreAlias? {
        return KeystoreAlias.values().firstOrNull { it.matches(alias) }
    }

    private fun defaultConfig(descriptor: KeystoreAlias): Pair<Boolean, Int> {
        return when (descriptor) {
            KeystoreAlias.APP_LOCK -> true to 30
            else -> false to 0
        }
    }

    private fun canonicalAlias(alias: String): String {
        return resolveAliasDescriptor(alias)?.alias ?: alias
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
