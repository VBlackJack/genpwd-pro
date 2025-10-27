package com.julien.genpwdpro.data.local.database

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.julien.genpwdpro.data.local.dao.*
import com.julien.genpwdpro.data.local.entity.*

/**
 * Base de données Room de l'application
 */
@Database(
    entities = [
        PasswordHistoryEntity::class,
        VaultEntity::class,
        VaultEntryEntity::class,
        FolderEntity::class,
        TagEntity::class,
        EntryTagCrossRef::class
    ],
    version = 4,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun passwordHistoryDao(): PasswordHistoryDao
    abstract fun vaultDao(): VaultDao
    abstract fun vaultEntryDao(): VaultEntryDao
    abstract fun folderDao(): FolderDao
    abstract fun tagDao(): TagDao

    companion object {
        const val DATABASE_NAME = "genpwd_database"

        /**
         * Migration 1 → 2: Ajout des colonnes isFavorite et note
         */
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(database: SupportSQLiteDatabase) {
                // Ajouter la colonne isFavorite avec valeur par défaut 0 (false)
                database.execSQL("ALTER TABLE password_history ADD COLUMN isFavorite INTEGER NOT NULL DEFAULT 0")

                // Ajouter la colonne note avec valeur par défaut ''
                database.execSQL("ALTER TABLE password_history ADD COLUMN note TEXT NOT NULL DEFAULT ''")
            }
        }

        /**
         * Migration 2 → 3: Ajout du système de vault complet
         */
        val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(database: SupportSQLiteDatabase) {
                // Table vaults
                database.execSQL("""
                    CREATE TABLE IF NOT EXISTS vaults (
                        id TEXT NOT NULL PRIMARY KEY,
                        name TEXT NOT NULL,
                        description TEXT NOT NULL DEFAULT '',
                        masterPasswordHash TEXT NOT NULL,
                        salt TEXT NOT NULL,
                        encryptedKey TEXT NOT NULL,
                        keyIv TEXT NOT NULL,
                        iterations INTEGER NOT NULL DEFAULT 3,
                        memory INTEGER NOT NULL DEFAULT 65536,
                        parallelism INTEGER NOT NULL DEFAULT 4,
                        createdAt INTEGER NOT NULL,
                        modifiedAt INTEGER NOT NULL,
                        lastAccessedAt INTEGER NOT NULL,
                        entryCount INTEGER NOT NULL DEFAULT 0,
                        autoLockTimeout INTEGER NOT NULL DEFAULT 5,
                        biometricUnlockEnabled INTEGER NOT NULL DEFAULT 0,
                        isDefault INTEGER NOT NULL DEFAULT 0,
                        icon TEXT NOT NULL DEFAULT '🔐',
                        color TEXT NOT NULL DEFAULT '#1976D2'
                    )
                """)

                // Table folders
                database.execSQL("""
                    CREATE TABLE IF NOT EXISTS folders (
                        id TEXT NOT NULL PRIMARY KEY,
                        vaultId TEXT NOT NULL,
                        parentFolderId TEXT,
                        name TEXT NOT NULL,
                        icon TEXT NOT NULL DEFAULT '📁',
                        color TEXT,
                        sortOrder INTEGER NOT NULL DEFAULT 0,
                        createdAt INTEGER NOT NULL,
                        modifiedAt INTEGER NOT NULL,
                        FOREIGN KEY (vaultId) REFERENCES vaults(id) ON DELETE CASCADE,
                        FOREIGN KEY (parentFolderId) REFERENCES folders(id) ON DELETE CASCADE
                    )
                """)
                database.execSQL("CREATE INDEX IF NOT EXISTS index_folders_vaultId ON folders(vaultId)")
                database.execSQL("CREATE INDEX IF NOT EXISTS index_folders_parentFolderId ON folders(parentFolderId)")
                database.execSQL("CREATE INDEX IF NOT EXISTS index_folders_name ON folders(name)")

                // Table vault_entries
                database.execSQL("""
                    CREATE TABLE IF NOT EXISTS vault_entries (
                        id TEXT NOT NULL PRIMARY KEY,
                        vaultId TEXT NOT NULL,
                        folderId TEXT,
                        encryptedTitle TEXT NOT NULL,
                        titleIv TEXT NOT NULL,
                        encryptedUsername TEXT NOT NULL DEFAULT '',
                        usernameIv TEXT NOT NULL DEFAULT '',
                        encryptedPassword TEXT NOT NULL,
                        passwordIv TEXT NOT NULL,
                        encryptedUrl TEXT NOT NULL DEFAULT '',
                        urlIv TEXT NOT NULL DEFAULT '',
                        encryptedNotes TEXT NOT NULL DEFAULT '',
                        notesIv TEXT NOT NULL DEFAULT '',
                        encryptedCustomFields TEXT NOT NULL DEFAULT '',
                        customFieldsIv TEXT NOT NULL DEFAULT '',
                        entryType TEXT NOT NULL DEFAULT 'LOGIN',
                        isFavorite INTEGER NOT NULL DEFAULT 0,
                        passwordStrength INTEGER NOT NULL DEFAULT 0,
                        passwordEntropy REAL NOT NULL DEFAULT 0.0,
                        generationMode TEXT,
                        createdAt INTEGER NOT NULL,
                        modifiedAt INTEGER NOT NULL,
                        lastAccessedAt INTEGER NOT NULL,
                        passwordExpiresAt INTEGER NOT NULL DEFAULT 0,
                        requiresPasswordChange INTEGER NOT NULL DEFAULT 0,
                        usageCount INTEGER NOT NULL DEFAULT 0,
                        icon TEXT,
                        color TEXT,
                        hasTOTP INTEGER NOT NULL DEFAULT 0,
                        encryptedTotpSecret TEXT NOT NULL DEFAULT '',
                        totpSecretIv TEXT NOT NULL DEFAULT '',
                        totpPeriod INTEGER NOT NULL DEFAULT 30,
                        totpDigits INTEGER NOT NULL DEFAULT 6,
                        totpAlgorithm TEXT NOT NULL DEFAULT 'SHA1',
                        totpIssuer TEXT NOT NULL DEFAULT '',
                        hasPasskey INTEGER NOT NULL DEFAULT 0,
                        encryptedPasskeyData TEXT NOT NULL DEFAULT '',
                        passkeyDataIv TEXT NOT NULL DEFAULT '',
                        passkeyRpId TEXT NOT NULL DEFAULT '',
                        passkeyRpName TEXT NOT NULL DEFAULT '',
                        passkeyUserHandle TEXT NOT NULL DEFAULT '',
                        passkeyCreatedAt INTEGER NOT NULL DEFAULT 0,
                        passkeyLastUsedAt INTEGER NOT NULL DEFAULT 0,
                        FOREIGN KEY (vaultId) REFERENCES vaults(id) ON DELETE CASCADE,
                        FOREIGN KEY (folderId) REFERENCES folders(id) ON DELETE SET NULL
                    )
                """)
                database.execSQL("CREATE INDEX IF NOT EXISTS index_vault_entries_vaultId ON vault_entries(vaultId)")
                database.execSQL("CREATE INDEX IF NOT EXISTS index_vault_entries_folderId ON vault_entries(folderId)")
                database.execSQL("CREATE INDEX IF NOT EXISTS index_vault_entries_isFavorite ON vault_entries(isFavorite)")
                database.execSQL("CREATE INDEX IF NOT EXISTS index_vault_entries_createdAt ON vault_entries(createdAt)")
                database.execSQL("CREATE INDEX IF NOT EXISTS index_vault_entries_modifiedAt ON vault_entries(modifiedAt)")

                // Table tags
                database.execSQL("""
                    CREATE TABLE IF NOT EXISTS tags (
                        id TEXT NOT NULL PRIMARY KEY,
                        vaultId TEXT NOT NULL,
                        name TEXT NOT NULL,
                        color TEXT NOT NULL,
                        createdAt INTEGER NOT NULL,
                        FOREIGN KEY (vaultId) REFERENCES vaults(id) ON DELETE CASCADE
                    )
                """)
                database.execSQL("CREATE INDEX IF NOT EXISTS index_tags_vaultId ON tags(vaultId)")
                database.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_tags_name ON tags(name)")

                // Table entry_tag_cross_ref
                database.execSQL("""
                    CREATE TABLE IF NOT EXISTS entry_tag_cross_ref (
                        entryId TEXT NOT NULL,
                        tagId TEXT NOT NULL,
                        PRIMARY KEY (entryId, tagId),
                        FOREIGN KEY (entryId) REFERENCES vault_entries(id) ON DELETE CASCADE,
                        FOREIGN KEY (tagId) REFERENCES tags(id) ON DELETE CASCADE
                    )
                """)
                database.execSQL("CREATE INDEX IF NOT EXISTS index_entry_tag_cross_ref_entryId ON entry_tag_cross_ref(entryId)")
                database.execSQL("CREATE INDEX IF NOT EXISTS index_entry_tag_cross_ref_tagId ON entry_tag_cross_ref(tagId)")
            }
        }

        /**
         * Migration 3 → 4: Ajout du stockage du master password pour biométrie
         */
        val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(database: SupportSQLiteDatabase) {
                // Ajouter colonnes pour stocker le master password chiffré
                database.execSQL("ALTER TABLE vaults ADD COLUMN encryptedMasterPassword BLOB")
                database.execSQL("ALTER TABLE vaults ADD COLUMN masterPasswordIv BLOB")
            }
        }
    }
}
