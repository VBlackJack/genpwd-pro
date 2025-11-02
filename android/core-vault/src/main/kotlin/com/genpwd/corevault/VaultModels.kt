package com.genpwd.corevault

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Represents a unique vault identifier on a remote provider.
 */
@Serializable
data class VaultId(
    val remotePath: String,
    val provider: ProviderKind,
    val accountId: String,
)

/**
 * Minimal metadata about a vault used locally and remotely.
 */
@Serializable
data class VaultMeta(
    val id: VaultId,
    val name: String,
    val version: Long,
    val lastModifiedUtc: Long,
    val size: Long,
    val remoteEtag: String? = null,
)

/**
 * An item stored inside the vault. The actual payload is opaque to this module.
 */
@Serializable
data class VaultItem(
    val itemId: String,
    val encryptedBlob: String,
    val updatedAtUtc: Long,
)

/**
 * Item-level change tracking metadata. Stored inside the compressed journal.
 */
@Serializable
data class VaultChange(
    val changeId: String,
    val itemId: String,
    @SerialName("op")
    val operation: Operation,
    val updatedAtUtc: Long,
    val updatedByDevice: String,
) {
    @Serializable
    enum class Operation {
        ADD,
        UPDATE,
        DELETE,
    }
}

/**
 * Complete vault representation with metadata, payload and change vector.
 */
@Serializable
data class Vault(
    val meta: VaultMeta,
    val items: List<VaultItem>,
    val changeVector: String,
    val journal: List<VaultChange>,
)

/**
 * Result returned after encrypting a vault.
 */
data class EncryptedVault(
    val payload: ByteArray,
    val header: VaultHeader,
    val localEtag: String,
)

/**
 * Header stored alongside the encrypted payload. The header is authenticated via AEAD.
 */
@Serializable
data class VaultHeader(
    val formatVersion: Int,
    val cipher: CipherKind,
    val kdf: KdfParameters,
    val nonce: String,
    val salt: String,
    val deviceId: String,
    val createdUtc: Long,
) {
    @Serializable
    enum class CipherKind {
        AES_256_GCM,
        CHACHA20_POLY1305,
    }
}

/**
 * Parameters used to derive the encryption key from the user supplied secret.
 */
@Serializable
sealed interface KdfParameters {
    val salt: String

    @Serializable
    @SerialName("argon2id")
    data class Argon2id(
        override val salt: String,
        val iterations: Int,
        val memoryKb: Int,
        val parallelism: Int,
        val hashLength: Int,
    ) : KdfParameters

    @Serializable
    @SerialName("pbkdf2")
    data class Pbkdf2(
        override val salt: String,
        val iterations: Int,
        val hashLength: Int,
    ) : KdfParameters
}

/**
 * Enum representing the different cloud provider types.
 */
@Serializable
enum class ProviderKind {
    GOOGLE_DRIVE,
    DROPBOX,
    ONEDRIVE,
    WEBDAV,
    NEXTCLOUD
}

/**
 * Represents a pending operation on a vault item that needs to be synced.
 */
@Serializable
sealed class PendingOp {
    @Serializable
    @SerialName("add")
    data class Add(val item: VaultItem) : PendingOp()

    @Serializable
    @SerialName("update")
    data class Update(val item: VaultItem) : PendingOp()

    @Serializable
    @SerialName("delete")
    data class Delete(val itemId: String) : PendingOp()
}

/**
 * Represents the synchronization state of a vault.
 */
@Serializable
data class SyncState(
    val vaultId: VaultId,
    val lastSyncUtc: Long,
    val localEtag: String?,
    val remoteEtag: String?,
    val pendingOps: List<PendingOp>
)
