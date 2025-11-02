package com.julien.genpwdpro.crypto

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.julien.genpwdpro.data.encryption.EncryptionManager
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertNotEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class TinkAesGcmCryptoEngineRobolectricTest {

    private val context: Context = ApplicationProvider.getApplicationContext()
    private val encryptionManager = EncryptionManager()

    @Before
    fun setUp() {
        encryptionManager.resetEngine(context, KEYSET_NAME, KEYSET_PREFS)
    }

    @Test
    fun encryptDecryptRoundTrip() {
        val engine = encryptionManager.obtainEngine(context, KEYSET_NAME, KEYSET_PREFS)
        val plaintext = "super-secret".toByteArray()
        val aad = "context".toByteArray()

        val ciphertext = engine.encrypt(plaintext, aad)
        assertNotEquals(plaintext.toList(), ciphertext.toList())

        val decrypted = engine.decrypt(ciphertext, aad)
        assertArrayEquals(plaintext, decrypted)
    }

    @Test
    fun keyRotationMaintainsDecryption() {
        val engine = encryptionManager.obtainEngine(context, KEYSET_NAME, KEYSET_PREFS)
        val plaintext = "rotate-me".toByteArray()

        val ciphertextBeforeRotation = engine.encrypt(plaintext)

        engine.rotate()

        val ciphertextAfterRotation = engine.encrypt(plaintext)
        assertNotEquals(ciphertextBeforeRotation.toList(), ciphertextAfterRotation.toList())

        assertArrayEquals(plaintext, engine.decrypt(ciphertextBeforeRotation))
        assertArrayEquals(plaintext, engine.decrypt(ciphertextAfterRotation))

        val reloadedEngine = encryptionManager.obtainEngine(context, KEYSET_NAME, KEYSET_PREFS)
        assertArrayEquals(plaintext, reloadedEngine.decrypt(ciphertextBeforeRotation))
    }

    companion object {
        private const val KEYSET_PREFS = "test_crypto_keyset_store"
        private const val KEYSET_NAME = "test_crypto_keyset"
    }
}
