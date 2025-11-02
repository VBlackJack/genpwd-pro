package com.genpwd.corevault

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class VaultCryptoEngineTest {
    private val engine = VaultCryptoEngine()

    @Test
    fun `encrypt and decrypt roundtrip`() {
        val vault = Vault(
            meta = VaultMeta(
                id = VaultId("/vaults/demo", ProviderKind.GOOGLE_DRIVE, "account"),
                name = "demo",
                version = 1L,
                lastModifiedUtc = 1000L,
                size = 2048L,
                remoteEtag = "etag",
            ),
            items = listOf(
                VaultItem(
                    itemId = "1",
                    encryptedPayload = "ciphertext",
                    updatedAt = 1000L,
                    updatedBy = "device",
                ),
            ),
            changeVector = "device#1",
        )
        val encrypted = engine.encryptVault("password".toCharArray(), vault, deviceId = "device")
        val decrypted = engine.decryptVault("password".toCharArray(), encrypted)

        assertEquals(vault, decrypted)
        val digest = java.security.MessageDigest.getInstance("SHA-256")
        val expectedHash = digest.digest(encrypted.ciphertext).joinToString(separator = "") { byte ->
            val value = byte.toInt() and 0xff
            "${"0123456789abcdef"[value shr 4]}${"0123456789abcdef"[value and 0x0f]}"
        }
        assertEquals(expectedHash, encrypted.localHash)
    }

    @Test
    fun `constant time equals`() {
        val first = byteArrayOf(1, 2, 3)
        val second = byteArrayOf(1, 2, 3)
        val third = byteArrayOf(3, 2, 1)

        assertTrue(constantTimeEquals(first, second))
        assertTrue(!constantTimeEquals(first, third))
    }
}
