package com.julien.genpwdpro.data.session.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface SessionDao {

    @Query("SELECT * FROM sessions WHERE sessionId = :sessionId LIMIT 1")
    suspend fun getById(sessionId: String): SessionEntity?

    @Query("SELECT * FROM sessions ORDER BY lastAccessAtEpochMillis DESC LIMIT 1")
    suspend fun getLatest(): SessionEntity?

    @Query("SELECT * FROM sessions ORDER BY lastAccessAtEpochMillis DESC LIMIT 1")
    fun observeLatest(): Flow<SessionEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: SessionEntity)

    @Query(
        "UPDATE sessions SET lastAccessAtEpochMillis = :lastAccessAtEpochMillis, ttlMillis = :ttlMillis, " +
            "expiresAtEpochMillis = :expiresAtEpochMillis, lastExtendedAtEpochMillis = :lastExtendedAtEpochMillis " +
            "WHERE sessionId = :sessionId"
    )
    suspend fun updateTimestamps(
        sessionId: String,
        lastAccessAtEpochMillis: Long,
        ttlMillis: Long,
        expiresAtEpochMillis: Long,
        lastExtendedAtEpochMillis: Long
    ): Int

    @Query("DELETE FROM sessions WHERE sessionId = :sessionId")
    suspend fun delete(sessionId: String): Int

    @Query("DELETE FROM sessions")
    suspend fun deleteAll(): Int

    @Query("DELETE FROM sessions WHERE expiresAtEpochMillis <= :nowEpochMillis")
    suspend fun deleteExpired(nowEpochMillis: Long): Int
}
