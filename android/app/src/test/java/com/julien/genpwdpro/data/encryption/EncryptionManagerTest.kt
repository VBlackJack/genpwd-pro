package com.julien.genpwdpro.data.encryption

import java.security.SecureRandom
import javax.crypto.AEADBadTagException
import kotlin.test.assertContentEquals
import kotlin.test.assertFailsWith
import org.junit.Test

class EncryptionManagerTest {

    private val encryptionManager = EncryptionManager()
    private val random = SecureRandom()

    @Test
    fun encryptDecryptRoundTrip_randomPayloads() {
        repeat(10) {
            val size = random.nextInt(256).coerceAtLeast(1)
            val payload = ByteArray(size)
            random.nextBytes(payload)
            val key = encryptionManager.generateKey()

            val encrypted = encryptionManager.encrypt(payload, key)
            val decrypted = encryptionManager.decrypt(encrypted, key)

            assertContentEquals(payload, decrypted)
        }
    }

    @Test
    fun decryptFailsWhenCiphertextTampered() {
        val key = encryptionManager.generateKey()
        val payload = ByteArray(64).also(random::nextBytes)
        val encrypted = encryptionManager.encrypt(payload, key)

        // Flip a bit in the ciphertext
        encrypted.ciphertext[0] = encrypted.ciphertext[0].inv()

        assertFailsWith<AEADBadTagException> {
            encryptionManager.decrypt(encrypted, key)
        }
    }
}
