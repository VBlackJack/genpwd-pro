package com.genpwd.corevault

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.security.MessageDigest
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json

private val json = Json { ignoreUnknownKeys = true }

/**
 * Object responsible for encoding and decoding EncryptedVault to/from byte arrays
 * for network transfer and storage.
 */
object VaultEncoding {
    /**
     * Encodes an EncryptedVault to a byte array for network transfer.
     */
    fun encode(encryptedVault: EncryptedVault, json: Json): ByteArray {
        return encryptedVault.payload
    }

    /**
     * Decodes a byte array received from network into an EncryptedVault.
     */
    fun decode(bytes: ByteArray, json: Json): EncryptedVault {
        // Parse the blob to extract header and ciphertext
        require(bytes.size > 4) { "Invalid vault blob" }
        val headerLength = bytes.copyOfRange(0, 4).toInt()
        val headerBytes = bytes.copyOfRange(4, 4 + headerLength)
        val cipherBytes = bytes.copyOfRange(4 + headerLength, bytes.size)

        val header = json.decodeFromString<VaultHeader>(headerBytes.toString(Charsets.UTF_8))
        val localEtag = cipherBytes.sha256()

        return EncryptedVault(
            payload = bytes,
            header = header,
            localEtag = localEtag
        )
    }

    private fun ByteArray.sha256(): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(this)
        return hash.joinToString(separator = "") { "%02x".format(it) }
    }

    private fun ByteArray.toInt(): Int {
        require(size == 4) { "Expected 4 bytes" }
        return ((this[0].toInt() and 0xFF) shl 24) or
            ((this[1].toInt() and 0xFF) shl 16) or
            ((this[2].toInt() and 0xFF) shl 8) or
            (this[3].toInt() and 0xFF)
    }
}

@Serializable
internal data class EncodedVaultPayload(
    val metaJson: String,
    val itemsJson: String,
    val compressedJournal: ByteArray,
    val changeVector: String,
)

internal fun encodeVaultPayload(vault: Vault): EncodedVaultPayload {
    val itemsJson = json.encodeToString(vault.items)
    val metaJson = json.encodeToString(vault.meta)
    val journalJson = json.encodeToString(vault.journal)
    val compressedJournal = compress(journalJson.toByteArray(Charsets.UTF_8))
    return EncodedVaultPayload(
        metaJson = metaJson,
        itemsJson = itemsJson,
        compressedJournal = compressedJournal,
        changeVector = vault.changeVector,
    )
}

internal fun decodeVaultPayload(payload: EncodedVaultPayload): VaultPayloadData {
    val meta = json.decodeFromString<VaultMeta>(payload.metaJson)
    val items = json.decodeFromString<List<VaultItem>>(payload.itemsJson)
    val journalJson = decompress(payload.compressedJournal).toString(Charsets.UTF_8)
    val journal = json.decodeFromString<List<VaultChange>>(journalJson)
    return VaultPayloadData(
        meta = meta,
        items = items,
        journal = journal,
        changeVector = payload.changeVector,
    )
}

internal data class VaultPayloadData(
    val meta: VaultMeta,
    val items: List<VaultItem>,
    val journal: List<VaultChange>,
    val changeVector: String,
)

private fun compress(input: ByteArray): ByteArray {
    ByteArrayOutputStream().use { bos ->
        GZIPOutputStream(bos).use { gzip ->
            gzip.write(input)
        }
        return bos.toByteArray()
    }
}

private fun decompress(input: ByteArray): ByteArray {
    ByteArrayInputStream(input).use { bis ->
        GZIPInputStream(bis).use { gzip ->
            return gzip.readBytes()
        }
    }
}
