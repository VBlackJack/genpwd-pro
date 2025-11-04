package com.julien.genpwdpro.data.db.database

import android.content.Context
import com.julien.genpwdpro.core.log.SafeLog
import androidx.sqlite.db.SupportSQLiteOpenHelper
import com.julien.genpwdpro.crypto.CryptoEngine
import com.julien.genpwdpro.data.encryption.EncryptedDataEncoded
import com.julien.genpwdpro.data.encryption.EncryptionManager
import com.julien.genpwdpro.data.secure.SecurePrefs
import dagger.hilt.android.qualifiers.ApplicationContext
import java.security.SecureRandom
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.jvm.Volatile
import net.sqlcipher.database.SQLiteDatabase
import net.sqlcipher.database.SQLiteDatabaseHook
import net.sqlcipher.database.SupportFactory

interface DatabaseOpenHelperFactoryProvider {
    fun provideFactory(): SupportSQLiteOpenHelper.Factory
}

@Singleton
class SqlCipherDatabaseOpenHelperFactoryProvider @Inject constructor(
    private val passphraseProvider: SqlCipherPassphraseProvider
) : DatabaseOpenHelperFactoryProvider {
    override fun provideFactory(): SupportSQLiteOpenHelper.Factory {
        val passphrase = passphraseProvider.getOrCreatePassphrase()
        return try {
            SupportFactory(passphrase.copyOf(), cipherHook(), true)
        } finally {
            passphrase.fill(0)
        }
    }

    private fun cipherHook(): SQLiteDatabaseHook = object : SQLiteDatabaseHook {
        override fun preKey(database: SQLiteDatabase?) = Unit

        override fun postKey(database: SQLiteDatabase?) {
            database?.rawExecSQL("PRAGMA cipher_page_size = 4096;")
            database?.rawExecSQL("PRAGMA cipher_hmac_algorithm = HMAC_SHA512;")
            database?.rawExecSQL("PRAGMA cipher_kdf_algorithm = PBKDF2_HMAC_SHA512;")
            // Keep PBKDF2 iterations aligned with SQLCipher 4.x recommendations for compatibility.
            database?.rawExecSQL("PRAGMA kdf_iter = 64000;")
            database?.rawExecSQL("PRAGMA cipher_memory_security = ON;")
        }
    }
}

@Singleton
class SqlCipherPassphraseProvider @Inject constructor(
    @ApplicationContext context: Context,
    private val securePrefs: SecurePrefs,
    private val encryptionManager: EncryptionManager
) {

    private val appContext = context.applicationContext
    private val secureRandom = SecureRandom()
    private val engineLock = Any()

    @Volatile
    private var cryptoEngine: CryptoEngine

    init {
        SQLiteDatabase.loadLibs(appContext)
        cryptoEngine = createCryptoEngine()
    }

    fun getOrCreatePassphrase(): ByteArray {
        check(securePrefs.isUnlocked()) { "Secure storage unavailable while device locked" }

        synchronized(lock) {
            securePrefs.getString(PREF_KEY)?.let { stored ->
                val encoded = decode(stored)
                return recoverPassphrase(encoded)
            }

            return generateAndStorePassphrase()
        }
    }

    private fun recoverPassphrase(encoded: EncryptedDataEncoded): ByteArray {
        return runCatching {
            val engine = currentEngine()
            encryptionManager.decrypt(encoded.toEncryptedData(), engine)
        }.getOrElse { throwable ->
            handleInvalidatedSecret(throwable)
        }
    }

    private fun generateAndStorePassphrase(): ByteArray {
        val engine = currentEngine()
        val passphrase = ByteArray(PASSPHRASE_LENGTH)
        secureRandom.nextBytes(passphrase)

        val encrypted = encryptionManager.encrypt(passphrase, engine)
        val encoded = encrypted.toBase64()
        securePrefs.putString(PREF_KEY, encode(encoded))

        return passphrase
    }

    private fun handleInvalidatedSecret(throwable: Throwable): ByteArray {
        SafeLog.w(TAG, "SQLCipher key invalidated, regenerating", throwable)

        securePrefs.remove(PREF_KEY)
        resetCryptoEngine()
        return generateAndStorePassphrase()
    }

    private fun currentEngine(): CryptoEngine {
        return synchronized(engineLock) { cryptoEngine }
    }

    private fun resetCryptoEngine(): CryptoEngine {
        return synchronized(engineLock) {
            encryptionManager.resetEngine(appContext, KEYSET_NAME, KEYSET_PREFS)
            val engine = createCryptoEngine()
            cryptoEngine = engine
            engine
        }
    }

    private fun createCryptoEngine(): CryptoEngine {
        return encryptionManager.obtainEngine(appContext, KEYSET_NAME, KEYSET_PREFS)
    }

    private fun encode(data: EncryptedDataEncoded): String {
        return listOf(data.ciphertext, data.iv).joinToString(DELIMITER)
    }

    private fun decode(serialized: String): EncryptedDataEncoded {
        val parts = serialized.split(DELIMITER)
        require(parts.size == 2) { "Malformed SQLCipher secret" }
        return EncryptedDataEncoded(parts[0], parts[1])
    }

    companion object {
        private const val TAG = "SqlCipherPassphrase"
        private const val PREF_KEY = "sqlcipher_passphrase_encrypted"
        private const val KEYSET_PREFS = "sqlcipher_passphrase_keyset_store"
        private const val KEYSET_NAME = "sqlcipher_passphrase_keyset"
        private const val PASSPHRASE_LENGTH = 32
        private const val DELIMITER = ":"
        private val lock = Any()
    }
}
