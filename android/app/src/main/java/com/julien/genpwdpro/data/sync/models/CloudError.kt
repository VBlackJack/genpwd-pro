package com.julien.genpwdpro.data.sync.models

/**
 * Typed errors for cloud provider operations
 *
 * Provides better error handling and debugging for cloud synchronization
 * by distinguishing between different failure scenarios.
 */
sealed class CloudError : Exception() {

    /**
     * OAuth authentication has expired or is invalid
     */
    data class AuthenticationExpired(
        override val message: String = "Cloud authentication has expired"
    ) : CloudError()

    /**
     * Cloud storage quota has been exceeded
     */
    data class QuotaExceeded(
        val usedBytes: Long,
        val totalBytes: Long,
        override val message: String = "Cloud storage quota exceeded: $usedBytes / $totalBytes bytes"
    ) : CloudError()

    /**
     * Network connectivity issue
     */
    data class NetworkError(
        override val cause: Throwable?,
        override val message: String = "Network error: ${cause?.message}"
    ) : CloudError()

    /**
     * Permission denied for the requested operation
     */
    data class PermissionDenied(
        val resource: String,
        override val message: String = "Permission denied for: $resource"
    ) : CloudError()

    /**
     * Resource not found (file, folder, etc.)
     */
    data class ResourceNotFound(
        val resource: String,
        override val message: String = "Resource not found: $resource"
    ) : CloudError()

    /**
     * Conflict with existing resource (e.g., file already exists)
     */
    data class Conflict(
        val resource: String,
        override val message: String = "Conflict with existing resource: $resource"
    ) : CloudError()

    /**
     * Rate limit exceeded
     */
    data class RateLimitExceeded(
        val retryAfterSeconds: Long? = null,
        override val message: String = "Rate limit exceeded" +
            (retryAfterSeconds?.let { ", retry after $it seconds" } ?: "")
    ) : CloudError()

    /**
     * Unknown or unhandled error
     */
    data class Unknown(
        override val cause: Throwable?,
        override val message: String = "Unknown cloud error: ${cause?.message}"
    ) : CloudError()
}
