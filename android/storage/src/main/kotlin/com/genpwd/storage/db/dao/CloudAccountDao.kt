package com.genpwd.storage.db.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.genpwd.corevault.ProviderKind
import com.genpwd.storage.db.entities.CloudAccountEntity
import kotlinx.coroutines.flow.Flow

/**
 * DAO for cloud account operations.
 */
@Dao
interface CloudAccountDao {
    /**
     * Get all cloud accounts.
     */
    @Query("SELECT * FROM cloud_accounts ORDER BY created_at DESC")
    fun getAll(): Flow<List<CloudAccountEntity>>

    /**
     * Get all active cloud accounts.
     */
    @Query("SELECT * FROM cloud_accounts WHERE is_active = 1 ORDER BY created_at DESC")
    fun getAllActive(): Flow<List<CloudAccountEntity>>

    /**
     * Get account by ID.
     */
    @Query("SELECT * FROM cloud_accounts WHERE id = :accountId")
    suspend fun getById(accountId: String): CloudAccountEntity?

    /**
     * Get account by provider kind.
     * Returns the first active account for the provider.
     */
    @Query("SELECT * FROM cloud_accounts WHERE provider_kind = :kind AND is_active = 1 LIMIT 1")
    suspend fun getByProviderKind(kind: ProviderKind): CloudAccountEntity?

    /**
     * Get all accounts for a specific provider.
     */
    @Query("SELECT * FROM cloud_accounts WHERE provider_kind = :kind ORDER BY created_at DESC")
    fun getAllByProviderKind(kind: ProviderKind): Flow<List<CloudAccountEntity>>

    /**
     * Insert a new account.
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(account: CloudAccountEntity)

    /**
     * Update an existing account.
     */
    @Update
    suspend fun update(account: CloudAccountEntity)

    /**
     * Delete an account.
     */
    @Delete
    suspend fun delete(account: CloudAccountEntity)

    /**
     * Delete account by ID.
     */
    @Query("DELETE FROM cloud_accounts WHERE id = :accountId")
    suspend fun deleteById(accountId: String)

    /**
     * Update access token and expiry.
     */
    @Query("UPDATE cloud_accounts SET access_token = :accessToken, expires_at = :expiresAt WHERE id = :accountId")
    suspend fun updateToken(accountId: String, accessToken: String, expiresAt: Long)

    /**
     * Update last sync timestamp.
     */
    @Query("UPDATE cloud_accounts SET last_sync = :timestamp WHERE id = :accountId")
    suspend fun updateLastSync(accountId: String, timestamp: Long)

    /**
     * Check if an account exists for a provider.
     */
    @Query("SELECT COUNT(*) > 0 FROM cloud_accounts WHERE provider_kind = :kind AND is_active = 1")
    suspend fun hasAccountForProvider(kind: ProviderKind): Boolean

    /**
     * Deactivate an account (soft delete).
     */
    @Query("UPDATE cloud_accounts SET is_active = 0 WHERE id = :accountId")
    suspend fun deactivate(accountId: String)

    /**
     * Activate an account.
     */
    @Query("UPDATE cloud_accounts SET is_active = 1 WHERE id = :accountId")
    suspend fun activate(accountId: String)

    /**
     * Delete all accounts (for testing/reset).
     */
    @Query("DELETE FROM cloud_accounts")
    suspend fun deleteAll()
}
