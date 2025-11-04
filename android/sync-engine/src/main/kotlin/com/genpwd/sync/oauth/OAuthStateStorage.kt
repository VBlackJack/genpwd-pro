package com.genpwd.sync.oauth

/**
 * Secure storage for OAuth PKCE state parameters.
 *
 * Stores code_verifier values temporarily during OAuth flow.
 * These values must be kept secret and only used once for token exchange.
 */
interface OAuthStateStorage {
    /**
     * Save a code_verifier for a given state parameter.
     *
     * @param state The state parameter sent in OAuth authorization request
     * @param codeVerifier The PKCE code_verifier (random 43-128 character string)
     */
    suspend fun saveCodeVerifier(state: String, codeVerifier: String)

    /**
     * Retrieve the code_verifier for a given state parameter.
     *
     * @param state The state parameter received in OAuth callback
     * @return The code_verifier, or null if not found or expired
     */
    suspend fun getCodeVerifier(state: String): String?

    /**
     * Clear the code_verifier after successful token exchange.
     *
     * @param state The state parameter to clear
     */
    suspend fun clearCodeVerifier(state: String)

    /**
     * Clear all expired code_verifiers.
     * Should be called periodically to clean up abandoned OAuth flows.
     */
    suspend fun clearExpired()
}
