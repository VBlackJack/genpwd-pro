package com.genpwd.provider.dropbox

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Base64
import com.genpwd.corevault.ProviderKind
import com.genpwd.providers.api.ProviderAccount
import com.genpwd.providers.api.ProviderError
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
import java.util.UUID
import javax.inject.Inject
import kotlin.coroutines.resumeWithException

/**
 * OAuth2 PKCE implementation for Dropbox authentication.
 *
 * This implementation follows the OAuth 2.0 authorization code flow with PKCE
 * (Proof Key for Code Exchange) as specified in RFC 7636.
 */
class OAuth2DropboxAuthProvider @Inject constructor(
    @ApplicationContext private val context: Context,
    private val httpClient: OkHttpClient,
    private val oauthStateStorage: OAuthStateStorage
) : DropboxAuthProvider {

    companion object {
        private const val AUTH_ENDPOINT = "https://www.dropbox.com/oauth2/authorize"
        private const val TOKEN_ENDPOINT = "https://api.dropboxapi.com/oauth2/token"
        private const val REDIRECT_URI = "com.julien.genpwdpro:/oauth2callback"
        private const val CLIENT_ID = "YOUR_DROPBOX_APP_KEY"

        // Minimal scope for file operations
        private const val SCOPES = "files.content.write files.content.read"
    }

    override suspend fun authenticate(): ProviderAccount = suspendCancellableCoroutine { continuation ->
        try {
            // Generate PKCE challenge
            val codeVerifier = generateCodeVerifier()
            val codeChallenge = generateCodeChallenge(codeVerifier)

            // Generate state with provider kind prefix
            val state = "${ProviderKind.DROPBOX.name}:${UUID.randomUUID()}"

            // Store code_verifier securely for later retrieval
            kotlinx.coroutines.runBlocking {
                oauthStateStorage.saveCodeVerifier(state, codeVerifier)
            }

            // Build authorization URL
            val authUrl = Uri.parse(AUTH_ENDPOINT).buildUpon()
                .appendQueryParameter("client_id", CLIENT_ID)
                .appendQueryParameter("redirect_uri", REDIRECT_URI)
                .appendQueryParameter("response_type", "code")
                .appendQueryParameter("code_challenge", codeChallenge)
                .appendQueryParameter("code_challenge_method", "S256")
                .appendQueryParameter("state", state)
                .appendQueryParameter("token_access_type", "offline")
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
                    expiresIn = json.optLong("expires_in", 14400), // Dropbox default: 4 hours
                    accountId = json.optString("account_id", "")
                )
            }
        }
    }

    /**
     * Refresh an expired access token using the refresh token.
     */
    suspend fun refreshAccessToken(refreshToken: String): TokenResponse {
        val requestBody = FormBody.Builder()
            .add("client_id", CLIENT_ID)
            .add("refresh_token", refreshToken)
            .add("grant_type", "refresh_token")
            .build()

        val request = Request.Builder()
            .url(TOKEN_ENDPOINT)
            .post(requestBody)
            .build()

        return withContext(Dispatchers.IO) {
            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    throw ProviderError.Authentication("Token refresh failed: ${response.code}")
                }

                val json = JSONObject(response.body?.string() ?: "")
                TokenResponse(
                    accessToken = json.getString("access_token"),
                    refreshToken = refreshToken, // Reuse old refresh token
                    expiresIn = json.optLong("expires_in", 14400)
                )
            }
        }
    }

    private fun generateCodeVerifier(): String {
        val bytes = ByteArray(32)
        SecureRandom().nextBytes(bytes)
        return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }

    private fun generateCodeChallenge(verifier: String): String {
        val bytes = verifier.toByteArray(Charsets.US_ASCII)
        val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
        return Base64.encodeToString(digest, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }
}

/**
 * OAuth token response containing access token, refresh token, and expiry information.
 */
data class TokenResponse(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Long,
    val accountId: String? = null
)
