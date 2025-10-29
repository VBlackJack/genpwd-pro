package com.julien.genpwdpro.crypto

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class TinkAesGcmCryptoEngineTest {

    @Test
    fun encryptDecryptRoundTrip() {
        val engine = TinkAesGcmCryptoEngine.create()
        val plaintext = "super-secret".toByteArray()
        val aad = "context".toByteArray()

        val ciphertext = engine.encrypt(plaintext, aad)
        assertNotEquals(plaintext.toList(), ciphertext.toList())

        val decrypted = engine.decrypt(ciphertext, aad)
        assertArrayEquals(plaintext, decrypted)
    }

    @Test
    fun keyRotationMaintainsDecryption() {
        val engine = TinkAesGcmCryptoEngine.create()
        val plaintext = "rotate-me".toByteArray()

        val ciphertextBeforeRotation = engine.encrypt(plaintext)
        val serializedBefore = engine.exportKeyset()

        engine.rotate()

        val serializedAfter = engine.exportKeyset()
        assertNotEquals("Keyset should change after rotation", serializedBefore, serializedAfter)

        val ciphertextAfterRotation = engine.encrypt(plaintext)

        assertArrayEquals(plaintext, engine.decrypt(ciphertextBeforeRotation))
        assertArrayEquals(plaintext, engine.decrypt(ciphertextAfterRotation))
    }
}
