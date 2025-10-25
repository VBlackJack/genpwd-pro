package com.julien.genpwdpro.data.local.database

import androidx.room.Database
import androidx.room.RoomDatabase
import com.julien.genpwdpro.data.local.dao.PasswordHistoryDao
import com.julien.genpwdpro.data.local.entity.PasswordHistoryEntity

/**
 * Base de données Room de l'application
 */
@Database(
    entities = [PasswordHistoryEntity::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun passwordHistoryDao(): PasswordHistoryDao

    companion object {
        const val DATABASE_NAME = "genpwd_database"
    }
}
