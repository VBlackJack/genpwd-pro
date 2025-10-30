package com.julien.genpwdpro.data.session.db

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.julien.genpwdpro.data.db.database.SqlCipherDatabaseOpenHelperFactoryProvider
import com.julien.genpwdpro.data.db.database.SqlCipherPassphraseProvider
import com.julien.genpwdpro.data.encryption.EncryptionManager
import com.julien.genpwdpro.data.secure.SecurePrefs
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SessionDatabaseSecurityTest {

    private lateinit var context: Context
    private lateinit var securePrefs: SecurePrefs
    private lateinit var database: SessionDatabase

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        securePrefs = SecurePrefs(context)
        securePrefs.clearAll()
        context.deleteDatabase(SessionDatabase.DATABASE_NAME)

        val encryptionManager = EncryptionManager()
        val passphraseProvider = SqlCipherPassphraseProvider(
            context,
            securePrefs,
            encryptionManager
        )
        val factoryProvider = SqlCipherDatabaseOpenHelperFactoryProvider(passphraseProvider)

        database = Room.databaseBuilder(
            context,
            SessionDatabase::class.java,
            SessionDatabase.DATABASE_NAME
        )
            .openHelperFactory(factoryProvider.provideFactory())
            .allowMainThreadQueries()
            .build()
    }

    @After
    fun tearDown() {
        database.close()
        context.deleteDatabase(SessionDatabase.DATABASE_NAME)
        securePrefs.clearAll()
    }

    @Test
    fun sessionTableContainsOnlyMetadataColumns() {
        val writable = database.openHelper.writableDatabase
        val expectedColumns = setOf(
            "sessionId",
            "vaultId",
            "createdAtEpochMillis",
            "lastAccessAtEpochMillis",
            "ttlMillis",
            "expiresAtEpochMillis",
            "lastExtendedAtEpochMillis",
            "attributes"
        )

        val actualColumns = writable.query("PRAGMA table_info(sessions)").use { cursor ->
            val nameIndex = cursor.getColumnIndex("name")
            buildSet {
                while (cursor.moveToNext()) {
                    add(cursor.getString(nameIndex))
                }
            }
        }

        assertEquals(expectedColumns, actualColumns)
    }

    @Test
    fun persistedRowsDoNotExposeSecretFields() {
        val dao = database.sessionDao()
        val sessionId = UUID.randomUUID().toString()
        val entity = SessionEntity(
            sessionId = sessionId,
            vaultId = "vault-123",
            createdAtEpochMillis = 1000L,
            lastAccessAtEpochMillis = 2000L,
            ttlMillis = 3000L,
            expiresAtEpochMillis = 4000L,
            lastExtendedAtEpochMillis = 5000L,
            attributes = mapOf("state" to "active")
        )
        dao.upsert(entity)

        val writable = database.openHelper.writableDatabase
        writable.query("SELECT * FROM sessions WHERE sessionId = ?", arrayOf(sessionId)).use { cursor ->
            assertTrue(cursor.moveToFirst())
            val columnCount = cursor.columnCount
            for (index in 0 until columnCount) {
                val columnName = cursor.getColumnName(index)
                assertTrue(
                    columnName in setOf(
                        "sessionId",
                        "vaultId",
                        "createdAtEpochMillis",
                        "lastAccessAtEpochMillis",
                        "ttlMillis",
                        "expiresAtEpochMillis",
                        "lastExtendedAtEpochMillis",
                        "attributes"
                    )
                )
                if (columnName == "sessionId") {
                    assertEquals(sessionId, cursor.getString(index))
                }
                if (columnName == "vaultId") {
                    assertEquals("vault-123", cursor.getString(index))
                }
                if (columnName == "attributes") {
                    val serialized = cursor.getString(index)
                    assertFalse(serialized?.contains("payload") == true)
                    assertFalse(serialized?.contains("secret") == true)
                }
            }
        }
    }
}
