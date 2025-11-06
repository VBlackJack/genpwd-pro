package com.genpwd.storage.crypto

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Encrypts and decrypts OAuth tokens using Android Keystore.
 *
 * Uses AES-256-GCM for authenticated encryption with associated data (AEAD).
 * Keys are stored in Android Keystore for hardware-backed security.
 */
@Singleton
class TokenCrypto @Inject constructor() {

    companion object {
        private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
        private const val KEY_ALIAS = "cloud_account_tokens_key"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val GCM_TAG_LENGTH = 128
    }

    private val keyStore: KeyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply {
        load(null)
    }

    /**
     * Get or create the encryption key.
     */
    private fun getOrCreateKey(): SecretKey {
        // Try to retrieve existing key
        val existingKey = keyStore.getKey(KEY_ALIAS, null) as? SecretKey
        if (existingKey != null) {
            return existingKey
        }

        // Generate new key
        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            KEYSTORE_PROVIDER
        )

        val keyGenSpec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(false) // No user auth for automatic sync
            .build()

        keyGenerator.init(keyGenSpec)
        return keyGenerator.generateKey()
    }

    /**
     * Encrypt a token string.
     *
     * @param plaintext The token to encrypt
     * @return Base64-encoded encrypted token with IV prepended
     */
    fun encrypt(plaintext: String): String {
        if (plaintext.isBlank()) return ""

        val key = getOrCreateKey()
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key)

        val iv = cipher.iv
        val ciphertext = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))

        // Prepend IV to ciphertext
        val combined = iv + ciphertext

        return Base64.encodeToString(combined, Base64.NO_WRAP)
    }

    /**
     * Decrypt a token string.
     *
     * @param encryptedBase64 Base64-encoded encrypted token with IV prepended
     * @return Decrypted token string
     */
    fun decrypt(encryptedBase64: String): String {
        if (encryptedBase64.isBlank()) return ""

        val key = getOrCreateKey()
        val combined = Base64.decode(encryptedBase64, Base64.NO_WRAP)

        // Extract IV (first 12 bytes for GCM)
        val ivSize = 12
        val iv = combined.sliceArray(0 until ivSize)
        val ciphertext = combined.sliceArray(ivSize until combined.size)

        val cipher = Cipher.getInstance(TRANSFORMATION)
        val spec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
        cipher.init(Cipher.DECRYPT_MODE, key, spec)

        val plaintext = cipher.doFinal(ciphertext)
        return String(plaintext, Charsets.UTF_8)
    }
}
