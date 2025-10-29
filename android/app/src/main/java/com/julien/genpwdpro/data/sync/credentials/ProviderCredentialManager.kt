package com.julien.genpwdpro.data.sync.credentials

import android.util.Log
import com.google.gson.Gson
import com.julien.genpwdpro.data.sync.models.CloudProviderType
import com.julien.genpwdpro.data.sync.providers.PCloudProvider
import com.julien.genpwdpro.data.secure.SecurePrefs
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Gestionnaire sécurisé des credentials des cloud providers
 *
 * Utilise EncryptedSharedPreferences pour stocker:
 * - Access tokens OAuth2
 * - Refresh tokens
 * - Configuration (WebDAV, etc.)
 * - Métadonnées de connexion
 *
 * Sécurité:
 * - Chiffrement AES-256-GCM via Android Keystore
 * - Clés protégées par hardware (si disponible)
 * - Données non extractibles sans déverrouillage
 */
@Singleton
class ProviderCredentialManager @Inject constructor(
    private val securePrefs: SecurePrefs,
    private val gson: Gson
) {

    companion object {
        private const val TAG = "ProviderCredentialManager"

        // Keys for each provider
        private fun accessTokenKey(type: CloudProviderType) = "${type.name}_access_token"
        private fun refreshTokenKey(type: CloudProviderType) = "${type.name}_refresh_token"
        private fun configKey(type: CloudProviderType) = "${type.name}_config"
        private fun expiresAtKey(type: CloudProviderType) = "${type.name}_expires_at"
    }

    // ========== OAuth2 Access Tokens ==========

    /**
     * Sauvegarder un access token OAuth2
     *
     * @param providerType Type de provider
     * @param accessToken Token d'accès
     * @param refreshToken Token de rafraîchissement (optionnel)
     * @param expiresInSeconds Durée de validité en secondes (optionnel)
     */
    fun saveAccessToken(
        providerType: CloudProviderType,
        accessToken: String,
        refreshToken: String? = null,
        expiresInSeconds: Long? = null
    ) {
        Log.d(TAG, "Saving access token for $providerType")

        securePrefs.putString(accessTokenKey(providerType), accessToken)
        if (refreshToken != null) {
            securePrefs.putString(refreshTokenKey(providerType), refreshToken)
        } else {
            securePrefs.remove(refreshTokenKey(providerType))
        }

        if (expiresInSeconds != null) {
            val expiresAt = System.currentTimeMillis() + (expiresInSeconds * 1000)
            securePrefs.putLong(expiresAtKey(providerType), expiresAt)
        } else {
            securePrefs.remove(expiresAtKey(providerType))
        }

        Log.d(TAG, "Access token saved for $providerType")
    }

    /**
     * Récupérer un access token
     *
     * @param providerType Type de provider
     * @return Access token ou null si non trouvé ou expiré
     */
    fun getAccessToken(providerType: CloudProviderType): String? {
        val token = securePrefs.getString(accessTokenKey(providerType))

        if (token == null) {
            Log.d(TAG, "No access token found for $providerType")
            return null
        }

        // Vérifier l'expiration
        val expiresAt = securePrefs.getLong(expiresAtKey(providerType), 0)
        if (expiresAt > 0 && System.currentTimeMillis() >= expiresAt) {
            Log.w(TAG, "Access token expired for $providerType")
            clearAccessToken(providerType)
            return null
        }

        Log.d(TAG, "Access token retrieved for $providerType")
        return token
    }

    /**
     * Récupérer un refresh token
     */
    fun getRefreshToken(providerType: CloudProviderType): String? {
        return securePrefs.getString(refreshTokenKey(providerType))
    }

    /**
     * Vérifier si un access token existe et est valide
     */
    fun hasValidAccessToken(providerType: CloudProviderType): Boolean {
        return getAccessToken(providerType) != null
    }

    /**
     * Effacer les tokens d'un provider
     */
    fun clearAccessToken(providerType: CloudProviderType) {
        Log.d(TAG, "Clearing access token for $providerType")

        securePrefs.remove(
            accessTokenKey(providerType),
            refreshTokenKey(providerType),
            expiresAtKey(providerType)
        )
    }

    // ========== Provider Configuration ==========

    /**
     * Sauvegarder une configuration de provider
     *
     * @param providerType Type de provider
     * @param config Objet de configuration (sera sérialisé en JSON)
     */
    fun <T> saveProviderConfig(providerType: CloudProviderType, config: T) {
        Log.d(TAG, "Saving config for $providerType")

        val json = gson.toJson(config)
        securePrefs.putString(configKey(providerType), json)

        Log.d(TAG, "Config saved for $providerType")
    }

    /**
     * Récupérer une configuration de provider
     *
     * @param providerType Type de provider
     * @param clazz Classe du type de configuration
     * @return Configuration ou null si non trouvée
     */
    fun <T> getProviderConfig(providerType: CloudProviderType, clazz: Class<T>): T? {
        val json = securePrefs.getString(configKey(providerType))

        if (json == null) {
            Log.d(TAG, "No config found for $providerType")
            return null
        }

        return try {
            val config = gson.fromJson(json, clazz)
            Log.d(TAG, "Config retrieved for $providerType")
            config
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing config for $providerType", e)
            null
        }
    }

    /**
     * Vérifier si une configuration existe
     */
    fun hasProviderConfig(providerType: CloudProviderType): Boolean {
        return securePrefs.contains(configKey(providerType))
    }

    /**
     * Effacer la configuration d'un provider
     */
    fun clearProviderConfig(providerType: CloudProviderType) {
        Log.d(TAG, "Clearing config for $providerType")

        securePrefs.remove(configKey(providerType))
    }

    // ========== Complete Provider Management ==========

    /**
     * Effacer toutes les données d'un provider (tokens + config)
     */
    fun clearProvider(providerType: CloudProviderType) {
        Log.d(TAG, "Clearing all data for $providerType")

        clearAccessToken(providerType)
        clearProviderConfig(providerType)

        Log.d(TAG, "All data cleared for $providerType")
    }

    /**
     * Effacer toutes les données de tous les providers
     */
    fun clearAll() {
        Log.w(TAG, "Clearing ALL provider data")

        CloudProviderType.values().forEach { type ->
            securePrefs.remove(
                accessTokenKey(type),
                refreshTokenKey(type),
                expiresAtKey(type),
                configKey(type)
            )
        }

        Log.w(TAG, "All provider data cleared")
    }

    /**
     * Vérifier si un provider est configuré (avec token ou config)
     */
    fun isProviderConfigured(providerType: CloudProviderType): Boolean {
        return hasValidAccessToken(providerType) || hasProviderConfig(providerType)
    }
}

/**
 * Data classes pour les configurations de providers
 */

/**
 * Configuration WebDAV
 */
data class WebDAVConfig(
    val serverUrl: String,
    val username: String,
    val password: String,
    val validateSSL: Boolean = true
)

/**
 * Configuration OneDrive
 */
data class OneDriveConfig(
    val clientId: String
)

/**
 * Configuration pCloud
 */
data class PCloudConfig(
    val appKey: String,
    val appSecret: String,
    val region: PCloudProvider.PCloudRegion
)

/**
 * Configuration ProtonDrive
 */
data class ProtonDriveConfig(
    val clientId: String,
    val clientSecret: String
)
