package com.julien.genpwdpro.data.session.db

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.julien.genpwdpro.data.session.db.converters.SessionAttributesConverter

@Database(
    entities = [SessionEntity::class],
    version = 2,
    exportSchema = false
)
@TypeConverters(SessionAttributesConverter::class)
abstract class SessionDatabase : RoomDatabase() {
    abstract fun sessionDao(): SessionDao

    companion object {
        const val DATABASE_NAME = "session_store"
    }
}
