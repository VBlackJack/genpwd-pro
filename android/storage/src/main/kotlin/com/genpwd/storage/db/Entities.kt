package com.genpwd.storage.db

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import com.genpwd.corevault.ProviderKind
import com.genpwd.corevault.SyncState
import com.genpwd.corevault.VaultId
import com.genpwd.corevault.VaultMeta
import com.genpwd.providers.api.ProviderAccount
import com.genpwd.storage.toDatabaseKey
import com.genpwd.storage.parseProvider
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Entity(tableName = "accounts")
data class ProviderAccountEntity(
    @PrimaryKey @ColumnInfo(name = "account_id") val accountId: String,
    @ColumnInfo(name = "provider") val provider: ProviderKind,
    @ColumnInfo(name = "display_name") val displayName: String,
    @ColumnInfo(name = "access_token") val accessToken: String,
    @ColumnInfo(name = "refresh_token") val refreshToken: String?,
    @ColumnInfo(name = "expires_at") val expiresAt: Long?,
)

@Entity(tableName = "vault_meta")
data class VaultMetaEntity(
    @PrimaryKey @ColumnInfo(name = "vault_key") val vaultKey: String,
    @ColumnInfo(name = "remote_path") val remotePath: String,
    @ColumnInfo(name = "provider") val provider: ProviderKind,
    @ColumnInfo(name = "account_id") val accountId: String,
    @ColumnInfo(name = "name") val name: String,
    @ColumnInfo(name = "version") val version: Long,
    @ColumnInfo(name = "last_modified_utc") val lastModifiedUtc: Long,
    @ColumnInfo(name = "size") val size: Long,
    @ColumnInfo(name = "remote_etag") val remoteEtag: String?,
)

@Entity(tableName = "sync_state")
data class SyncStateEntity(
    @PrimaryKey @ColumnInfo(name = "vault_key") val vaultKey: String,
    @ColumnInfo(name = "last_sync_utc") val lastSyncUtc: Long,
    @ColumnInfo(name = "local_etag") val localEtag: String?,
    @ColumnInfo(name = "remote_etag") val remoteEtag: String?,
    @ColumnInfo(name = "pending_ops") val pendingOps: String,
)

@Entity(tableName = "pending_ops")
data class PendingOpEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "vault_key") val vaultKey: String,
    @ColumnInfo(name = "payload") val payload: String,
)

@Entity(tableName = "audit_logs")
data class AuditLogEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "vault_key") val vaultKey: String,
    @ColumnInfo(name = "timestamp_utc") val timestampUtc: Long,
    @ColumnInfo(name = "level") val level: String,
    @ColumnInfo(name = "message") val message: String,
)

internal fun VaultMeta.toEntity(): VaultMetaEntity = VaultMetaEntity(
    vaultKey = id.toDatabaseKey(),
    remotePath = id.remotePath,
    provider = id.provider,
    accountId = id.accountId,
    name = name,
    version = version,
    lastModifiedUtc = lastModifiedUtc,
    size = size,
    remoteEtag = remoteEtag,
)

internal fun SyncState.toEntity(json: Json = Json): SyncStateEntity = SyncStateEntity(
    vaultKey = vaultId.toDatabaseKey(),
    lastSyncUtc = lastSyncUtc,
    localEtag = localEtag,
    remoteEtag = remoteEtag,
    pendingOps = json.encodeToString<List<com.genpwd.corevault.PendingOp>>(pendingOps),
)

internal fun VaultMetaEntity.toDomain(): VaultMeta = VaultMeta(
    id = VaultId(
        remotePath = remotePath,
        provider = provider,
        accountId = accountId,
    ),
    name = name,
    version = version,
    lastModifiedUtc = lastModifiedUtc,
    size = size,
    remoteEtag = remoteEtag,
)

internal fun SyncStateEntity.toDomain(json: Json = Json): SyncState = SyncState(
    vaultId = VaultId(
        remotePath = vaultKey.substringAfterLast(":"),
        provider = providerFromKey(),
        accountId = accountIdFromKey(),
    ),
    lastSyncUtc = lastSyncUtc,
    localEtag = localEtag,
    remoteEtag = remoteEtag,
    pendingOps = json.decodeFromString<List<com.genpwd.corevault.PendingOp>>(pendingOps),
)

private fun SyncStateEntity.accountIdFromKey(): String =
    vaultKey.substringAfter(":").substringBefore(":")

private fun SyncStateEntity.providerFromKey(): ProviderKind =
    parseProvider(vaultKey.substringBefore(":"))

internal fun ProviderAccountEntity.toDomain(): ProviderAccount = ProviderAccount(
    id = accountId,
    displayName = displayName,
    accessToken = accessToken,
    refreshToken = refreshToken,
    expiresAtEpochSeconds = expiresAt,
)

internal fun ProviderAccount.toEntity(provider: ProviderKind): ProviderAccountEntity = ProviderAccountEntity(
    accountId = id,
    provider = provider,
    displayName = displayName,
    accessToken = accessToken,
    refreshToken = refreshToken,
    expiresAt = expiresAtEpochSeconds,
)

