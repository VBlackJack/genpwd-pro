package com.genpwd.providers.api

/**
 * OAuth token response containing access token, refresh token, and expiry information.
 */
data class TokenResponse(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Long,
    val email: String? = null
)
