package com.julien.genpwdpro.data.local.database

import android.content.Context
import android.util.Base64
import androidx.sqlite.db.SupportSQLiteOpenHelper
import com.julien.genpwdpro.data.secure.SecurePrefs
import com.julien.genpwdpro.security.EncryptedKeystoreData
import com.julien.genpwdpro.security.KeystoreManager
import dagger.hilt.android.qualifiers.ApplicationContext
import java.security.SecureRandom
import javax.inject.Inject
import javax.inject.Singleton
import net.sqlcipher.database.SQLiteDatabase
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
        return SupportFactory(passphrase, null, true)
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

    init {
        SQLiteDatabase.loadLibs(appContext)
    }

    fun getOrCreatePassphrase(): ByteArray {
        check(securePrefs.isUnlocked()) { "Secure storage unavailable while device locked" }

        synchronized(lock) {
            securePrefs.getString(PREF_KEY)?.let { stored ->
                val encrypted = decode(stored)
                return keystoreManager.decrypt(encrypted)
            }

            val passphrase = ByteArray(PASSPHRASE_LENGTH)
            secureRandom.nextBytes(passphrase)

            val encrypted = keystoreManager.encrypt(passphrase, alias = SQLCIPHER_KEY_ALIAS)
            securePrefs.putString(PREF_KEY, encode(encrypted))

            return passphrase
        }
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
        private const val PREF_KEY = "sqlcipher_passphrase_encrypted"
        private const val SQLCIPHER_KEY_ALIAS = "genpwd_sqlcipher_key"
        private const val PASSPHRASE_LENGTH = 32
        private const val DELIMITER = ":"
        private val lock = Any()
    }
}
