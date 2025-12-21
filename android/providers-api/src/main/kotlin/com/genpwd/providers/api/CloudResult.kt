package com.genpwd.providers.api

/**
 * Result type for cloud provider operations.
 *
 * Provides verbose error handling for the UI layer by distinguishing
 * between different failure scenarios (Auth, Network, Quota, etc.)
 * instead of returning null or false.
 *
 * Usage:
 * ```kotlin
 * when (val result = provider.downloadVault(vaultId)) {
 *     is CloudResult.Success -> handleData(result.data)
 *     is CloudResult.Error -> when (result.type) {
 *         CloudErrorType.AUTH_EXPIRED -> promptReAuth()
 *         CloudErrorType.NETWORK -> showNetworkError()
 *         CloudErrorType.QUOTA_EXCEEDED -> showQuotaWarning()
 *         CloudErrorType.NOT_FOUND -> handleNotFound()
 *         CloudErrorType.RATE_LIMITED -> scheduleRetry(result.retryAfterSeconds)
 *         CloudErrorType.PERMISSION_DENIED -> showPermissionError()
 *         CloudErrorType.CONFLICT -> handleConflict()
 *         CloudErrorType.GENERIC -> showGenericError(result.message)
 *     }
 * }
 * ```
 */
sealed class CloudResult<out T> {

    /**
     * Operation completed successfully with the given data.
     *
     * @param data The result data from the operation
     */
    data class Success<T>(val data: T) : CloudResult<T>()

    /**
     * Operation failed with a typed error.
     *
     * @param type Category of error for UI handling
     * @param message Human-readable error message (can be shown to user)
     * @param exception Original exception for logging/debugging
     * @param retryAfterSeconds For RATE_LIMITED errors, when to retry
     */
    data class Error(
        val type: CloudErrorType,
        val message: String?,
        val exception: Throwable? = null,
        val retryAfterSeconds: Long? = null
    ) : CloudResult<Nothing>()

    /**
     * Returns true if this is a Success result.
     */
    val isSuccess: Boolean get() = this is Success

    /**
     * Returns true if this is an Error result.
     */
    val isError: Boolean get() = this is Error

    /**
     * Returns the data if Success, null otherwise.
     */
    fun getOrNull(): T? = when (this) {
        is Success -> data
        is Error -> null
    }

    /**
     * Returns the data if Success, throws the exception if Error.
     */
    fun getOrThrow(): T = when (this) {
        is Success -> data
        is Error -> throw exception ?: IllegalStateException(message ?: "Unknown error")
    }

    /**
     * Returns the data if Success, or the result of [defaultValue] if Error.
     */
    inline fun getOrElse(defaultValue: (Error) -> @UnsafeVariance T): T = when (this) {
        is Success -> data
        is Error -> defaultValue(this)
    }

    /**
     * Maps the success value to a new type.
     */
    inline fun <R> map(transform: (T) -> R): CloudResult<R> = when (this) {
        is Success -> Success(transform(data))
        is Error -> this
    }

    /**
     * Executes [action] if this is a Success.
     */
    inline fun onSuccess(action: (T) -> Unit): CloudResult<T> {
        if (this is Success) action(data)
        return this
    }

    /**
     * Executes [action] if this is an Error.
     */
    inline fun onError(action: (Error) -> Unit): CloudResult<T> {
        if (this is Error) action(this)
        return this
    }

