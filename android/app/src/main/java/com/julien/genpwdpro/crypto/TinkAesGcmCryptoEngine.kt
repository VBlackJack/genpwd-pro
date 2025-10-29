package com.julien.genpwdpro.crypto

import com.google.crypto.tink.Aead
import com.google.crypto.tink.CleartextKeysetHandle
import com.google.crypto.tink.KeysetHandle
import com.google.crypto.tink.KeysetManager
import com.google.crypto.tink.aead.AeadConfig
import com.google.crypto.tink.aead.AeadKeyTemplates
import com.google.crypto.tink.JsonKeysetReader
import com.google.crypto.tink.JsonKeysetWriter
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.nio.charset.StandardCharsets
import java.security.GeneralSecurityException

/**
 * Google Tink backed implementation of [CryptoEngine] relying on AES-256-GCM keysets.
 */
class TinkAesGcmCryptoEngine private constructor(
    private var keysetHandle: KeysetHandle
) : CryptoEngine {

    private val lock = Any()

    override fun encrypt(plaintext: ByteArray, associatedData: ByteArray): ByteArray {
        return aead().encrypt(plaintext, normaliseAad(associatedData))
    }

    override fun decrypt(ciphertext: ByteArray, associatedData: ByteArray): ByteArray {
        return aead().decrypt(ciphertext, normaliseAad(associatedData))
    }

    override fun rotate() {
        synchronized(lock) {
            val manager = KeysetManager.withKeysetHandle(keysetHandle)
            manager.rotate(AeadKeyTemplates.AES256_GCM)
            keysetHandle = manager.keysetHandle
        }
    }

    override fun exportKeyset(): String {
        val outputStream = ByteArrayOutputStream()
        synchronized(lock) {
            CleartextKeysetHandle.write(keysetHandle, JsonKeysetWriter.withOutputStream(outputStream))
        }
        return outputStream.toByteArray().toString(StandardCharsets.UTF_8)
    }

    private fun aead(): Aead {
        return synchronized(lock) {
            keysetHandle.getPrimitive(Aead::class.java)
        }
    }

    private fun normaliseAad(associatedData: ByteArray): ByteArray {
        return if (associatedData.isEmpty()) CryptoEngine.EMPTY_AAD else associatedData
    }

    companion object {
        init {
            try {
                AeadConfig.register()
            } catch (e: GeneralSecurityException) {
                throw IllegalStateException("Unable to register Tink AEAD configuration", e)
            }
        }

        /**
         * Creates a new engine backed by a freshly generated AES-256-GCM keyset.
         */
        fun create(): TinkAesGcmCryptoEngine {
            val handle = KeysetHandle.generateNew(AeadKeyTemplates.AES256_GCM)
            return TinkAesGcmCryptoEngine(handle)
        }

        /**
         * Restores an engine from a serialized keyset produced by [exportKeyset].
         */
        fun fromSerialized(serializedKeyset: String): TinkAesGcmCryptoEngine {
            val inputStream = ByteArrayInputStream(serializedKeyset.toByteArray(StandardCharsets.UTF_8))
            val handle = CleartextKeysetHandle.read(JsonKeysetReader.withInputStream(inputStream))
            return TinkAesGcmCryptoEngine(handle)
        }
    }
}
