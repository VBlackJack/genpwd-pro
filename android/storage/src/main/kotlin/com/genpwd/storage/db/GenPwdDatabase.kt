package com.genpwd.storage.db

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.genpwd.storage.db.dao.CloudAccountDao
import com.genpwd.storage.db.entities.CloudAccountEntity

@Database(
    entities = [
        ProviderAccountEntity::class,
        VaultMetaEntity::class,
        SyncStateEntity::class,
        PendingOpEntity::class,
        AuditLogEntity::class,
        CloudAccountEntity::class,
    ],
    version = 2,
    exportSchema = true,
)
@TypeConverters(Converters::class)
abstract class GenPwdDatabase : RoomDatabase() {
    abstract fun providerAccountDao(): ProviderAccountDao
    abstract fun vaultMetaDao(): VaultMetaDao
    abstract fun syncStateDao(): SyncStateDao
    abstract fun pendingOpDao(): PendingOpDao
    abstract fun auditLogDao(): AuditLogDao
    abstract fun cloudAccountDao(): CloudAccountDao

    companion object {
        /**
         * Migration from version 1 to version 2: Add cloud_accounts table.
         */
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(database: SupportSQLiteDatabase) {
                database.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS cloud_accounts (
                        id TEXT PRIMARY KEY NOT NULL,
                        provider_kind TEXT NOT NULL,
                        display_name TEXT NOT NULL,
                        email TEXT,
                        access_token TEXT NOT NULL,
                        refresh_token TEXT,
                        expires_at INTEGER NOT NULL,
                        created_at INTEGER NOT NULL,
                        last_sync INTEGER,
                        is_active INTEGER NOT NULL DEFAULT 1
                    )
                    """.trimIndent()
                )
            }
        }
    }
}
