package com.genpwd.sync

import com.genpwd.corevault.EncryptedVault
import com.genpwd.corevault.SyncState
import com.genpwd.corevault.Vault
import com.genpwd.corevault.VaultEncoding
import com.genpwd.corevault.VaultMeta
import com.genpwd.corevault.VaultCryptoEngine
import com.genpwd.providers.api.CloudProvider
import com.genpwd.providers.api.ProviderAccount
import com.genpwd.providers.api.ProviderWriteResult
import com.genpwd.storage.VaultStorageRepository
import com.genpwd.sync.conflict.ConflictResolver
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class VaultSyncManager @Inject constructor(
    private val storage: VaultStorageRepository,
    private val providerRegistry: ProviderRegistry,
    private val cryptoEngine: VaultCryptoEngine,
    private val conflictResolver: ConflictResolver,
    private val json: Json,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
) {
    suspend fun syncVault(
        account: ProviderAccount,
        meta: VaultMeta,
        masterPassword: CharArray,
    ): SyncOutcome = withContext(ioDispatcher) {
        val provider = providerRegistry.get(meta.id.provider)
        val syncState = storage.readSyncState(meta.id)
        val pendingOps = storage.listPendingOps(meta.id)
        val localEncrypted = storage.readEncryptedVault(meta.id)
        val localVault = localEncrypted?.let { cryptoEngine.decryptVault(masterPassword, it) }

        val remoteResult = fetchRemoteIfNeeded(provider, account, meta, syncState)
        val remoteEncrypted = remoteResult?.first
        val remoteVault = remoteEncrypted?.let { cryptoEngine.decryptVault(masterPassword, it) }
        val remoteMeta = remoteResult?.second ?: meta

        val resolution = when {
            localVault != null && remoteVault != null -> conflictResolver.merge(localVault, remoteVault, pendingOps)
            remoteVault != null -> conflictResolver.merge(remoteVault, remoteVault, pendingOps)
            localVault != null -> conflictResolver.merge(localVault, localVault, pendingOps)
            else -> return@withContext SyncOutcome.Error("Vault data missing")
        }

        if (resolution.conflicts.isNotEmpty()) {
            storage.appendAuditLog(meta.id, "WARN", "conflicts_detected", Instant.now().epochSecond)
            return@withContext SyncOutcome.Conflict(resolution.merged, resolution.conflicts)
        }

        val mergedVault = resolution.merged
        val shouldUpload = pendingOps.isNotEmpty()
        val uploadResult = if (shouldUpload) {
            pushMergedVault(provider, account, mergedVault, masterPassword, remoteMeta.remoteEtag)
        } else {
            null
        }

        val newEncrypted = cryptoEngine.encryptVault(masterPassword, mergedVault, deviceId = mergedVault.changeVector)
        storage.writeEncryptedVault(meta.id, newEncrypted)
        storage.upsertVaultMeta(remoteMeta.copy(remoteEtag = uploadResult?.newEtag ?: remoteMeta.remoteEtag))
        storage.upsertSyncState(
            SyncState(
                vaultId = meta.id,
                lastSyncUtc = Instant.now().epochSecond,
                localEtag = newEncrypted.localHash,
                remoteEtag = uploadResult?.newEtag ?: remoteResult?.second?.remoteEtag,
                pendingOps = emptyList(),
            ),
        )
        storage.clearPendingOps(meta.id)

        SyncOutcome.Success(
            vault = mergedVault,
            uploaded = uploadResult != null,
            downloaded = remoteResult != null,
        )
    }

    private suspend fun fetchRemoteIfNeeded(
        provider: CloudProvider,
        account: ProviderAccount,
        meta: VaultMeta,
        syncState: SyncState?,
    ): Pair<EncryptedVault, VaultMeta>? {
        val shouldDownload = syncState?.remoteEtag != meta.remoteEtag || syncState == null
        if (!shouldDownload) return null
        val download = provider.download(account, meta.id)
        val encrypted = VaultEncoding.decode(download.bytes, json)
        storage.writeEncryptedVault(meta.id, encrypted)
        return encrypted to meta.copy(remoteEtag = download.etag)
    }

    private suspend fun pushMergedVault(
        provider: CloudProvider,
        account: ProviderAccount,
        vault: Vault,
        masterPassword: CharArray,
        ifMatch: String?,
    ): ProviderWriteResult {
        val encrypted = cryptoEngine.encryptVault(masterPassword, vault, deviceId = vault.changeVector)
        val payload = VaultEncoding.encode(encrypted, json)
        val result = provider.upload(account, vault.meta.id, payload, ifMatch)
        storage.writeEncryptedVault(vault.meta.id, encrypted)
        return result
    }
}

sealed class SyncOutcome {
    data class Success(val vault: Vault, val uploaded: Boolean, val downloaded: Boolean) : SyncOutcome()
    data class Conflict(
        val merged: Vault,
        val conflicts: List<com.genpwd.sync.conflict.ConflictResolver.Conflict>,
    ) : SyncOutcome()

    data class Error(val message: String) : SyncOutcome()
}
