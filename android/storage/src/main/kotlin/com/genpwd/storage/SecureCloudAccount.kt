package com.genpwd.storage

import com.genpwd.corevault.ProviderKind
import com.genpwd.storage.crypto.SecureString
import java.io.Closeable

/**
 * A cloud account with tokens stored in SecureString for enhanced memory security.
 *
 * This class wraps account information and ensures that sensitive tokens are
 * properly zeroed out from memory when no longer needed.
 *
 * SECURITY: Always use with .use {} blocks to ensure proper cleanup:
 * ```
 * repository.getSecureAccount(id).use { account ->
 *     account?.accessToken?.use { token ->
 *         // Use token
 *     }
 * }
 * ```
 *
 * @property id Account unique identifier
 * @property providerKind The cloud provider type
 * @property displayName User-visible account name
 * @property email User email (optional)
 * @property accessToken OAuth access token (secured in memory)
 * @property refreshToken OAuth refresh token (secured in memory, optional)
 * @property expiresAt Token expiration timestamp
 * @property createdAt Account creation timestamp
 * @property lastSync Last synchronization timestamp
 * @property isActive Whether the account is active
 */
data class SecureCloudAccount(
    val id: String,
    val providerKind: ProviderKind,
    val displayName: String,
    val email: String?,
    val accessToken: SecureString,
    val refreshToken: SecureString?,
    val expiresAt: Long,
    val createdAt: Long,
    val lastSync: Long?,
    val isActive: Boolean
) : Closeable {

    /**
     * Close and zero out all sensitive data.
     * This method is idempotent.
     */
    override fun close() {
        accessToken.close()
        refreshToken?.close()
    }

    /**
     * Check if token is expired.
     */
    fun isExpired(): Boolean {
        return System.currentTimeMillis() > expiresAt
    }

    /**
     * Get time until token expires in milliseconds.
     * Returns 0 if already expired.
     */
    fun timeUntilExpiry(): Long {
        val remaining = expiresAt - System.currentTimeMillis()
        return if (remaining > 0) remaining else 0
    }

    override fun toString(): String {
        return "SecureCloudAccount(" +
                "id='$id', " +
                "provider=$providerKind, " +
                "name='$displayName', " +
                "email=$email, " +
                "accessToken=${accessToken}, " + // Uses SecureString's safe toString
                "refreshToken=${refreshToken}, " +
                "expiresAt=$expiresAt, " +
                "isActive=$isActive)"
    }
}
