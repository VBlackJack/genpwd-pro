package com.genpwd.providers.api

/**
 * Interface for OAuth token refresh operations.
 *
 * Implementations handle provider-specific token refresh logic.
 */
interface TokenRefreshProvider {
    /**
     * Refresh an expired access token using the refresh token.
     *
     * @param refreshToken The refresh token to use for obtaining a new access token
     * @return TokenResponse containing the new access token and expiry information
     */
    suspend fun refreshAccessToken(refreshToken: String): TokenResponse
}
