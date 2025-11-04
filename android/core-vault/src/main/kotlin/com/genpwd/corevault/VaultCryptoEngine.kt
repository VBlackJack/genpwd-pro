package com.genpwd.corevault

import de.mkammerer.argon2.Argon2Factory
import java.security.GeneralSecurityException
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.decodeFromString

private const val FORMAT_VERSION = 1
private const val AES_GCM_TAG_LENGTH = 128
private const val NONCE_SIZE_BYTES = 12
private const val SALT_SIZE_BYTES = 16
private const val AES_KEY_LENGTH_BYTES = 32
private val json = Json { ignoreUnknownKeys = true }

class VaultCryptoEngine(
    private val secureRandom: SecureRandom = SecureRandom(),
) {

    /**
     * Encrypts a vault with the given master password.
     *
     * @param secret The master password
     * @param vault The vault to encrypt
     * @param deviceId The device identifier
     * @return The encrypted vault with header and local hash
     */
    fun encryptVault(secret: CharArray, vault: Vault, deviceId: String): EncryptedVault {
        val createdUtc = System.currentTimeMillis() / 1000
        return encrypt(vault, secret, deviceId, createdUtc)
    }

    private fun encrypt(vault: Vault, secret: CharArray, deviceId: String, createdUtc: Long): EncryptedVault {
        val payload = encodeVaultPayload(vault)
        val payloadBytes = serializePayload(payload)

        val kdfSalt = ByteArray(SALT_SIZE_BYTES).also(secureRandom::nextBytes)
        val nonce = ByteArray(NONCE_SIZE_BYTES).also(secureRandom::nextBytes)

        val kdfParameters = KdfParameters.Argon2id(
            salt = kdfSalt.encodeBase64(),
            iterations = DEFAULT_ARGON2_ITERATIONS,
            memoryKb = DEFAULT_ARGON2_MEMORY_KB,
            parallelism = DEFAULT_ARGON2_PARALLELISM,
            hashLength = AES_KEY_LENGTH_BYTES,
        )
        val key = deriveKey(secret, kdfParameters)
        val cipherText = aesGcmEncrypt(key, nonce, payloadBytes, deviceId)
        val header = VaultHeader(
            formatVersion = FORMAT_VERSION,
            cipher = VaultHeader.CipherKind.AES_256_GCM,
            kdf = kdfParameters,
            nonce = nonce.encodeBase64(),
            salt = kdfSalt.encodeBase64(),
            deviceId = deviceId,
            createdUtc = createdUtc,
        )
        val localEtag = cipherText.sha256()
        return EncryptedVault(
            payload = composeBlob(header, cipherText),
            header = header,
            localEtag = localEtag,
        )
    }

    /**
     * Decrypts an encrypted vault with the given master password.
     *
     * @param secret The master password
     * @param encryptedVault The encrypted vault
     * @return The decrypted vault
     */
    fun decryptVault(secret: CharArray, encryptedVault: EncryptedVault): Vault {
        return decrypt(encryptedVault.payload, secret)
    }

    private fun decrypt(blob: ByteArray, secret: CharArray): Vault {
        val parsed = parseBlob(blob)
        val key = deriveKey(secret, parsed.header.kdf)
        val nonce = parsed.header.nonce.decodeBase64()
        val plaintext = aesGcmDecrypt(key, nonce, parsed.cipherText, parsed.header.deviceId)
        val payload = deserializePayload(plaintext)
        return Vault(
            meta = payload.meta,
            items = payload.items,
            changeVector = payload.changeVector,
            journal = payload.journal,
        )
    }

    private fun deriveKey(secret: CharArray, params: KdfParameters): ByteArray = when (params) {
        is KdfParameters.Argon2id -> {
            val argon2 = Argon2Factory.create(Argon2Factory.Argon2Types.ARGON2id)
            argon2.hashRaw(
                params.iterations,
                params.memoryKb,
                params.parallelism,
                secret,
                params.salt.decodeBase64(),
                params.hashLength,
            )
        }
        is KdfParameters.Pbkdf2 -> {
            val keyFactory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
            val spec = PBEKeySpec(secret, params.salt.decodeBase64(), params.iterations, params.hashLength * 8)
            keyFactory.generateSecret(spec).encoded
        }
    }

    private fun aesGcmEncrypt(key: ByteArray, nonce: ByteArray, plaintext: ByteArray, aad: String): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val secretKey = SecretKeySpec(key, "AES")
        val spec = GCMParameterSpec(AES_GCM_TAG_LENGTH, nonce)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey, spec)
        cipher.updateAAD(aad.toByteArray(Charsets.UTF_8))
        return cipher.doFinal(plaintext)
    }

    private fun aesGcmDecrypt(key: ByteArray, nonce: ByteArray, cipherText: ByteArray, aad: String): ByteArray {
        try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val secretKey = SecretKeySpec(key, "AES")
            val spec = GCMParameterSpec(AES_GCM_TAG_LENGTH, nonce)
            cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)
            cipher.updateAAD(aad.toByteArray(Charsets.UTF_8))
            return cipher.doFinal(cipherText)
        } catch (ex: GeneralSecurityException) {
            throw VaultDecryptionException("Unable to decrypt vault", ex)
        }
    }

    private fun serializePayload(payload: EncodedVaultPayload): ByteArray {
        val encoded = json.encodeToString(payload)
        return encoded.toByteArray(Charsets.UTF_8)
    }

    private fun deserializePayload(plaintext: ByteArray): VaultPayloadData {
        val encoded = plaintext.toString(Charsets.UTF_8)
        val payload = json.decodeFromString<EncodedVaultPayload>(encoded)
        return decodeVaultPayload(payload)
    }

    private fun composeBlob(header: VaultHeader, cipherText: ByteArray): ByteArray {
        val headerBytes = json.encodeToString(header).toByteArray(Charsets.UTF_8)
        val headerLength = headerBytes.size
        val buffer = ByteArray(4 + headerLength + cipherText.size)
        val headerLengthBytes = headerLength.toByteArray()
        System.arraycopy(headerLengthBytes, 0, buffer, 0, 4)
        System.arraycopy(headerBytes, 0, buffer, 4, headerLength)
        System.arraycopy(cipherText, 0, buffer, 4 + headerLength, cipherText.size)
        return buffer
    }

    private fun parseBlob(blob: ByteArray): ParsedBlob {
        require(blob.size > 4) { "Invalid vault blob" }
        val headerLength = blob.copyOfRange(0, 4).toInt()
        val headerBytes = blob.copyOfRange(4, 4 + headerLength)
        val cipherBytes = blob.copyOfRange(4 + headerLength, blob.size)
        val header = json.decodeFromString<VaultHeader>(headerBytes.toString(Charsets.UTF_8))
        require(header.formatVersion == FORMAT_VERSION) { "Unsupported vault format ${'$'}{header.formatVersion}" }
        return ParsedBlob(header = header, cipherText = cipherBytes)
    }

    private data class ParsedBlob(
        val header: VaultHeader,
        val cipherText: ByteArray,
    )
}

