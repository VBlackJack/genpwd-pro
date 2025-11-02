package com.genpwd.corevault

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private val json = Json { ignoreUnknownKeys = true }

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
