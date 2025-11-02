package com.genpwd.corevault

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.nio.ByteBuffer
import java.security.SecureRandom
import java.time.Instant
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec
import javax.inject.Inject
import javax.inject.Singleton

private const val HEADER_VERSION: Int = 1
private const val GCM_TAG_LENGTH_BITS = 128
private const val GCM_NONCE_LENGTH_BYTES = 12
private const val SALT_LENGTH_BYTES = 16
private const val PBKDF2_ITERATIONS = 120_000
private const val PBKDF2_KEY_LENGTH_BITS = 256

/**
 * Minimal representation of the vault header stored alongside the ciphertext to simplify
 * format evolution.
 */
data class VaultHeader(
    val formatVersion: Int = HEADER_VERSION,
    val cipher: String = "AES-256-GCM",
    val kdf: String = "PBKDF2WithHmacSHA512",
    val nonce: ByteArray,
    val salt: ByteArray,
    val deviceId: String,
    val createdUtc: Long,
)

/**
 * Container returned to callers after encryption. It bundles the serialised header together
 * with the encrypted payload and the derived local hash.
 */
data class EncryptedVault(
    val header: VaultHeader,
    val ciphertext: ByteArray,
    val localHash: String,
)

/**
 * Provides encryption and decryption operations for vaults. The implementation sticks to
 * primitives that are available on the Android platform without external dependencies.
 */
@Singleton
class VaultCryptoEngine @Inject constructor(
    private val secureRandom: SecureRandom = SecureRandom(),
    private val json: Json = Json { ignoreUnknownKeys = true },
) {
    fun encryptVault(masterPassword: CharArray, vault: Vault, deviceId: String): EncryptedVault {
        val salt = ByteArray(SALT_LENGTH_BYTES).apply(secureRandom::nextBytes)
        val nonce = ByteArray(GCM_NONCE_LENGTH_BYTES).apply(secureRandom::nextBytes)
        val key = deriveKey(masterPassword, salt)

        val payload = json.encodeToString(vault).encodeToByteArray()
        val ciphertext = aesGcmEncrypt(key, nonce, payload)
        val header = VaultHeader(
            nonce = nonce,
            salt = salt,
            deviceId = deviceId,
            createdUtc = Instant.now().epochSecond,
        )
        val localHash = ciphertext.sha256().toHex()
        return EncryptedVault(header = header, ciphertext = ciphertext, localHash = localHash)
    }

    fun decryptVault(masterPassword: CharArray, encryptedVault: EncryptedVault): Vault {
        val key = deriveKey(masterPassword, encryptedVault.header.salt)
        val payload = aesGcmDecrypt(key, encryptedVault.header.nonce, encryptedVault.ciphertext)
        return json.decodeFromString(Vault.serializer(), payload.decodeToString())
    }

    private fun deriveKey(masterPassword: CharArray, salt: ByteArray): SecretKey {
        val spec = PBEKeySpec(
            masterPassword,
            salt,
            PBKDF2_ITERATIONS,
            PBKDF2_KEY_LENGTH_BITS,
        )
        val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA512")
        val secret = factory.generateSecret(spec)
        return SecretKeySpec(secret.encoded, "AES")
    }

    private fun aesGcmEncrypt(key: SecretKey, nonce: ByteArray, plaintext: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(GCM_TAG_LENGTH_BITS, nonce))
        cipher.updateAAD(buildHeaderBytes())
        return cipher.doFinal(plaintext)
    }

    private fun aesGcmDecrypt(key: SecretKey, nonce: ByteArray, ciphertext: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(GCM_TAG_LENGTH_BITS, nonce))
        cipher.updateAAD(buildHeaderBytes())
        return cipher.doFinal(ciphertext)
    }

    private fun buildHeaderBytes(): ByteArray {
        val buffer = ByteBuffer.allocate(Int.SIZE_BYTES * 2)
        buffer.putInt(HEADER_VERSION)
        buffer.putInt(GCM_TAG_LENGTH_BITS)
        return buffer.array()
    }
}

private fun ByteArray.sha256(): ByteArray {
    val messageDigest = java.security.MessageDigest.getInstance("SHA-256")
    messageDigest.update(this)
    return messageDigest.digest()
}

private fun ByteArray.toHex(): String {
    val result = StringBuilder(size * 2)
    forEach { byte ->
        val intVal = byte.toInt() and 0xff
        result.append("0123456789abcdef"[intVal shr 4])
        result.append("0123456789abcdef"[intVal and 0x0f])
    }
    return result.toString()
}

/**
 * Simple helper used in tests to compare arrays safely without leaking timing information.
 */
fun constantTimeEquals(left: ByteArray, right: ByteArray): Boolean {
    if (left.size != right.size) return false
    var diff = 0
    for (index in left.indices) {
        diff = diff or (left[index].toInt() xor right[index].toInt())
    }
    return diff == 0
}
