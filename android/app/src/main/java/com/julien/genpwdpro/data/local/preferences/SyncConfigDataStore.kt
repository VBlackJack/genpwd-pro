package com.julien.genpwdpro.data.local.preferences

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import com.julien.genpwdpro.data.sync.models.CloudProviderType
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

private val Context.syncConfigDataStore: DataStore<Preferences> by preferencesDataStore(name = "sync_config")

/**
 * Gestion de la persistence de la configuration de synchronisation
 *
 * Sauvegarde :
 * - État activé/désactivé de la sync
 * - Provider cloud actif
 * - Intervalle de synchronisation
 * - Mode auto-sync
 * - Préférence WiFi-only
 */
@Singleton
class SyncConfigDataStore @Inject constructor(
    @ApplicationContext private val context: Context
) {

    private object PreferencesKeys {
        val SYNC_ENABLED = booleanPreferencesKey("sync_enabled")
        val PROVIDER_TYPE = stringPreferencesKey("provider_type")
        val AUTO_SYNC = booleanPreferencesKey("auto_sync")
        val SYNC_INTERVAL = longPreferencesKey("sync_interval")
        val SYNC_ON_WIFI_ONLY = booleanPreferencesKey("sync_on_wifi_only")
        val LAST_SYNC_TIMESTAMP = longPreferencesKey("last_sync_timestamp")
    }

    /**
     * Configuration de sync sous forme de data class
     */
    data class SyncConfigData(
        val enabled: Boolean = false,
        val providerType: CloudProviderType = CloudProviderType.NONE,
        val autoSync: Boolean = false,
        val syncInterval: Long = 3600000L, // 1 heure par défaut
        val syncOnWifiOnly: Boolean = true,
        val lastSyncTimestamp: Long = 0L
    )

    /**
     * Flux de configuration de sync
     */
    val syncConfigFlow: Flow<SyncConfigData> = context.syncConfigDataStore.data
        .catch { exception ->
            if (exception is IOException) {
                emit(emptyPreferences())
            } else {
                throw exception
            }
        }
        .map { preferences ->
            SyncConfigData(
                enabled = preferences[PreferencesKeys.SYNC_ENABLED] ?: false,
                providerType = preferences[PreferencesKeys.PROVIDER_TYPE]?.let {
                    try {
                        CloudProviderType.valueOf(it)
                    } catch (e: Exception) {
                        CloudProviderType.NONE
                    }
                } ?: CloudProviderType.NONE,
                autoSync = preferences[PreferencesKeys.AUTO_SYNC] ?: false,
                syncInterval = preferences[PreferencesKeys.SYNC_INTERVAL] ?: 3600000L,
                syncOnWifiOnly = preferences[PreferencesKeys.SYNC_ON_WIFI_ONLY] ?: true,
                lastSyncTimestamp = preferences[PreferencesKeys.LAST_SYNC_TIMESTAMP] ?: 0L
            )
        }

    /**
     * Sauvegarde la configuration complète
     */
    suspend fun saveSyncConfig(config: SyncConfigData) {
        context.syncConfigDataStore.edit { preferences ->
            preferences[PreferencesKeys.SYNC_ENABLED] = config.enabled
            preferences[PreferencesKeys.PROVIDER_TYPE] = config.providerType.name
            preferences[PreferencesKeys.AUTO_SYNC] = config.autoSync
            preferences[PreferencesKeys.SYNC_INTERVAL] = config.syncInterval
            preferences[PreferencesKeys.SYNC_ON_WIFI_ONLY] = config.syncOnWifiOnly
            preferences[PreferencesKeys.LAST_SYNC_TIMESTAMP] = config.lastSyncTimestamp
        }
    }

    /**
     * Met à jour uniquement l'état enabled
     */
    suspend fun setSyncEnabled(enabled: Boolean) {
        context.syncConfigDataStore.edit { preferences ->
            preferences[PreferencesKeys.SYNC_ENABLED] = enabled
        }
    }

    /**
     * Met à jour le provider actif
     */
    suspend fun setProviderType(providerType: CloudProviderType) {
        context.syncConfigDataStore.edit { preferences ->
            preferences[PreferencesKeys.PROVIDER_TYPE] = providerType.name
        }
    }

    /**
     * Met à jour l'auto-sync
     */
    suspend fun setAutoSync(autoSync: Boolean) {
        context.syncConfigDataStore.edit { preferences ->
            preferences[PreferencesKeys.AUTO_SYNC] = autoSync
        }
    }

    /**
     * Met à jour l'intervalle de sync
     */
    suspend fun setSyncInterval(interval: Long) {
        context.syncConfigDataStore.edit { preferences ->
            preferences[PreferencesKeys.SYNC_INTERVAL] = interval
        }
    }

    /**
     * Met à jour la préférence WiFi-only
     */
    suspend fun setSyncOnWifiOnly(wifiOnly: Boolean) {
        context.syncConfigDataStore.edit { preferences ->
            preferences[PreferencesKeys.SYNC_ON_WIFI_ONLY] = wifiOnly
        }
    }

    /**
     * Met à jour le timestamp de dernière sync
     */
    suspend fun updateLastSyncTimestamp(timestamp: Long = System.currentTimeMillis()) {
        context.syncConfigDataStore.edit { preferences ->
            preferences[PreferencesKeys.LAST_SYNC_TIMESTAMP] = timestamp
        }
    }

    /**
     * Efface toute la configuration
     */
    suspend fun clearSyncConfig() {
        context.syncConfigDataStore.edit { preferences ->
            preferences.clear()
        }
    }
}