    companion object {
        /**
         * Creates a Success result.
         */
        fun <T> success(data: T): CloudResult<T> = Success(data)

        /**
         * Creates an Error result.
         */
        fun error(
            type: CloudErrorType,
            message: String? = null,
            exception: Throwable? = null,
            retryAfterSeconds: Long? = null
        ): CloudResult<Nothing> = Error(type, message, exception, retryAfterSeconds)

        /**
         * Creates an AUTH_EXPIRED error.
         */
        fun authExpired(
            message: String = "Authentication has expired",
            exception: Throwable? = null
        ): CloudResult<Nothing> = Error(CloudErrorType.AUTH_EXPIRED, message, exception)

        /**
         * Creates a NETWORK error.
         */
        fun networkError(
            message: String = "Network error",
            exception: Throwable? = null
        ): CloudResult<Nothing> = Error(CloudErrorType.NETWORK, message, exception)

        /**
         * Creates a QUOTA_EXCEEDED error.
         */
        fun quotaExceeded(
            message: String = "Storage quota exceeded",
            exception: Throwable? = null
        ): CloudResult<Nothing> = Error(CloudErrorType.QUOTA_EXCEEDED, message, exception)

        /**
         * Creates a NOT_FOUND error.
         */
        fun notFound(
            message: String = "Resource not found",
            exception: Throwable? = null
        ): CloudResult<Nothing> = Error(CloudErrorType.NOT_FOUND, message, exception)

        /**
         * Creates a RATE_LIMITED error.
         */
        fun rateLimited(
            retryAfterSeconds: Long? = null,
            message: String = "Rate limit exceeded",
            exception: Throwable? = null
        ): CloudResult<Nothing> = Error(
            CloudErrorType.RATE_LIMITED,
            message,
            exception,
            retryAfterSeconds
        )

        /**
         * Creates a PERMISSION_DENIED error.
         */
        fun permissionDenied(
            message: String = "Permission denied",
            exception: Throwable? = null
        ): CloudResult<Nothing> = Error(CloudErrorType.PERMISSION_DENIED, message, exception)

        /**
         * Creates a CONFLICT error.
         */
        fun conflict(
            message: String = "Resource conflict",
            exception: Throwable? = null
        ): CloudResult<Nothing> = Error(CloudErrorType.CONFLICT, message, exception)

        /**
         * Creates a GENERIC error.
         */
        fun genericError(
            message: String? = null,
            exception: Throwable? = null
        ): CloudResult<Nothing> = Error(
            CloudErrorType.GENERIC,
            message ?: exception?.message ?: "Unknown error",
            exception
        )
    }
}

/**
 * Error types for cloud provider operations.
 *
 * These categories help the UI layer decide how to handle and display errors:
 * - AUTH_EXPIRED: Prompt user to re-authenticate
 * - NETWORK: Show connectivity error, offer retry
 * - QUOTA_EXCEEDED: Show storage warning, suggest cleanup
 * - NOT_FOUND: Resource doesn't exist (may be normal for first sync)
 * - RATE_LIMITED: Back off and retry later
 * - PERMISSION_DENIED: User needs to grant permissions
 * - CONFLICT: Version conflict, may need merge
 * - GENERIC: Fallback for unexpected errors
 */
enum class CloudErrorType {
    /**
     * OAuth token expired or invalid. User must re-authenticate.
     * HTTP 401 Unauthorized
     */
    AUTH_EXPIRED,

    /**
     * Network connectivity issue (timeout, DNS, connection refused).
     * IOException, SocketException, UnknownHostException
     */
    NETWORK,

    /**
     * Cloud storage quota exceeded. User must free space or upgrade.
     * HTTP 413 Payload Too Large, or quota-specific API errors
     */
    QUOTA_EXCEEDED,

    /**
     * Requested resource (file, folder, vault) not found.
     * HTTP 404 Not Found
     */
    NOT_FOUND,

    /**
     * Too many requests. Wait before retrying.
     * HTTP 429 Too Many Requests
     */
    RATE_LIMITED,

    /**
     * Insufficient permissions for the operation.
     * HTTP 403 Forbidden
     */
    PERMISSION_DENIED,

    /**
     * Version conflict (e.g., etag mismatch during update).
     * HTTP 409 Conflict, 412 Precondition Failed
     */
    CONFLICT,

    /**
     * Unhandled or unknown error type.
     */
    GENERIC
}
