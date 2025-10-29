package com.julien.genpwdpro.data.local.database

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.widget.Toast
import androidx.sqlite.db.SupportSQLiteOpenHelper
import com.julien.genpwdpro.R
import com.julien.genpwdpro.data.secure.SecurePrefs
import com.julien.genpwdpro.security.EncryptedKeystoreData
import com.julien.genpwdpro.security.KeystoreManager
import com.julien.genpwdpro.security.KeystoreAlias
import dagger.hilt.android.qualifiers.ApplicationContext
import java.security.SecureRandom
import javax.inject.Inject
import javax.inject.Singleton
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
            // Higher PBKDF2 iterations harden key stretching at the cost of unlock latency.
            database?.rawExecSQL("PRAGMA kdf_iter = 256000;")
            database?.rawExecSQL("PRAGMA cipher_memory_security = ON;")
        }
    }
}

@Singleton
class SqlCipherPassphraseProvider @Inject constructor(
    @ApplicationContext context: Context,
    private val securePrefs: SecurePrefs,
    private val keystoreManager: KeystoreManager
) {

    private val appContext = context.applicationContext
    private val secureRandom = SecureRandom()
    private val handler = Handler(Looper.getMainLooper())
    private val sqlCipherAlias = KeystoreAlias.SQL_CIPHER

    init {
        SQLiteDatabase.loadLibs(appContext)
    }

    fun getOrCreatePassphrase(): ByteArray {
        check(securePrefs.isUnlocked()) { "Secure storage unavailable while device locked" }

        synchronized(lock) {
            securePrefs.getString(PREF_KEY)?.let { stored ->
                val encrypted = decode(stored)
                return recoverPassphrase(encrypted)
            }

            return generateAndStorePassphrase()
        }
    }

    private fun recoverPassphrase(encrypted: EncryptedKeystoreData): ByteArray {
        return runCatching {
            val passphrase = keystoreManager.decrypt(encrypted)
            securePrefs.putBoolean(PREF_KEY_RECOVERY_NOTICE, false)
            maybeRewrapAlias(passphrase, encrypted)
            passphrase
        }.getOrElse { throwable ->
            handleInvalidatedKey(throwable)
        }
    }

    private fun maybeRewrapAlias(passphrase: ByteArray, encrypted: EncryptedKeystoreData) {
        if (keystoreManager.isCurrentAlias(encrypted.keyAlias, sqlCipherAlias)) {
            return
        }

        val reencrypted = keystoreManager.encrypt(passphrase, alias = sqlCipherAlias.alias)
        securePrefs.putString(PREF_KEY, encode(reencrypted))

        if (keystoreManager.isLegacyAlias(encrypted.keyAlias, sqlCipherAlias)) {
            keystoreManager.deleteKey(encrypted.keyAlias)
        }
    }

    private fun generateAndStorePassphrase(resetRecoveryFlag: Boolean = true): ByteArray {
        val passphrase = ByteArray(PASSPHRASE_LENGTH)
        secureRandom.nextBytes(passphrase)

        val encrypted = keystoreManager.encrypt(passphrase, alias = sqlCipherAlias.alias)
        securePrefs.putString(PREF_KEY, encode(encrypted))
        if (resetRecoveryFlag) {
            securePrefs.putBoolean(PREF_KEY_RECOVERY_NOTICE, false)
        }

        return passphrase
    }

    private fun handleInvalidatedKey(throwable: Throwable): ByteArray {
        Log.w(TAG, "SQLCipher key invalidated, regenerating", throwable)

        if (!securePrefs.getBoolean(PREF_KEY_RECOVERY_NOTICE, false)) {
            securePrefs.putBoolean(PREF_KEY_RECOVERY_NOTICE, true)
            handler.post {
                Toast.makeText(
                    appContext,
                    appContext.getString(R.string.sqlcipher_recovery_notice),
                    Toast.LENGTH_LONG
                ).show()
            }
        }

        securePrefs.remove(PREF_KEY)
        return generateAndStorePassphrase(resetRecoveryFlag = false)
    }

    private fun encode(data: EncryptedKeystoreData): String {
        val cipher = Base64.encodeToString(data.ciphertext, Base64.NO_WRAP)
        val iv = Base64.encodeToString(data.iv, Base64.NO_WRAP)
        return listOf(cipher, iv, data.keyAlias).joinToString(DELIMITER)
    }

    private fun decode(serialized: String): EncryptedKeystoreData {
        val parts = serialized.split(DELIMITER)
        require(parts.size == 3) { "Malformed SQLCipher secret" }
        val ciphertext = Base64.decode(parts[0], Base64.NO_WRAP)
        val iv = Base64.decode(parts[1], Base64.NO_WRAP)
        val alias = parts[2]
        return EncryptedKeystoreData(ciphertext, iv, alias)
    }

    companion object {
        private const val TAG = "SqlCipherPassphrase"
        private const val PREF_KEY = "sqlcipher_passphrase_encrypted"
        private const val PREF_KEY_RECOVERY_NOTICE = "sqlcipher_passphrase_recovery_notice"
        private const val PASSPHRASE_LENGTH = 32
        private const val DELIMITER = ":"
        private val lock = Any()
    }
}
