package com.genpwd.corevault

import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.nio.ByteBuffer

object VaultEncoding {
    fun encode(encrypted: EncryptedVault, json: Json = Json): ByteArray {
        val headerJson = json.encodeToString(VaultHeader.serializer(), encrypted.header)
        val headerBytes = headerJson.encodeToByteArray()
        val buffer = ByteBuffer.allocate(Int.SIZE_BYTES + headerBytes.size + encrypted.ciphertext.size)
        buffer.putInt(headerBytes.size)
        buffer.put(headerBytes)
        buffer.put(encrypted.ciphertext)
        return buffer.array()
    }

    fun decode(bytes: ByteArray, json: Json = Json): EncryptedVault {
        val buffer = ByteBuffer.wrap(bytes)
        require(buffer.remaining() >= Int.SIZE_BYTES) { "Invalid vault payload" }
        val headerLength = buffer.int
        require(headerLength > 0 && headerLength <= buffer.remaining()) { "Invalid header length" }
        val headerBytes = ByteArray(headerLength)
        buffer.get(headerBytes)
        val ciphertext = ByteArray(buffer.remaining())
        buffer.get(ciphertext)
        val header = json.decodeFromString(VaultHeader.serializer(), headerBytes.decodeToString())
        val hash = ciphertext.sha256().toHex()
        return EncryptedVault(header = header, ciphertext = ciphertext, localHash = hash)
    }
}

private fun ByteArray.sha256(): ByteArray {
    val digest = java.security.MessageDigest.getInstance("SHA-256")
    return digest.digest(this)
}

private fun ByteArray.toHex(): String = joinToString(separator = "") { byte ->
    val value = byte.toInt() and 0xff
    "${"0123456789abcdef"[value shr 4]}${"0123456789abcdef"[value and 0x0f]}"
}
