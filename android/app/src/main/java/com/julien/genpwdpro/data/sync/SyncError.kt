package com.julien.genpwdpro.data.sync

/**
 * Typed errors for cloud synchronization
 *
 * Provides specific error types for better error handling and retry logic
 *
 * Usage:
 * ```kotlin
 * try {
 *     uploadVault(...)
 * } catch (e: GoogleJsonResponseException) {
 *     when (e.statusCode) {
 *         401, 403 -> throw SyncError.AuthenticationError(e)
 *         409 -> throw SyncError.ConflictError(getRemoteTimestamp(vaultId))
 *         413 -> throw SyncError.QuotaExceeded()
 *         else -> throw SyncError.NetworkError(e)
 *     }
 * }
 * ```
 */
sealed class SyncError : Exception {

    /**
     * Network connectivity error (temporary, retryable)
     *
     * Examples: No internet, timeout, DNS failure
     */
    class NetworkError(
        message: String = "Network error occurred during sync",
        cause: Throwable? = null
    ) : SyncError() {
        init {
            initCause(cause)
        }

        override val message: String = message
    }

    /**
     * Authentication/authorization error (requires re-auth)
     *
     * Examples: Invalid token, expired token, insufficient permissions
     */
    class AuthenticationError(
        message: String = "Authentication failed. Please re-authenticate.",
        cause: Throwable? = null
    ) : SyncError() {
        init {
            initCause(cause)
        }

        override val message: String = message
    }

    /**
     * Cloud storage quota exceeded (non-retryable)
     *
     * User needs to free up space or upgrade plan
     */
    class QuotaExceeded(
        message: String = "Cloud storage quota exceeded",
        val quotaUsedBytes: Long? = null,
        val quotaTotalBytes: Long? = null
    ) : SyncError() {
        override val message: String = buildString {
            append(message)
            if (quotaUsedBytes != null && quotaTotalBytes != null) {
                append(" ($quotaUsedBytes / $quotaTotalBytes bytes)")
            }
        }
    }

    /**
     * Data conflict - remote version is newer (requires merge)
     *
     * Remote file was modified after local version
     */
    class ConflictError(
        val remoteTimestamp: Long,
        val localTimestamp: Long? = null,
        message: String = "Sync conflict: remote file was modified"
    ) : SyncError() {
        override val message: String = buildString {
            append(message)
            if (localTimestamp != null) {
                append(" (remote: $remoteTimestamp, local: $localTimestamp)")
            }
        }
    }

    /**
     * Corrupted data (checksum mismatch, invalid format)
     *
     * Downloaded data is corrupted or tampered
     */
    class CorruptedData(
        message: String = "Downloaded data is corrupted",
        cause: Throwable? = null
    ) : SyncError() {
        init {
            initCause(cause)
        }

        override val message: String = message
    }

    /**
     * File not found on cloud (deleted remotely?)
     */
    class FileNotFound(
        val vaultId: String,
        message: String = "Vault file not found on cloud"
    ) : SyncError() {
        override val message: String = "$message (vaultId: $vaultId)"
    }

    /**
     * Rate limit exceeded (too many requests)
     *
     * Need to back off and retry later
     */
    class RateLimitExceeded(
        val retryAfterSeconds: Long? = null,
        message: String = "API rate limit exceeded"
    ) : SyncError() {
        override val message: String = buildString {
            append(message)
            retryAfterSeconds?.let {
                append(" (retry after ${it}s)")
            }
        }
    }

    /**
     * Provider-specific error (unknown error code)
     */
    class ProviderError(
        val errorCode: Int? = null,
        message: String = "Cloud provider error",
        cause: Throwable? = null
    ) : SyncError() {
        init {
            initCause(cause)
        }

        override val message: String = buildString {
            append(message)
            errorCode?.let {
                append(" (code: $it)")
            }
        }
    }

    /**
     * Check if error is retryable
     *
     * @return true if retrying might succeed
     */
    fun isRetryable(): Boolean {
        return when (this) {
            is NetworkError -> true
            is RateLimitExceeded -> true
            is CorruptedData -> false  // Retrying won't help
            is AuthenticationError -> false  // Need user intervention
            is QuotaExceeded -> false  // Need user to free space
            is ConflictError -> false  // Need conflict resolution
            is FileNotFound -> false  // File is gone
            is ProviderError -> errorCode in 500..599  // Retry on server errors
        }
    }

    /**
     * Get recommended retry delay in seconds
     *
     * @return Delay in seconds before retry, or null if not retryable
     */
    fun getRetryDelaySeconds(): Long? {
        return when (this) {
            is NetworkError -> 5  // 5 seconds
            is RateLimitExceeded -> retryAfterSeconds ?: 60  // Use header or default 60s
            is ProviderError -> if (isRetryable()) 10 else null
            else -> null
        }
    }
}
