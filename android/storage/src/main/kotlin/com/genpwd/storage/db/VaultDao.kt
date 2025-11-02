package com.genpwd.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface ProviderAccountDao {
    @Query("SELECT * FROM accounts WHERE account_id = :accountId LIMIT 1")
    suspend fun get(accountId: String): ProviderAccountEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: ProviderAccountEntity)

    @Query("DELETE FROM accounts WHERE account_id = :accountId")
    suspend fun delete(accountId: String)
}

@Dao
interface VaultMetaDao {
    @Query("SELECT * FROM vault_meta")
    fun observeAll(): Flow<List<VaultMetaEntity>>

    @Query("SELECT * FROM vault_meta WHERE vault_key = :vaultKey LIMIT 1")
    suspend fun get(vaultKey: String): VaultMetaEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(meta: VaultMetaEntity)

    @Query("DELETE FROM vault_meta WHERE vault_key = :vaultKey")
    suspend fun delete(vaultKey: String)
}

@Dao
interface SyncStateDao {
    @Query("SELECT * FROM sync_state WHERE vault_key = :vaultKey LIMIT 1")
    suspend fun get(vaultKey: String): SyncStateEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(state: SyncStateEntity)

    @Query("DELETE FROM sync_state WHERE vault_key = :vaultKey")
    suspend fun delete(vaultKey: String)
}

@Dao
interface PendingOpDao {
    @Query("SELECT * FROM pending_ops WHERE vault_key = :vaultKey ORDER BY id ASC")
    suspend fun listForVault(vaultKey: String): List<PendingOpEntity>

    @Insert
    suspend fun insert(entity: PendingOpEntity): Long

    @Query("DELETE FROM pending_ops WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("DELETE FROM pending_ops WHERE vault_key = :vaultKey")
    suspend fun clearVault(vaultKey: String)
}

@Dao
interface AuditLogDao {
    @Query("SELECT * FROM audit_logs WHERE vault_key = :vaultKey ORDER BY timestamp_utc DESC LIMIT :limit")
    suspend fun listLatest(vaultKey: String, limit: Int = 100): List<AuditLogEntity>

    @Insert
    suspend fun insert(entity: AuditLogEntity)
}
