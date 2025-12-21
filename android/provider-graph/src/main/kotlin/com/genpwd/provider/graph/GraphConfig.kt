package com.genpwd.provider.graph

import javax.inject.Inject
import javax.inject.Singleton

/**
 * Configuration for Microsoft Graph (OneDrive) cloud provider.
 *
 * This class holds the OAuth2 configuration required for OneDrive authentication.
 * The clientId must be obtained from Azure AD Portal:
 *
 * 1. Go to https://portal.azure.com
 * 2. Navigate to Azure Active Directory > App registrations
 * 3. Create a new registration or select existing
 * 4. Copy the "Application (client) ID"
 *
 * Redirect URI Configuration:
 * - Platform: Mobile and desktop applications
 * - Redirect URI: com.julien.genpwdpro:/oauth2callback
 *
 * API Permissions:
 * - Microsoft Graph > Files.ReadWrite (Delegated)
 * - Microsoft Graph > offline_access (Delegated)
 *
 * Usage:
 * The clientId can be set at runtime via [updateClientId] when the user
 * configures OneDrive in the app settings.
 */
@Singleton
class GraphConfig @Inject constructor() {

    /**
     * Microsoft Azure AD Application (client) ID.
     *
     * This is the unique identifier for the app registration in Azure AD.
     * Format: UUID (e.g., "12345678-1234-1234-1234-123456789abc")
     */
    @Volatile
    var clientId: String = ""
        private set

    /**
     * Updates the client ID.
     *
     * Call this when the user configures OneDrive with their Azure AD app credentials.
     *
     * @param newClientId The Application (client) ID from Azure AD
     * @throws IllegalArgumentException if clientId is blank
     */
    fun updateClientId(newClientId: String) {
        require(newClientId.isNotBlank()) { "Client ID cannot be blank" }
        clientId = newClientId.trim()
    }

    /**
     * Checks if the configuration is valid.
     *
     * @return true if clientId is configured
     */
    fun isConfigured(): Boolean = clientId.isNotBlank()

    /**
     * Clears the configuration.
     *
     * Call this when the user disconnects from OneDrive.
     */
    fun clear() {
        clientId = ""
    }

    companion object {
        /**
         * Redirect URI for OAuth2 callback.
         *
         * This must match the redirect URI registered in Azure AD.
         * Format: {scheme}://{host}
         */
        const val REDIRECT_URI = "com.julien.genpwdpro:/oauth2callback"

        /**
         * OAuth2 scopes required for OneDrive access.
         */
        val SCOPES = listOf(
            "Files.ReadWrite",  // Read/write files in OneDrive
            "offline_access"    // Required for refresh tokens
        )
    }
}
