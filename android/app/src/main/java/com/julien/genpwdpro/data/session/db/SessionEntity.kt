package com.julien.genpwdpro.data.session.db

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sessions")
data class SessionEntity(
    @PrimaryKey val sessionId: String,
    val vaultId: String,
    @ColumnInfo(typeAffinity = ColumnInfo.BLOB) val payload: ByteArray,
    val createdAtEpochMillis: Long,
    val lastAccessAtEpochMillis: Long,
    val ttlMillis: Long,
    val expiresAtEpochMillis: Long,
    val lastExtendedAtEpochMillis: Long,
    val attributes: Map<String, String> = emptyMap()
)
