package com.genpwd.storage.db.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import com.genpwd.corevault.ProviderKind

/**
 * Room entity for storing cloud account credentials.
 *
 * Note: Sensitive data (access_token, refresh_token) should be encrypted
 * before storing in the database.
 */
@Entity(tableName = "cloud_accounts")
data class CloudAccountEntity(
    @PrimaryKey
    val id: String,

    @ColumnInfo(name = "provider_kind")
    val providerKind: ProviderKind,

    @ColumnInfo(name = "display_name")
    val displayName: String,

    @ColumnInfo(name = "email")
    val email: String?,

    /**
     * OAuth access token (encrypted)
     */
    @ColumnInfo(name = "access_token")
    val accessToken: String,

    /**
     * OAuth refresh token (encrypted)
     */
    @ColumnInfo(name = "refresh_token")
    val refreshToken: String?,

    /**
     * Token expiration timestamp in milliseconds
     */
    @ColumnInfo(name = "expires_at")
    val expiresAt: Long,

    /**
     * Account creation timestamp
     */
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),

    /**
     * Last successful sync timestamp
     */
    @ColumnInfo(name = "last_sync")
    val lastSync: Long? = null,

    /**
     * Whether the account is currently active/enabled
     */
    @ColumnInfo(name = "is_active")
    val isActive: Boolean = true
)
