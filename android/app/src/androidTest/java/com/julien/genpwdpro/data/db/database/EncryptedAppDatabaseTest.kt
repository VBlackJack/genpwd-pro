package com.julien.genpwdpro.data.db.database

import android.content.Context
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.julien.genpwdpro.data.db.entity.PasswordHistoryEntity
import com.julien.genpwdpro.data.encryption.EncryptionManager
import com.julien.genpwdpro.data.secure.SecurePrefs
import kotlinx.coroutines.runBlocking
import net.sqlcipher.database.SQLiteException
import net.sqlcipher.database.SupportFactory
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

@RunWith(AndroidJUnit4::class)
class EncryptedAppDatabaseTest {

    private lateinit var context: Context
    private lateinit var securePrefs: SecurePrefs

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        securePrefs = SecurePrefs(context)
        securePrefs.clearAll()
        context.deleteDatabase(TEST_DB_NAME)
    }

    @After
    fun tearDown() {
        context.deleteDatabase(TEST_DB_NAME)
        securePrefs.clearAll()
    }

    @Test
    fun encryptedDatabasePersistsData() = runBlocking {
        val database = createEncryptedDatabase()

        val entry = PasswordHistoryEntity(
            id = "entry-1",
            password = "encrypted-pass",
            entropy = 42.0,
            mode = "SYLLABLES",
            timestamp = 1735689600000L,
            settingsJson = "{}",
            isFavorite = true,
            note = "Integration test entry"
        )

        database.passwordHistoryDao().insert(entry)
        val loaded = database.passwordHistoryDao().getById(entry.id)

        assertEquals(entry, loaded)

        database.close()
    }

    @Test
    fun openingWithWrongPassphraseFails() {
        val factoryProvider = createFactoryProvider()
        val encryptedDb = createDatabaseBuilder(factoryProvider)
            .build()
        encryptedDb.openHelper.writableDatabase.close()
        encryptedDb.close()

        val wrongFactory = SupportFactory("incorrect-passphrase".toByteArray())

        assertFailsWith<SQLiteException> {
            createDatabaseBuilder(factoryProvider = null)
                .openHelperFactory(wrongFactory)
                .build()
                .openHelper
                .writableDatabase
        }
    }

    private fun createEncryptedDatabase(): AppDatabase {
        val factoryProvider = createFactoryProvider()
        return createDatabaseBuilder(factoryProvider)
            .build()
    }

    private fun createDatabaseBuilder(
        factoryProvider: SqlCipherDatabaseOpenHelperFactoryProvider?
    ): RoomDatabase.Builder<AppDatabase> {
        val builder = Room.databaseBuilder(context, AppDatabase::class.java, TEST_DB_NAME)
            .addMigrations(
                AppDatabase.MIGRATION_1_2,
                AppDatabase.MIGRATION_2_3,
                AppDatabase.MIGRATION_3_4,
                AppDatabase.MIGRATION_4_5,
                AppDatabase.MIGRATION_5_6,
                AppDatabase.MIGRATION_6_7,
                AppDatabase.MIGRATION_7_8
            )
            .allowMainThreadQueries()

        if (factoryProvider != null) {
            builder.openHelperFactory(factoryProvider.provideFactory())
        }

        return builder
    }

    private fun createFactoryProvider(): SqlCipherDatabaseOpenHelperFactoryProvider {
        val encryptionManager = EncryptionManager()
        val passphraseProvider = SqlCipherPassphraseProvider(context, securePrefs, encryptionManager)
        return SqlCipherDatabaseOpenHelperFactoryProvider(passphraseProvider)
    }

    companion object {
        private const val TEST_DB_NAME = "encrypted-test.db"
    }
}
