package com.genpwd.corevault

import java.security.MessageDigest
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.serialization.builtins.ListSerializer
import org.junit.Test

class VaultCryptoEngineTest {

    private val engine = VaultCryptoEngine()

    @Test
    fun `encrypt and decrypt restores vault`() {
        val vault = sampleVault()
        val secret = "correct horse battery staple".toCharArray()
        val encrypted = engine.encryptVault(secret, vault, deviceId = "device-A")

        val cipherBytes = cipherSection(encrypted.payload)
        assertEquals(cipherBytes.sha256(), encrypted.localEtag)

        val decrypted = engine.decryptVault(secret, encrypted)
        assertEquals(vault.meta, decrypted.meta)
        assertEquals(vault.items, decrypted.items)
        assertEquals(vault.journal, decrypted.journal)
        assertEquals(vault.changeVector, decrypted.changeVector)
    }

    @Test
    fun `local etag equals ciphertext digest`() {
        val vault = sampleVault()
        val secret = "hunter2".toCharArray()
        val encrypted = engine.encryptVault(secret, vault, deviceId = "device-B")

        val cipherBytes = cipherSection(encrypted.payload)
        val expected = cipherBytes.sha256()
        assertEquals(expected, encrypted.localEtag)
    }

    @Test
    fun `journal is compressed smaller than json`() {
        val vault = sampleVault(changeCount = 12)
        val payload = encodeVaultPayload(vault)
        val raw = kotlinx.serialization.json.Json.encodeToString(ListSerializer(VaultChange.serializer()), vault.journal)
        assertTrue(payload.compressedJournal.size < raw.toByteArray(Charsets.UTF_8).size)
    }

    private fun cipherSection(blob: ByteArray): ByteArray {
        val headerLength = blob.copyOfRange(0, 4).toInt()
        return blob.copyOfRange(4 + headerLength, blob.size)
    }

    private fun sampleVault(changeCount: Int = 3): Vault {
        val currentTime = System.currentTimeMillis()
        val meta = VaultMeta(
            id = VaultId(remotePath = "/vaults/sample.vlt", provider = ProviderKind.WEBDAV, accountId = "account-1"),
            name = "Sample",
            version = 1,
            lastModifiedUtc = currentTime,
            size = 1024,
            remoteEtag = "etag-1",
        )
        val items = listOf(
            VaultItem(itemId = "1", encryptedBlob = "blob1", updatedAtUtc = meta.lastModifiedUtc),
            VaultItem(itemId = "2", encryptedBlob = "blob2", updatedAtUtc = meta.lastModifiedUtc),
        )
        val journal = (0 until changeCount).map {
            VaultChange(
                changeId = UUID.randomUUID().toString(),
                itemId = items[it % items.size].itemId,
                operation = VaultChange.Operation.ADD,
                updatedAtUtc = meta.lastModifiedUtc + it,
                updatedByDevice = "device-${it % 2}",
            )
        }
        return Vault(
            meta = meta,
            items = items,
            changeVector = "device-123:${meta.version}",
            journal = journal,
        )
    }

    private fun ByteArray.toInt(): Int {
        require(size == 4) { "Expected 4 bytes" }
        return ((this[0].toInt() and 0xFF) shl 24) or
            ((this[1].toInt() and 0xFF) shl 16) or
            ((this[2].toInt() and 0xFF) shl 8) or
            (this[3].toInt() and 0xFF)
    }

    private fun ByteArray.sha256(): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(this)
        return hash.joinToString(separator = "") { "%02x".format(it) }
    }
}
