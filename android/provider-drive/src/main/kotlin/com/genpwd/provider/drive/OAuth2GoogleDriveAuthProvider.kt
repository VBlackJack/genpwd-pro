package com.genpwd.provider.drive

import android.content.Context
import android.content.Intent
import android.net.Uri
import com.genpwd.corevault.ProviderKind
import com.genpwd.providers.api.ProviderAccount
import com.genpwd.providers.api.ProviderError
import com.genpwd.providers.api.TokenRefreshProvider
import com.genpwd.providers.api.TokenResponse
import com.genpwd.sync.oauth.OAuthStateStorage
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import okhttp3.FormBody
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import java.util.UUID
import javax.inject.Inject
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * OAuth2 PKCE implementation for Google Drive authentication.
 *
 * This implementation follows the OAuth 2.0 authorization code flow with PKCE
 * (Proof Key for Code Exchange) as specified in RFC 7636.
 */
class OAuth2GoogleDriveAuthProvider @Inject constructor(
    @ApplicationContext private val context: Context,
    private val httpClient: OkHttpClient,
    private val oauthStateStorage: OAuthStateStorage
) : GoogleDriveAuthProvider, TokenRefreshProvider {

    companion object {
        private const val AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
        private const val TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
        private const val REDIRECT_URI = "com.julien.genpwdpro:/oauth2callback"
        private const val CLIENT_ID = "617397885959-dejdholrsq2mulvuu24fmr6pfm2cter4.apps.googleusercontent.com"

        // Scopes minimal for Google Drive
        private const val SCOPES = "https://www.googleapis.com/auth/drive.appdata " +
                "https://www.googleapis.com/auth/drive.file"
    }

    override suspend fun authenticate(): ProviderAccount = suspendCancellableCoroutine { continuation ->
        try {
            // Generate PKCE challenge
            val codeVerifier = generateCodeVerifier()
            val codeChallenge = generateCodeChallenge(codeVerifier)

            // Generate state with provider kind prefix
            val state = "${ProviderKind.GOOGLE_DRIVE.name}:${UUID.randomUUID()}"

            // Store code_verifier securely for later retrieval
            kotlinx.coroutines.runBlocking {
                oauthStateStorage.saveCodeVerifier(state, codeVerifier)
            }

            // Build authorization URL
            val authUrl = Uri.parse(AUTH_ENDPOINT).buildUpon()
                .appendQueryParameter("client_id", CLIENT_ID)
                .appendQueryParameter("redirect_uri", REDIRECT_URI)
                .appendQueryParameter("response_type", "code")
                .appendQueryParameter("scope", SCOPES)
                .appendQueryParameter("code_challenge", codeChallenge)
                .appendQueryParameter("code_challenge_method", "S256")
                .appendQueryParameter("state", state)
                .appendQueryParameter("access_type", "offline")
                .appendQueryParameter("prompt", "consent")
                .build()

            // Launch browser for OAuth flow
            val intent = Intent(Intent.ACTION_VIEW, authUrl).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)

            // Note: OAuth callback is handled by OAuthCallbackActivity
            // which will call completeAuthentication() with the authorization code
            continuation.resumeWithException(
                ProviderError.Authentication(
                    "OAuth2 flow initiated. Awaiting callback..."
                )
            )
        } catch (e: Exception) {
            continuation.resumeWithException(
                ProviderError.Authentication("Failed to initiate OAuth2 flow", e)
            )
        }
    }

    /**
     * Complete OAuth authentication after receiving callback.
     *
     * @param state The state parameter from OAuth callback
     * @param authCode The authorization code from OAuth callback
     * @return TokenResponse containing access token, refresh token, and expiry
     */
    suspend fun completeAuthentication(state: String, authCode: String): TokenResponse {
        return withContext(Dispatchers.IO) {
            // Retrieve code_verifier from secure storage
            val codeVerifier = oauthStateStorage.getCodeVerifier(state)
                ?: throw ProviderError.Authentication("Code verifier not found or expired")

            try {
                // Exchange authorization code for tokens
                val tokens = exchangeCodeForTokens(authCode, codeVerifier)

                // Clear code_verifier after successful exchange
                oauthStateStorage.clearCodeVerifier(state)

                tokens
            } catch (e: Exception) {
                // Clear code_verifier on failure too
                oauthStateStorage.clearCodeVerifier(state)
                throw e
            }
        }
    }

    /**
     * Exchange authorization code for access and refresh tokens.
     */
    suspend fun exchangeCodeForTokens(
        authCode: String,
        codeVerifier: String
    ): TokenResponse {
        val requestBody = FormBody.Builder()
            .add("client_id", CLIENT_ID)
            .add("code", authCode)
            .add("code_verifier", codeVerifier)
            .add("grant_type", "authorization_code")
            .add("redirect_uri", REDIRECT_URI)
            .build()

        val request = Request.Builder()
            .url(TOKEN_ENDPOINT)
            .post(requestBody)
            .build()

        return withContext(Dispatchers.IO) {
            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    val errorBody = response.body?.string()
                    throw ProviderError.Authentication(
                        "Token exchange failed: ${response.code} - $errorBody"
                    )
                }

                val json = JSONObject(response.body?.string() ?: "")
                TokenResponse(
                    accessToken = json.getString("access_token"),
                    refreshToken = json.optString("refresh_token", ""),
                    expiresIn = json.optLong("expires_in", 3600),
                    email = null // Email can be retrieved from userinfo endpoint if needed
                )
            }
        }
    }

    /**
     * Refresh an expired access token using the refresh token.
     */
    override suspend fun refreshAccessToken(refreshToken: String): TokenResponse {
        val requestBody = FormBody.Builder()
            .add("client_id", CLIENT_ID)
            .add("refresh_token", refreshToken)
            .add("grant_type", "refresh_token")
            .build()

        val request = Request.Builder()
            .url(TOKEN_ENDPOINT)
            .post(requestBody)
            .build()

        return httpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw ProviderError.Authentication("Token refresh failed: ${response.code}")
            }

            val json = JSONObject(response.body?.string() ?: "")
            TokenResponse(
                accessToken = json.getString("access_token"),
                refreshToken = refreshToken, // Reuse old refresh token
                expiresIn = json.optLong("expires_in", 3600)
            )
        }
    }

    private fun generateCodeVerifier(): String {
        val bytes = ByteArray(32)
        SecureRandom().nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    private fun generateCodeChallenge(verifier: String): String {
        val bytes = verifier.toByteArray(Charsets.US_ASCII)
        val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest)
    }
}
