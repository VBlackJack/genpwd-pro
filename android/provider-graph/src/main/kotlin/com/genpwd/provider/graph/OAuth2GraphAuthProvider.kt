package com.genpwd.provider.graph

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
 * OAuth2 PKCE implementation for Microsoft Graph (OneDrive) authentication.
 *
 * This implementation follows the OAuth 2.0 authorization code flow with PKCE
 * (Proof Key for Code Exchange) as specified in RFC 7636.
 *
 * Configuration:
 * 1. Register app in Azure AD Portal: https://portal.azure.com
 * 2. Add redirect URI: com.julien.genpwdpro:/oauth2callback (Mobile/Desktop)
 * 3. Add permissions: Files.ReadWrite, offline_access
 * 4. Copy Application (client) ID to GraphConfig
 *
 * @param context Application context for launching browser intent
 * @param httpClient OkHttp client for token exchange
 * @param oauthStateStorage Storage for PKCE code_verifier
 * @param graphConfig Configuration containing CLIENT_ID
 */
class OAuth2GraphAuthProvider @Inject constructor(
    @ApplicationContext private val context: Context,
    private val httpClient: OkHttpClient,
    private val oauthStateStorage: OAuthStateStorage,
    private val graphConfig: GraphConfig
) : GraphAuthProvider {

    companion object {
        private const val AUTH_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
        private const val TOKEN_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/token"

        // Redirect URI must match Azure AD app registration
        // Format: {scheme}://{host} where scheme is your app's package name or custom scheme
        private const val REDIRECT_URI = "com.julien.genpwdpro:/oauth2callback"

        // Scopes for OneDrive file access
        // - Files.ReadWrite: Read/write files in user's OneDrive
        // - offline_access: Required for refresh tokens
        private const val SCOPES = "Files.ReadWrite offline_access"
    }

    private val clientId: String
        get() = graphConfig.clientId.also {
            require(it.isNotBlank()) {
                "Microsoft CLIENT_ID not configured. " +
                "Please set clientId in GraphConfig or via Azure AD app registration."
            }
        }

    override suspend fun authenticate(): ProviderAccount = suspendCancellableCoroutine { continuation ->
        try {
            // Generate PKCE challenge
            val codeVerifier = generateCodeVerifier()
            val codeChallenge = generateCodeChallenge(codeVerifier)

            // Generate state with provider kind prefix
            val state = "${ProviderKind.ONEDRIVE.name}:${UUID.randomUUID()}"

            // Store code_verifier securely for later retrieval
            kotlinx.coroutines.runBlocking {
                oauthStateStorage.saveCodeVerifier(state, codeVerifier)
            }

            // Build authorization URL
            val authUrl = Uri.parse(AUTH_ENDPOINT).buildUpon()
                .appendQueryParameter("client_id", clientId)
                .appendQueryParameter("redirect_uri", REDIRECT_URI)
                .appendQueryParameter("response_type", "code")
                .appendQueryParameter("scope", SCOPES)
                .appendQueryParameter("code_challenge", codeChallenge)
                .appendQueryParameter("code_challenge_method", "S256")
                .appendQueryParameter("state", state)
                .appendQueryParameter("response_mode", "query")
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
            .add("client_id", clientId)
            .add("code", authCode)
            .add("code_verifier", codeVerifier)
            .add("grant_type", "authorization_code")
            .add("redirect_uri", REDIRECT_URI)
            .add("scope", SCOPES)
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
                    userId = json.optString("user_id", "")
                )
            }
        }
    }

    /**
     * Refresh an expired access token using the refresh token.
     */
    suspend fun refreshAccessToken(refreshToken: String): TokenResponse {
        val requestBody = FormBody.Builder()
            .add("client_id", clientId)
            .add("refresh_token", refreshToken)
            .add("grant_type", "refresh_token")
            .add("scope", SCOPES)
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
                    refreshToken = json.optString("refresh_token", refreshToken), // May return new refresh token
                    expiresIn = json.optLong("expires_in", 3600)
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
    val userId: String? = null
)
