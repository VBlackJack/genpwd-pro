package com.genpwd.corevault

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Represents the identity of a vault on a remote provider.
 */
@Serializable
data class VaultId(
    @SerialName("remote_path") val remotePath: String,
    @SerialName("provider") val provider: ProviderKind,
    @SerialName("account_id") val accountId: String,
)

/**
 * Enumeration of supported providers.
 */
@Serializable
enum class ProviderKind {
    GOOGLE_DRIVE,
    MICROSOFT_GRAPH,
    DROPBOX,
    WEBDAV,
}

/**
 * Metadata associated with a vault that lives remotely.
 */
@Serializable
data class VaultMeta(
    val id: VaultId,
    val name: String,
    val version: Long,
    @SerialName("last_modified_utc") val lastModifiedUtc: Long,
    val size: Long,
    @SerialName("remote_etag") val remoteEtag: String?,
)

/**
 * Represents a single logical item inside a vault. The content is stored encrypted in the
 * binary payload and never leaves the device in clear text.
 */
@Serializable
data class VaultItem(
    val itemId: String,
    val encryptedPayload: String,
    @SerialName("updated_at") val updatedAt: Long,
    @SerialName("updated_by") val updatedBy: String,
)

/**
 * Snapshot of a vault along with its internal change vector used for conflict resolution.
 */
@Serializable
data class Vault(
    val meta: VaultMeta,
    val items: List<VaultItem>,
    @SerialName("change_vector") val changeVector: String,
)

/**
 * Represents a pending operation that needs to be sent to the remote provider once the
 * device regains connectivity.
 */
@Serializable
sealed class PendingOp {
    abstract val changeId: String
    abstract val updatedAtUtc: Long

    @Serializable
    @SerialName("add")
    data class Add(
        override val changeId: String,
        override val updatedAtUtc: Long,
        val item: VaultItem,
    ) : PendingOp()

    @Serializable
    @SerialName("update")
    data class Update(
        override val changeId: String,
        override val updatedAtUtc: Long,
        val item: VaultItem,
    ) : PendingOp()

    @Serializable
    @SerialName("delete")
    data class Delete(
        override val changeId: String,
        override val updatedAtUtc: Long,
        val itemId: String,
    ) : PendingOp()
}

/**
 * Tracks the synchronisation state for a vault on a device.
 */
@Serializable
data class SyncState(
    val vaultId: VaultId,
    @SerialName("last_sync_utc") val lastSyncUtc: Long,
    @SerialName("local_etag") val localEtag: String?,
    @SerialName("remote_etag") val remoteEtag: String?,
    @SerialName("pending_ops") val pendingOps: List<PendingOp>,
)
