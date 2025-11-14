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

    /**
     * Check if passphrase rotation is needed (older than 90 days).
     * Returns true if rotation is recommended.
     */
    fun needsRotation(): Boolean {
        val lastRotation = securePrefs.getLong(PREF_LAST_ROTATION, 0L)
        if (lastRotation == 0L) {
            // No rotation timestamp recorded, set it to now
            recordRotation()
            return false
        }

        val daysSinceRotation = (System.currentTimeMillis() - lastRotation) / (1000 * 60 * 60 * 24)
        return daysSinceRotation >= ROTATION_INTERVAL_DAYS
    }

    /**
     * Rotate the SQLCipher passphrase to a new randomly generated one.
     * This method handles the complete rotation process:
     * 1. Generate new passphrase
     * 2. Execute PRAGMA rekey on the database
     * 3. Store encrypted new passphrase
     * 4. Update rotation timestamp
     *
     * CRITICAL: This must be called with an open database connection.
     *
     * @param database The open SQLiteDatabase instance
     * @return true if rotation succeeded, false otherwise
     */
    fun rotatePassphrase(database: SQLiteDatabase): Boolean {
        check(securePrefs.isUnlocked()) { "Secure storage unavailable while device locked" }

        return synchronized(lock) {
            try {
                SafeLog.i(TAG, "Starting SQLCipher passphrase rotation")

                // Generate new passphrase
                val newPassphrase = ByteArray(PASSPHRASE_LENGTH)
                secureRandom.nextBytes(newPassphrase)

                try {
                    // Convert to hex string for PRAGMA rekey
                    val newPassphraseHex = newPassphrase.joinToString("") { "%02x".format(it) }

                    // Rekey the database
                    database.rawExecSQL("PRAGMA rekey = \"x'$newPassphraseHex'\";")

                    // Store encrypted new passphrase
                    val engine = currentEngine()
                    val encrypted = encryptionManager.encrypt(newPassphrase, engine)
                    val encoded = encrypted.toBase64()
                    securePrefs.putString(PREF_KEY, encode(encoded))

                    // Record rotation timestamp
                    recordRotation()

                    SafeLog.i(TAG, "SQLCipher passphrase rotation completed successfully")
                    true
                } finally {
                    // Zero out sensitive data
                    newPassphrase.fill(0)
                }
            } catch (e: Exception) {
                SafeLog.e(TAG, "Failed to rotate SQLCipher passphrase", e)
                false
            }
        }
    }

    /**
     * Record the current timestamp as the last rotation time.
     */
    private fun recordRotation() {
        securePrefs.putLong(PREF_LAST_ROTATION, System.currentTimeMillis())
    }

    /**
     * Get the number of days since last passphrase rotation.
     * Returns -1 if no rotation has been recorded.
     */
    fun daysSinceLastRotation(): Int {
        val lastRotation = securePrefs.getLong(PREF_LAST_ROTATION, 0L)
        if (lastRotation == 0L) return -1

        val daysSince = (System.currentTimeMillis() - lastRotation) / (1000 * 60 * 60 * 24)
        return daysSince.toInt()
    }

    companion object {
        private const val TAG = "SqlCipherPassphrase"
        private const val PREF_KEY = "sqlcipher_passphrase_encrypted"
        private const val PREF_LAST_ROTATION = "sqlcipher_passphrase_last_rotation"
        private const val KEYSET_PREFS = "sqlcipher_passphrase_keyset_store"
        private const val KEYSET_NAME = "sqlcipher_passphrase_keyset"
        private const val PASSPHRASE_LENGTH = 32
        private const val DELIMITER = ":"
        private const val ROTATION_INTERVAL_DAYS = 90L
        private val lock = Any()
    }
}
