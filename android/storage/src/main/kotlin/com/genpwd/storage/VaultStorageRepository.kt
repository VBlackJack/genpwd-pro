package com.genpwd.storage

import com.genpwd.corevault.EncryptedVault
import com.genpwd.corevault.PendingOp
import com.genpwd.corevault.SyncState
import com.genpwd.corevault.VaultId
import com.genpwd.corevault.VaultMeta
import com.genpwd.storage.cache.EncryptedVaultCache
import com.genpwd.storage.db.AuditLogDao
import com.genpwd.storage.db.AuditLogEntity
import com.genpwd.storage.db.GenPwdDatabase
import com.genpwd.storage.db.PendingOpEntity
import com.genpwd.storage.db.SyncStateDao
import com.genpwd.storage.db.VaultMetaDao
import com.genpwd.storage.db.toDomain
import com.genpwd.storage.db.toEntity
import com.genpwd.storage.db.toDomain as accountToDomain
import com.genpwd.storage.db.toEntity as accountToEntity
import com.genpwd.providers.api.ProviderAccount
import com.genpwd.corevault.ProviderKind
import com.genpwd.storage.toDatabaseKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class VaultStorageRepository @Inject constructor(
    private val database: GenPwdDatabase,
    private val cache: EncryptedVaultCache,
    private val json: Json,
) {
    private val vaultMetaDao: VaultMetaDao = database.vaultMetaDao()
    private val syncStateDao: SyncStateDao = database.syncStateDao()
    private val auditLogDao: AuditLogDao = database.auditLogDao()
    private val accountDao = database.providerAccountDao()

    fun observeVaults(): Flow<List<VaultMeta>> = vaultMetaDao
        .observeAll()
        .map { list -> list.map { it.toDomain() } }

    suspend fun upsertVaultMeta(meta: VaultMeta) {
        vaultMetaDao.upsert(meta.toEntity())
    }

    suspend fun getVaultMeta(vaultId: VaultId): VaultMeta? =
        vaultMetaDao.get(vaultId.toDatabaseKey())?.toDomain()

    suspend fun upsertAccount(provider: ProviderKind, account: ProviderAccount) {
        accountDao.insert(account.accountToEntity(provider))
    }

    suspend fun getAccount(provider: ProviderKind, accountId: String): ProviderAccount? =
        accountDao.get(accountId)?.takeIf { it.provider == provider }?.accountToDomain()

    suspend fun deleteVaultMeta(vaultId: VaultId) {
        vaultMetaDao.delete(vaultId.toDatabaseKey())
        cache.clear(vaultId)
    }

    suspend fun readSyncState(vaultId: VaultId): SyncState? =
        syncStateDao.get(vaultId.toDatabaseKey())?.toDomain(json)

    suspend fun upsertSyncState(state: SyncState) {
        syncStateDao.upsert(state.toEntity(json))
    }

    suspend fun listPendingOps(vaultId: VaultId): List<PendingOp> =
        database.pendingOpDao().listForVault(vaultId.toDatabaseKey()).map { entity ->
            json.decodeFromString<PendingOp>(entity.payload)
        }

    suspend fun enqueuePendingOp(vaultId: VaultId, op: PendingOp) {
        val payload = json.encodeToString(op)
        database.pendingOpDao().insert(
            PendingOpEntity(
                vaultKey = vaultId.toDatabaseKey(),
                payload = payload,
            ),
        )
    }

    suspend fun clearPendingOps(vaultId: VaultId) {
        database.pendingOpDao().clearVault(vaultId.toDatabaseKey())
    }

    suspend fun appendAuditLog(vaultId: VaultId, level: String, message: String, timestampUtc: Long) {
        auditLogDao.insert(
            AuditLogEntity(
                vaultKey = vaultId.toDatabaseKey(),
                timestampUtc = timestampUtc,
                level = level,
                message = message,
            ),
        )
    }

    suspend fun writeEncryptedVault(vaultId: VaultId, encryptedVault: EncryptedVault) {
        cache.write(vaultId, encryptedVault)
    }

    fun readEncryptedVault(vaultId: VaultId): EncryptedVault? = cache.read(vaultId)
}
