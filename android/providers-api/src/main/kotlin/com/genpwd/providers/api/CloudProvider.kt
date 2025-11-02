package com.genpwd.providers.api

import com.genpwd.corevault.VaultId
import com.genpwd.corevault.VaultMeta
import kotlinx.coroutines.flow.Flow

/**
 * Represents a signed in account on a given cloud provider.
 */
data class ProviderAccount(
    val id: String,
    val displayName: String,
    val accessToken: String,
    val refreshToken: String?,
    val expiresAtEpochSeconds: Long?,
)

/**
 * Defines the provider specific change token format when fetching incremental updates.
 */
data class ProviderChanges(
    val cursor: String?,
    val updatedVaults: List<VaultMeta>,
    val deletedVaultIds: List<VaultId>,
)

/**
 * Wrapper around a byte array payload which carries the etag returned by the provider.
 */
data class ByteArrayWithEtag(
    val bytes: ByteArray,
    val etag: String?,
)

/**
 * Result of an upload call against a provider. Contains the new remote state.
 */
data class ProviderWriteResult(
    val newEtag: String,
    val modifiedUtc: Long,
)

/**
 * Sealed hierarchy to communicate provider specific errors.
 */
sealed class ProviderError(message: String, cause: Throwable? = null) : Exception(message, cause) {
    class Authentication(message: String, cause: Throwable? = null) : ProviderError(message, cause)
    class RateLimited(val retryAfterSeconds: Long?, cause: Throwable? = null) :
        ProviderError("Rate limited", cause)
    class Conflict(message: String, cause: Throwable? = null) : ProviderError(message, cause)
    class Network(message: String, cause: Throwable? = null) : ProviderError(message, cause)
    class Unknown(message: String, cause: Throwable? = null) : ProviderError(message, cause)
}

/**
 * Contract that every cloud provider must implement. All operations are suspending and
 * should surface provider specific limitations through [ProviderError] exceptions.
 */
interface CloudProvider {
    val kind: ProviderKind

    suspend fun authenticate(): ProviderAccount

    suspend fun listVaults(account: ProviderAccount): List<VaultMeta>

    suspend fun download(account: ProviderAccount, id: VaultId): ByteArrayWithEtag

    suspend fun upload(
        account: ProviderAccount,
        id: VaultId,
        data: ByteArray,
        ifMatchEtag: String?,
    ): ProviderWriteResult

    suspend fun createVault(account: ProviderAccount, name: String): VaultMeta

    suspend fun deleteVault(account: ProviderAccount, id: VaultId)

    suspend fun listChanges(account: ProviderAccount, cursor: String?): ProviderChanges?

    /**
     * Emits periodic health information, allowing the sync engine to react to provider
     * outages or throttling without hammering the API.
     */
    fun observeHealth(account: ProviderAccount): Flow<ProviderHealth>
}

/**
 * Health status reported by a provider implementation.
 */
data class ProviderHealth(
    val status: Status,
    val reason: String? = null,
    val retryAfterSeconds: Long? = null,
) {
    enum class Status { OK, DEGRADED, OUTAGE }
}
