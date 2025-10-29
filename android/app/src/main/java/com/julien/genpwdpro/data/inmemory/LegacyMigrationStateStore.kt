package com.julien.genpwdpro.data.inmemory

import android.content.Context
import androidx.core.content.edit
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Persists bookkeeping information about the one-off legacy data migration so that the
 * import does not run multiple times and so that the UI can prompt the user to re-authenticate
 * when automatic migration fails.
 */
@Singleton
class LegacyMigrationStateStore @Inject constructor(
    @ApplicationContext context: Context
) {

    private val prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    fun isMigrationCompleted(): Boolean = prefs.getBoolean(KEY_COMPLETED, false)

    fun markMigrationCompleted() {
        prefs.edit { putBoolean(KEY_COMPLETED, true) }
    }

    fun clearMigrationCompleted() {
        prefs.edit { remove(KEY_COMPLETED) }
    }

    fun markReauthenticationRequired(vaultIds: Collection<String>) {
        if (vaultIds.isEmpty()) {
            clearReauthenticationRequired()
            return
        }
        val serialized = vaultIds.joinToString(separator = ",")
        prefs.edit {
            putString(KEY_REAUTH_VAULT_IDS, serialized)
            putLong(KEY_LAST_FAILURE_TIMESTAMP, System.currentTimeMillis())
        }
    }

    fun clearReauthenticationRequired() {
        prefs.edit {
            remove(KEY_REAUTH_VAULT_IDS)
            remove(KEY_LAST_FAILURE_TIMESTAMP)
        }
    }

    fun consumePendingReauthenticationVaultIds(): Set<String> {
        val stored = prefs.getString(KEY_REAUTH_VAULT_IDS, null)
        if (stored.isNullOrBlank()) {
            clearReauthenticationRequired()
            return emptySet()
        }
        val ids = stored.split(',')
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .toSet()
        clearReauthenticationRequired()
        return ids
    }

    fun lastFailureTimestamp(): Long = prefs.getLong(KEY_LAST_FAILURE_TIMESTAMP, 0L)

    companion object {
        private const val PREF_NAME = "legacy_migration_state"
        private const val KEY_COMPLETED = "completed"
        private const val KEY_REAUTH_VAULT_IDS = "reauth_vault_ids"
        private const val KEY_LAST_FAILURE_TIMESTAMP = "last_failure_at"
    }
}
