package com.genpwd.sync.oauth

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Secure storage for OAuth PKCE code_verifier values using EncryptedSharedPreferences.
 *
 * Code verifiers are stored with a timestamp and automatically expire after 10 minutes.
 * This prevents replay attacks and cleans up abandoned OAuth flows.
 */
@Singleton
class EncryptedOAuthStateStorage @Inject constructor(
    @ApplicationContext private val context: Context
) : OAuthStateStorage {

    companion object {
        private const val PREFS_NAME = "oauth_state_storage"
        private const val EXPIRY_DURATION_MS = 10 * 60 * 1000L // 10 minutes
    }

    private val json = Json { ignoreUnknownKeys = true }

    private val masterKey: MasterKey by lazy {
        MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
    }

    private val sharedPreferences: SharedPreferences by lazy {
        EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    override suspend fun saveCodeVerifier(state: String, codeVerifier: String) {
        withContext(Dispatchers.IO) {
            val entry = OAuthStateEntry(
                codeVerifier = codeVerifier,
                timestamp = System.currentTimeMillis()
            )
            val json = json.encodeToString(entry)
            sharedPreferences.edit().putString(state, json).apply()
        }
    }

    override suspend fun getCodeVerifier(state: String): String? {
        return withContext(Dispatchers.IO) {
            val jsonString = sharedPreferences.getString(state, null) ?: return@withContext null

            try {
                val entry = json.decodeFromString<OAuthStateEntry>(jsonString)

                // Check if expired
                val now = System.currentTimeMillis()
                if (now - entry.timestamp > EXPIRY_DURATION_MS) {
                    // Expired - remove and return null
                    sharedPreferences.edit().remove(state).apply()
                    return@withContext null
                }

                entry.codeVerifier
            } catch (e: Exception) {
                // Corrupted entry - remove and return null
                sharedPreferences.edit().remove(state).apply()
                null
            }
        }
    }

    override suspend fun clearCodeVerifier(state: String) {
        withContext(Dispatchers.IO) {
            sharedPreferences.edit().remove(state).apply()
        }
    }

    override suspend fun clearExpired() {
        withContext(Dispatchers.IO) {
            val now = System.currentTimeMillis()
            val editor = sharedPreferences.edit()
            var hasChanges = false

            sharedPreferences.all.forEach { (key, value) ->
                if (value is String) {
                    try {
                        val entry = json.decodeFromString<OAuthStateEntry>(value)
                        if (now - entry.timestamp > EXPIRY_DURATION_MS) {
                            editor.remove(key)
                            hasChanges = true
                        }
                    } catch (e: Exception) {
                        // Corrupted entry - remove it
                        editor.remove(key)
                        hasChanges = true
                    }
                }
            }

            if (hasChanges) {
                editor.apply()
            }
        }
    }
}

/**
 * Internal data class for storing code_verifier with timestamp.
 */
@Serializable
private data class OAuthStateEntry(
    val codeVerifier: String,
    val timestamp: Long
)
