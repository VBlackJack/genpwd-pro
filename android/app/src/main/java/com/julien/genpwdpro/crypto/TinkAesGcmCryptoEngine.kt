package com.julien.genpwdpro.crypto

import android.content.Context
import com.google.crypto.tink.Aead
import com.google.crypto.tink.aead.AeadConfig
import com.google.crypto.tink.aead.AeadKeyTemplates
import com.google.crypto.tink.integration.android.AndroidKeysetManager
import java.security.GeneralSecurityException

/**
 * Google Tink backed implementation of [CryptoEngine] relying on AES-256-GCM keysets.
 */
class TinkAesGcmCryptoEngine private constructor(
    private val keysetManager: AndroidKeysetManager
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
            keysetManager.rotate(AeadKeyTemplates.AES256_GCM)
        }
    }

    private fun aead(): Aead {
        return synchronized(lock) {
            keysetManager.keysetHandle.getPrimitive(Aead::class.java)
        }
    }

    private fun normaliseAad(associatedData: ByteArray): ByteArray {
        return if (associatedData.isEmpty()) CryptoEngine.EMPTY_AAD else associatedData
    }

    companion object {
        private const val MASTER_KEY_URI = "android-keystore://genpwdpro_master_key"

        init {
            try {
                AeadConfig.register()
            } catch (e: GeneralSecurityException) {
                throw IllegalStateException("Unable to register Tink AEAD configuration", e)
            }
        }

        fun getOrCreate(
            context: Context,
            keysetName: String,
            prefFileName: String
        ): TinkAesGcmCryptoEngine {
            val manager = AndroidKeysetManager.Builder()
                .withSharedPref(context, keysetName, prefFileName)
                .withKeyTemplate(AeadKeyTemplates.AES256_GCM)
                .withMasterKeyUri(MASTER_KEY_URI)
                .build()
            return TinkAesGcmCryptoEngine(manager)
        }

        fun wipe(
            context: Context,
            keysetName: String,
            prefFileName: String
        ) {
            val preferences = context.getSharedPreferences(prefFileName, Context.MODE_PRIVATE)
            preferences.edit().remove(keysetName).apply()
        }
    }
}