class VaultDecryptionException(message: String, cause: Throwable) : Exception(message, cause)

private const val DEFAULT_ARGON2_ITERATIONS = 3
private const val DEFAULT_ARGON2_MEMORY_KB = 65536
private const val DEFAULT_ARGON2_PARALLELISM = 2

private fun ByteArray.sha256(): String {
    val digest = MessageDigest.getInstance("SHA-256")
    val hash = digest.digest(this)
    return hash.joinToString(separator = "") { "%02x".format(it) }
}

private fun ByteArray.encodeBase64(): String =
    Base64.getEncoder().encodeToString(this)

private fun String.decodeBase64(): ByteArray =
    Base64.getDecoder().decode(this)

private fun Int.toByteArray(): ByteArray = byteArrayOf(
    ((this shr 24) and 0xFF).toByte(),
    ((this shr 16) and 0xFF).toByte(),
    ((this shr 8) and 0xFF).toByte(),
    (this and 0xFF).toByte(),
)

private fun ByteArray.toInt(): Int {
    require(size == 4) { "Expected 4 bytes" }
    return ((this[0].toInt() and 0xFF) shl 24) or
        ((this[1].toInt() and 0xFF) shl 16) or
        ((this[2].toInt() and 0xFF) shl 8) or
        (this[3].toInt() and 0xFF)
}
