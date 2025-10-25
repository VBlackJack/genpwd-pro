package com.julien.genpwdpro.data.local.database

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.julien.genpwdpro.data.local.dao.PasswordHistoryDao
import com.julien.genpwdpro.data.local.entity.PasswordHistoryEntity

/**
 * Base de données Room de l'application
 */
@Database(
    entities = [PasswordHistoryEntity::class],
    version = 2,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun passwordHistoryDao(): PasswordHistoryDao

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
    }
}
