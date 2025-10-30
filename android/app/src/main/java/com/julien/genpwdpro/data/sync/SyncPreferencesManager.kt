package com.julien.genpwdpro.data.sync

import android.content.Context
import android.content.SharedPreferences
import com.julien.genpwdpro.data.secure.SecurePrefs
import com.julien.genpwdpro.data.sync.models.CloudProviderType
import com.julien.genpwdpro.data.sync.models.ConflictResolutionStrategy
import com.julien.genpwdpro.data.sync.models.SyncInterval
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Gestionnaire de préférences pour la synchronisation cloud
 *
 * Fonctionnalités:
 * - Stockage sécurisé des credentials (EncryptedSharedPreferences)
 * - Configuration de synchronisation
 * - Historique des synchronisations
 * - Préférences utilisateur
 *
 * Sécurité:
 * - Credentials chiffrés avec EncryptedSharedPreferences
 * - Utilise MasterKey pour le chiffrement
 * - Séparation des données sensibles et non-sensibles
 */
@Singleton
class SyncPreferencesManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val securePrefs: SecurePrefs
) {
    companion object {
        // Shared Preferences names
        private const val PREFS_SYNC_CONFIG = "genpwd_sync_config"
        private const val PREFS_SYNC_HISTORY = "genpwd_sync_history"

        // Keys - Configuration
        private const val KEY_AUTO_SYNC_ENABLED = "auto_sync_enabled"
        private const val KEY_SYNC_INTERVAL = "sync_interval"
        private const val KEY_CURRENT_PROVIDER = "current_provider"
        private const val KEY_LAST_SYNC_TIMESTAMP = "last_sync_timestamp"
        private const val KEY_LAST_SYNC_SUCCESS = "last_sync_success"
        private const val KEY_CONFLICT_RESOLUTION_STRATEGY = "conflict_resolution_strategy"
        private const val KEY_WIFI_ONLY = "wifi_only"
        private const val KEY_SYNC_ON_CHANGE = "sync_on_change"

        // Keys - Credentials (encrypted)
        private const val KEY_GOOGLE_DRIVE_TOKEN = "google_drive_token"
        private const val KEY_GOOGLE_DRIVE_REFRESH_TOKEN = "google_drive_refresh_token"
        private const val KEY_ONEDRIVE_TOKEN = "onedrive_token"
        private const val KEY_ONEDRIVE_REFRESH_TOKEN = "onedrive_refresh_token"
        private const val KEY_WEBDAV_URL = "webdav_url"
        private const val KEY_WEBDAV_USERNAME = "webdav_username"
        private const val KEY_WEBDAV_PASSWORD = "webdav_password"
        private const val KEY_WEBDAV_VALIDATE_SSL = "webdav_validate_ssl"
        private const val KEY_PCLOUD_TOKEN = "pcloud_token"
        private const val KEY_PROTON_TOKEN = "proton_token"

        // Keys - History
        private const val KEY_TOTAL_SYNCS = "total_syncs"
        private const val KEY_SUCCESSFUL_SYNCS = "successful_syncs"
        private const val KEY_FAILED_SYNCS = "failed_syncs"
        private const val KEY_LAST_ERROR = "last_error"
        private const val KEY_LAST_ERROR_TIMESTAMP = "last_error_timestamp"
    }

    // Regular SharedPreferences for non-sensitive data
    private val configPrefs: SharedPreferences = context.getSharedPreferences(
        PREFS_SYNC_CONFIG,
        Context.MODE_PRIVATE
    )

    // History SharedPreferences
    private val historyPrefs: SharedPreferences = context.getSharedPreferences(
        PREFS_SYNC_HISTORY,
        Context.MODE_PRIVATE
    )

    // ===== Configuration Methods =====

    /**
     * Active ou désactive la synchronisation automatique
     */
    fun setAutoSyncEnabled(enabled: Boolean) {
        configPrefs.edit().putBoolean(KEY_AUTO_SYNC_ENABLED, enabled).apply()
    }

    /**
     * Vérifie si la synchronisation automatique est activée
     */
    fun isAutoSyncEnabled(): Boolean {
        return configPrefs.getBoolean(KEY_AUTO_SYNC_ENABLED, false)
    }

    /**
     * Définit l'intervalle de synchronisation
     */
    fun setSyncInterval(interval: SyncInterval) {
        configPrefs.edit().putString(KEY_SYNC_INTERVAL, interval.name).apply()
    }

    /**
     * Récupère l'intervalle de synchronisation
     */
    fun getSyncInterval(): SyncInterval {
        val name = configPrefs.getString(KEY_SYNC_INTERVAL, SyncInterval.HOURLY.name)
        return try {
            SyncInterval.valueOf(name ?: SyncInterval.HOURLY.name)
        } catch (e: IllegalArgumentException) {
            SyncInterval.HOURLY
        }
    }

    /**
     * Définit le provider cloud actuel
     */
    fun setCurrentProvider(provider: CloudProviderType) {
        configPrefs.edit().putString(KEY_CURRENT_PROVIDER, provider.name).apply()
    }

    /**
     * Récupère le provider cloud actuel
     */
    fun getCurrentProvider(): CloudProviderType {
        val name = configPrefs.getString(KEY_CURRENT_PROVIDER, CloudProviderType.NONE.name)
        return try {
            CloudProviderType.valueOf(name ?: CloudProviderType.NONE.name)
        } catch (e: IllegalArgumentException) {
            CloudProviderType.NONE
        }
    }

    /**
     * Enregistre le timestamp de la dernière synchronisation
     */
    fun setLastSyncTimestamp(timestamp: Long) {
        configPrefs.edit().putLong(KEY_LAST_SYNC_TIMESTAMP, timestamp).apply()
    }

    /**
     * Récupère le timestamp de la dernière synchronisation
     */
    fun getLastSyncTimestamp(): Long {
        return configPrefs.getLong(KEY_LAST_SYNC_TIMESTAMP, 0L)
    }

    /**
     * Enregistre le statut de la dernière synchronisation
     */
    fun setLastSyncSuccess(success: Boolean) {
        configPrefs.edit().putBoolean(KEY_LAST_SYNC_SUCCESS, success).apply()
    }

    /**
     * Vérifie si la dernière synchronisation a réussi
     */
    fun wasLastSyncSuccessful(): Boolean {
        return configPrefs.getBoolean(KEY_LAST_SYNC_SUCCESS, false)
    }

    /**
     * Définit la stratégie de résolution des conflits
     */
    fun setConflictResolutionStrategy(strategy: ConflictResolutionStrategy) {
        configPrefs.edit().putString(KEY_CONFLICT_RESOLUTION_STRATEGY, strategy.name).apply()
    }

    /**
     * Récupère la stratégie de résolution des conflits
     */
    fun getConflictResolutionStrategy(): ConflictResolutionStrategy {
        val name = configPrefs.getString(
            KEY_CONFLICT_RESOLUTION_STRATEGY,
            ConflictResolutionStrategy.MANUAL.name
        )
        return try {
            ConflictResolutionStrategy.valueOf(name ?: ConflictResolutionStrategy.MANUAL.name)
        } catch (e: IllegalArgumentException) {
            ConflictResolutionStrategy.MANUAL
        }
    }

    /**
     * Active ou désactive la synchronisation uniquement en WiFi
     */
    fun setWifiOnly(wifiOnly: Boolean) {
        configPrefs.edit().putBoolean(KEY_WIFI_ONLY, wifiOnly).apply()
    }

    /**
     * Vérifie si la synchronisation est limitée au WiFi
     */
    fun isWifiOnly(): Boolean {
        return configPrefs.getBoolean(KEY_WIFI_ONLY, true) // Par défaut: WiFi only
    }

    /**
     * Active ou désactive la synchronisation à chaque changement
     */
    fun setSyncOnChange(enabled: Boolean) {
        configPrefs.edit().putBoolean(KEY_SYNC_ON_CHANGE, enabled).apply()
    }

    /**
     * Vérifie si la synchronisation est activée à chaque changement
     */
    fun isSyncOnChange(): Boolean {
        return configPrefs.getBoolean(KEY_SYNC_ON_CHANGE, false)
    }

    // ===== Credentials Methods (Encrypted) =====

    /**
     * Enregistre les credentials Google Drive
     */
    suspend fun setGoogleDriveCredentials(
        accessToken: String,
        refreshToken: String?
    ) = withContext(Dispatchers.IO) {
        securePrefs.putString(KEY_GOOGLE_DRIVE_TOKEN, accessToken)
        securePrefs.putString(KEY_GOOGLE_DRIVE_REFRESH_TOKEN, refreshToken)
    }

    /**
     * Récupère le token Google Drive
     */
    suspend fun getGoogleDriveAccessToken(): String? = withContext(Dispatchers.IO) {
        securePrefs.getString(KEY_GOOGLE_DRIVE_TOKEN)
    }

    /**
     * Récupère le refresh token Google Drive
     */
    suspend fun getGoogleDriveRefreshToken(): String? = withContext(Dispatchers.IO) {
        securePrefs.getString(KEY_GOOGLE_DRIVE_REFRESH_TOKEN)
    }

    /**
     * Enregistre les credentials OneDrive
     */
    suspend fun setOneDriveCredentials(
        accessToken: String,
        refreshToken: String?
    ) = withContext(Dispatchers.IO) {
        securePrefs.putString(KEY_ONEDRIVE_TOKEN, accessToken)
        securePrefs.putString(KEY_ONEDRIVE_REFRESH_TOKEN, refreshToken)
    }

    /**
     * Récupère le token OneDrive
     */
    suspend fun getOneDriveAccessToken(): String? = withContext(Dispatchers.IO) {
        securePrefs.getString(KEY_ONEDRIVE_TOKEN)
    }

    /**
     * Enregistre les credentials WebDAV
     */
    suspend fun setWebDAVCredentials(
        serverUrl: String,
        username: String,
        password: String,
        validateSSL: Boolean = true
    ) = withContext(Dispatchers.IO) {
        securePrefs.putString(KEY_WEBDAV_URL, serverUrl)
        securePrefs.putString(KEY_WEBDAV_USERNAME, username)
        securePrefs.putString(KEY_WEBDAV_PASSWORD, password)
        securePrefs.putBoolean(KEY_WEBDAV_VALIDATE_SSL, validateSSL)
    }

    /**
     * Récupère les credentials WebDAV
     */
    suspend fun getWebDAVCredentials(): WebDAVCredentials? = withContext(Dispatchers.IO) {
        val url = securePrefs.getString(KEY_WEBDAV_URL)
        val username = securePrefs.getString(KEY_WEBDAV_USERNAME)
        val password = securePrefs.getString(KEY_WEBDAV_PASSWORD)
        val validateSSL = securePrefs.getBoolean(KEY_WEBDAV_VALIDATE_SSL, true)

        if (url != null && username != null && password != null) {
            WebDAVCredentials(url, username, password, validateSSL)
        } else {
            null
        }
    }

    /**
     * Enregistre le token pCloud
     */
    suspend fun setPCloudToken(token: String) = withContext(Dispatchers.IO) {
        securePrefs.putString(KEY_PCLOUD_TOKEN, token)
    }

    /**
     * Récupère le token pCloud
     */
    suspend fun getPCloudToken(): String? = withContext(Dispatchers.IO) {
        securePrefs.getString(KEY_PCLOUD_TOKEN)
    }

    /**
     * Enregistre le token Proton Drive
     */
    suspend fun setProtonDriveToken(token: String) = withContext(Dispatchers.IO) {
        securePrefs.putString(KEY_PROTON_TOKEN, token)
    }

    /**
     * Récupère le token Proton Drive
     */
    suspend fun getProtonDriveToken(): String? = withContext(Dispatchers.IO) {
        securePrefs.getString(KEY_PROTON_TOKEN)
    }

    /**
     * Supprime tous les credentials du provider actuel
     */
    suspend fun clearCurrentProviderCredentials() = withContext(Dispatchers.IO) {
        when (getCurrentProvider()) {
            CloudProviderType.GOOGLE_DRIVE -> {
                securePrefs.remove(
                    KEY_GOOGLE_DRIVE_TOKEN,
                    KEY_GOOGLE_DRIVE_REFRESH_TOKEN
                )
            }
            CloudProviderType.ONEDRIVE -> {
                securePrefs.remove(
                    KEY_ONEDRIVE_TOKEN,
                    KEY_ONEDRIVE_REFRESH_TOKEN
                )
            }
            CloudProviderType.WEBDAV -> {
                securePrefs.remove(
                    KEY_WEBDAV_URL,
                    KEY_WEBDAV_USERNAME,
                    KEY_WEBDAV_PASSWORD,
                    KEY_WEBDAV_VALIDATE_SSL
                )
            }
            CloudProviderType.PCLOUD -> {
                securePrefs.remove(KEY_PCLOUD_TOKEN)
            }
            CloudProviderType.PROTON_DRIVE -> {
                securePrefs.remove(KEY_PROTON_TOKEN)
            }
            CloudProviderType.NONE -> {
                // Nothing to clear
            }
        }
    }

    /**
     * Supprime TOUS les credentials (tous les providers)
     */
    suspend fun clearAllCredentials() = withContext(Dispatchers.IO) {
        securePrefs.remove(
            KEY_GOOGLE_DRIVE_TOKEN,
            KEY_GOOGLE_DRIVE_REFRESH_TOKEN,
            KEY_ONEDRIVE_TOKEN,
            KEY_ONEDRIVE_REFRESH_TOKEN,
            KEY_WEBDAV_URL,
            KEY_WEBDAV_USERNAME,
            KEY_WEBDAV_PASSWORD,
            KEY_WEBDAV_VALIDATE_SSL,
            KEY_PCLOUD_TOKEN,
            KEY_PROTON_TOKEN
        )
    }

    // ===== History Methods =====

    /**
     * Enregistre une synchronisation réussie
     */
    fun recordSuccessfulSync() {
        val totalSyncs = historyPrefs.getInt(KEY_TOTAL_SYNCS, 0) + 1
        val successfulSyncs = historyPrefs.getInt(KEY_SUCCESSFUL_SYNCS, 0) + 1

        historyPrefs.edit()
            .putInt(KEY_TOTAL_SYNCS, totalSyncs)
            .putInt(KEY_SUCCESSFUL_SYNCS, successfulSyncs)
            .apply()

        setLastSyncTimestamp(System.currentTimeMillis())
        setLastSyncSuccess(true)
    }

    /**
     * Enregistre une synchronisation échouée
     */
    fun recordFailedSync(error: String) {
        val totalSyncs = historyPrefs.getInt(KEY_TOTAL_SYNCS, 0) + 1
        val failedSyncs = historyPrefs.getInt(KEY_FAILED_SYNCS, 0) + 1

        historyPrefs.edit()
            .putInt(KEY_TOTAL_SYNCS, totalSyncs)
            .putInt(KEY_FAILED_SYNCS, failedSyncs)
            .putString(KEY_LAST_ERROR, error)
            .putLong(KEY_LAST_ERROR_TIMESTAMP, System.currentTimeMillis())
            .apply()

        setLastSyncTimestamp(System.currentTimeMillis())
        setLastSyncSuccess(false)
    }

    /**
     * Récupère les statistiques de synchronisation
     */
    fun getSyncStatistics(): SyncStatistics {
        return SyncStatistics(
            totalSyncs = historyPrefs.getInt(KEY_TOTAL_SYNCS, 0),
            successfulSyncs = historyPrefs.getInt(KEY_SUCCESSFUL_SYNCS, 0),
            failedSyncs = historyPrefs.getInt(KEY_FAILED_SYNCS, 0),
            lastError = historyPrefs.getString(KEY_LAST_ERROR, null),
            lastErrorTimestamp = historyPrefs.getLong(KEY_LAST_ERROR_TIMESTAMP, 0L)
        )
    }

    /**
     * Réinitialise l'historique de synchronisation
     */
    fun clearSyncHistory() {
        historyPrefs.edit().clear().apply()
    }

    /**
     * Réinitialise complètement toutes les préférences de synchronisation
     */
    suspend fun resetAll() = withContext(Dispatchers.IO) {
        configPrefs.edit().clear().apply()
        credentialPrefs.edit().clear().apply()
        historyPrefs.edit().clear().apply()
    }
}

/**
 * Credentials WebDAV
 */
data class WebDAVCredentials(
    val serverUrl: String,
    val username: String,
    val password: String,
    val validateSSL: Boolean
)

/**
 * Statistiques de synchronisation
 */
data class SyncStatistics(
    val totalSyncs: Int,
    val successfulSyncs: Int,
    val failedSyncs: Int,
    val lastError: String?,
    val lastErrorTimestamp: Long
) {
    val successRate: Float
        get() = if (totalSyncs > 0) {
            (successfulSyncs.toFloat() / totalSyncs.toFloat()) * 100f
        } else {
            0f
        }
}
