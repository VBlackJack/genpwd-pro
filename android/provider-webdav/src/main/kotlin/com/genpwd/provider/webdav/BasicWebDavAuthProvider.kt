package com.genpwd.provider.webdav

import com.genpwd.corevault.ProviderKind
import com.genpwd.providers.api.ProviderAccount
import com.genpwd.providers.api.ProviderError
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Credentials
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.UUID
import javax.inject.Inject
import javax.inject.Named

/**
 * Basic authentication provider for WebDAV/Nextcloud.
 *
 * This provider uses HTTP Basic Authentication with username and password.
 * For production use, credentials should be collected from the user and stored securely.
 *
 * @param baseUrl The base URL for the WebDAV server (e.g., "https://cloud.example.com")
 */
class BasicWebDavAuthProvider @Inject constructor(
    private val httpClient: OkHttpClient,
    @Named("webdavBaseUrl") private val baseUrl: String
) : WebDavAuthProvider {

    /**
     * Authenticate using Basic Auth credentials.
     *
     * Note: In a real implementation, these credentials would be:
     * 1. Collected from user input (username, password, server URL)
     * 2. Encrypted and stored securely using EncryptedSharedPreferences
     * 3. Retrieved when needed for authentication
     *
     * @param serverUrl The WebDAV server URL (e.g., "https://cloud.example.com/remote.php/dav/files/username")
     * @param username The username for authentication
     * @param password The password for authentication
     * @return ProviderAccount with credentials
     */
    suspend fun authenticate(
        serverUrl: String,
        username: String,
        password: String
    ): ProviderAccount = withContext(Dispatchers.IO) {
        try {
            // Validate credentials by making a test PROPFIND request
            val credentials = Credentials.basic(username, password)
            val request = Request.Builder()
                .url(serverUrl)
                .method("PROPFIND", null)
                .addHeader("Authorization", credentials)
                .addHeader("Depth", "0")
                .build()

            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful && response.code != 207) {
                    throw ProviderError.Authentication("WebDAV authentication failed: ${response.code}")
                }

                // Create a provider account with the credentials
                // Note: In production, the password should be encrypted before storage
                // Note: serverUrl is encoded in accessToken format: "Basic <credentials>|<serverUrl>"
                ProviderAccount(
                    id = UUID.randomUUID().toString(),
                    displayName = username,
                    accessToken = "$credentials|$serverUrl", // Store both credentials and server URL
                    refreshToken = null,
                    expiresAtEpochSeconds = null, // Basic Auth doesn't expire
                )
            }
        } catch (e: Exception) {
            throw ProviderError.Authentication("Failed to authenticate with WebDAV server", e)
        }
    }

    override suspend fun authenticate(): ProviderAccount {
        // This method should not be called directly for WebDAV
        // The authenticate(serverUrl, username, password) method should be used instead
        throw ProviderError.Authentication(
            "WebDAV requires server URL, username, and password. " +
            "Use authenticate(serverUrl, username, password) instead."
        )
    }

    override fun configuration(): WebDavAuthProvider.WebDavConfiguration {
        return WebDavAuthProvider.WebDavConfiguration(baseUrl = baseUrl)
    }

    /**
     * Refresh credentials (no-op for Basic Auth since credentials don't expire).
     */
    suspend fun refreshCredentials(account: ProviderAccount): ProviderAccount {
        // Basic Auth credentials don't expire, so just return the same account
        return account
    }

    /**
     * Validate if the stored credentials are still valid.
     */
    suspend fun validateCredentials(account: ProviderAccount): Boolean = withContext(Dispatchers.IO) {
        try {
            // Parse accessToken format: "Basic <credentials>|<serverUrl>"
            val parts = account.accessToken.split("|", limit = 2)
            if (parts.size != 2) {
                throw ProviderError.Authentication("Invalid access token format")
            }
            val credentials = parts[0]
            val serverUrl = parts[1]

            val request = Request.Builder()
                .url(serverUrl)
                .method("PROPFIND", null)
                .addHeader("Authorization", credentials)
                .addHeader("Depth", "0")
                .build()

            httpClient.newCall(request).execute().use { response ->
                response.isSuccessful || response.code == 207
            }
        } catch (e: Exception) {
            false
        }
    }
}
