package com.julien.genpwdpro.security

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Gestionnaire de verrouillage de l'application
 *
 * Fonctionnalités:
 * - Verrouillage automatique après inactivité
 * - Authentification biométrique requise au déverrouillage
 * - Délais configurables (immédiat, 30s, 1min, 5min, 15min)
 * - Protection au démarrage de l'app
 * - Protection lors du retour en premier plan
 */
@Singleton
class AppLockManager @Inject constructor(
    @ApplicationContext private val context: Context
) {

    companion object {
        private val APP_LOCK_ENABLED = booleanPreferencesKey("app_lock_enabled")
        private val APP_LOCK_TIMEOUT = longPreferencesKey("app_lock_timeout_ms")
        private val LAST_ACTIVE_TIMESTAMP = longPreferencesKey("last_active_timestamp")
        private val IS_LOCKED = booleanPreferencesKey("is_locked")

        // Délais de verrouillage prédéfinis (en millisecondes)
        const val TIMEOUT_IMMEDIATE = 0L
        const val TIMEOUT_30_SECONDS = 30_000L
        const val TIMEOUT_1_MINUTE = 60_000L
        const val TIMEOUT_5_MINUTES = 300_000L
        const val TIMEOUT_15_MINUTES = 900_000L

        private val Context.appLockDataStore: DataStore<Preferences> by preferencesDataStore(
            name = "app_lock_prefs"
        )
    }

    private val dataStore = context.appLockDataStore

    /**
     * Observe l'activation du verrouillage
     */
    val isAppLockEnabled: Flow<Boolean> = dataStore.data.map { prefs ->
        prefs[APP_LOCK_ENABLED] ?: false
    }

    /**
     * Observe le délai de verrouillage
     */
    val lockTimeout: Flow<Long> = dataStore.data.map { prefs ->
        prefs[APP_LOCK_TIMEOUT] ?: TIMEOUT_1_MINUTE
    }

    /**
     * Observe l'état de verrouillage
     */
    val isLocked: Flow<Boolean> = dataStore.data.map { prefs ->
        prefs[IS_LOCKED] ?: false
    }

    /**
     * Active ou désactive le verrouillage de l'app
     */
    suspend fun setAppLockEnabled(enabled: Boolean) {
        dataStore.edit { prefs ->
            prefs[APP_LOCK_ENABLED] = enabled
            if (!enabled) {
                prefs[IS_LOCKED] = false
            }
        }
    }

    /**
     * Configure le délai de verrouillage automatique
     */
    suspend fun setLockTimeout(timeoutMs: Long) {
        dataStore.edit { prefs ->
            prefs[APP_LOCK_TIMEOUT] = timeoutMs
        }
    }

    /**
     * Enregistre l'horodatage de la dernière activité
     */
    suspend fun updateLastActiveTime() {
        dataStore.edit { prefs ->
            prefs[LAST_ACTIVE_TIMESTAMP] = System.currentTimeMillis()
        }
    }

    /**
     * Vérifie si l'app doit être verrouillée
     * Appelé lors du retour en premier plan (onResume)
     */
    suspend fun checkAndLockIfNeeded() {
        dataStore.edit { prefs ->
            val enabled = prefs[APP_LOCK_ENABLED] ?: false
            if (!enabled) return@edit

            val timeout = prefs[APP_LOCK_TIMEOUT] ?: TIMEOUT_1_MINUTE
            val lastActive = prefs[LAST_ACTIVE_TIMESTAMP] ?: 0L
            val now = System.currentTimeMillis()
            val elapsed = now - lastActive

            if (timeout == TIMEOUT_IMMEDIATE || elapsed >= timeout) {
                prefs[IS_LOCKED] = true
            }
        }
    }

    /**
     * Déverrouille l'application après authentification réussie
     */
    suspend fun unlock() {
        dataStore.edit { prefs ->
            prefs[IS_LOCKED] = false
            prefs[LAST_ACTIVE_TIMESTAMP] = System.currentTimeMillis()
        }
    }

    /**
     * Verrouille manuellement l'application
     */
    suspend fun lock() {
        dataStore.edit { prefs ->
            prefs[IS_LOCKED] = true
        }
    }

    /**
     * Force le verrouillage au démarrage
     * Appelé dans MainActivity.onCreate()
     */
    suspend fun lockOnAppStart() {
        dataStore.edit { prefs ->
            val enabled = prefs[APP_LOCK_ENABLED] ?: false
            if (enabled) {
                prefs[IS_LOCKED] = true
            }
        }
    }

    /**
     * Obtient le nom lisible du délai de verrouillage
     */
    fun getTimeoutDisplayName(timeoutMs: Long): String {
        return when (timeoutMs) {
            TIMEOUT_IMMEDIATE -> "Immédiat"
            TIMEOUT_30_SECONDS -> "30 secondes"
            TIMEOUT_1_MINUTE -> "1 minute"
            TIMEOUT_5_MINUTES -> "5 minutes"
            TIMEOUT_15_MINUTES -> "15 minutes"
            else -> "${timeoutMs / 1000} secondes"
        }
    }

    /**
     * Tous les délais disponibles
     */
    fun getAllTimeouts(): List<LockTimeout> {
        return listOf(
            LockTimeout("Immédiat", TIMEOUT_IMMEDIATE),
            LockTimeout("30 secondes", TIMEOUT_30_SECONDS),
            LockTimeout("1 minute", TIMEOUT_1_MINUTE),
            LockTimeout("5 minutes", TIMEOUT_5_MINUTES),
            LockTimeout("15 minutes", TIMEOUT_15_MINUTES)
        )
    }
}

/**
 * Délai de verrouillage
 */
data class LockTimeout(
    val displayName: String,
    val milliseconds: Long
)
