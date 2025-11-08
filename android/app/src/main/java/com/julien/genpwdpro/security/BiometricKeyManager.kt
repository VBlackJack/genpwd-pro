package com.julien.genpwdpro.security

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.google.gson.Gson
import com.julien.genpwdpro.core.log.SafeLog
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Gestionnaire de clés biométriques avec versioning et rotation
 *
 * SECURITY IMPROVEMENTS:
 * - Each vault has its own versioned biometric key
 * - Keys can be rotated without losing access
 * - Metadata stored in EncryptedSharedPreferences
 * - Supports key revocation for security incidents
 *
 * Architecture:
 * ```
 * Vault A → biometric_v1 (created)
 *        → biometric_v2 (rotated)
 *        → biometric_v3 (current)
 *
 * Vault B → biometric_v1 (current)
 * ```
 */
@Singleton
class BiometricKeyManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val keystoreManager: KeystoreManager
) {
    companion object {
        private const val TAG = "BiometricKeyManager"
        private const val PREFS_NAME = "biometric_key_metadata"
        private const val KEY_PREFIX = "genpwd_vault_"
        private const val KEY_SUFFIX = "_biometric"

        // Auto-rotation settings (configurable)
        private const val AUTO_ROTATION_DAYS = 90L
        private const val MILLIS_PER_DAY = 24 * 60 * 60 * 1000L
    }

    private val gson = Gson()

    private val encryptedPrefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    /**
     * Metadata for a biometric key
     */
    data class BiometricKeyMetadata(
        val vaultId: String,
        val keyAlias: String,
        val keyVersion: Int,
        val createdAt: Long,
        val lastUsed: Long,
        val rotationCount: Int = 0
    ) {
        fun shouldAutoRotate(): Boolean {
            val age = System.currentTimeMillis() - createdAt
            return age > (AUTO_ROTATION_DAYS * MILLIS_PER_DAY)
        }
    }

    /**
     * Creates a new versioned biometric key for a vault
     *
     * @param vaultId Vault identifier
     * @param masterPassword Master password to encrypt
     * @return Encrypted data with new key metadata
     */
    fun createKeyForVault(
        vaultId: String,
        masterPassword: String
    ): EncryptedKeystoreData {
        val currentMetadata = getKeyMetadata(vaultId)
        val newVersion = (currentMetadata?.keyVersion ?: 0) + 1
        val keyAlias = buildKeyAlias(vaultId, newVersion)

        SafeLog.d(TAG, "Creating biometric key: vault=${SafeLog.redact(vaultId)}, version=$newVersion")

        // Encrypt master password with new key
        val encrypted = keystoreManager.encryptString(masterPassword, keyAlias)

        // Store metadata
        val metadata = BiometricKeyMetadata(
            vaultId = vaultId,
            keyAlias = keyAlias,
            keyVersion = newVersion,
            createdAt = System.currentTimeMillis(),
            lastUsed = System.currentTimeMillis(),
            rotationCount = currentMetadata?.rotationCount ?: 0
        )
        saveKeyMetadata(metadata)

        // Delete old key if exists
        currentMetadata?.let { old ->
            keystoreManager.deleteKey(old.keyAlias)
            SafeLog.d(TAG, "Deleted old biometric key version ${old.keyVersion}")
        }

        SafeLog.i(TAG, "Biometric key created successfully: version=$newVersion")
        return encrypted
    }

    /**
     * Gets the current key metadata for a vault
     */
    fun getKeyMetadata(vaultId: String): BiometricKeyMetadata? {
        val json = encryptedPrefs.getString(vaultId, null) ?: return null
        return try {
            gson.fromJson(json, BiometricKeyMetadata::class.java)
        } catch (e: Exception) {
            SafeLog.e(TAG, "Failed to parse key metadata for vault: ${SafeLog.redact(vaultId)}", e)
            null
        }
    }

    /**
     * Updates last used timestamp
     */
    fun updateLastUsed(vaultId: String) {
        val metadata = getKeyMetadata(vaultId) ?: return
        val updated = metadata.copy(lastUsed = System.currentTimeMillis())
        saveKeyMetadata(updated)
    }

    /**
     * Rotates the biometric key for a vault
     *
     * This creates a new versioned key and re-encrypts the master password
     * The old key is deleted after successful rotation
     *
     * @param vaultId Vault identifier
     * @param masterPassword Master password to re-encrypt
     * @return New encrypted data
     */
    fun rotateKey(vaultId: String, masterPassword: String): EncryptedKeystoreData {
        val currentMetadata = getKeyMetadata(vaultId)
            ?: throw IllegalStateException("No biometric key found for vault: $vaultId")

        SafeLog.i(TAG, "Rotating biometric key: vault=${SafeLog.redact(vaultId)}, " +
            "from version ${currentMetadata.keyVersion} to ${currentMetadata.keyVersion + 1}")

        // Create new key with incremented version
        val newVersion = currentMetadata.keyVersion + 1
        val newKeyAlias = buildKeyAlias(vaultId, newVersion)

        // Encrypt with new key
        val encrypted = keystoreManager.encryptString(masterPassword, newKeyAlias)

        // Update metadata
        val newMetadata = BiometricKeyMetadata(
            vaultId = vaultId,
            keyAlias = newKeyAlias,
            keyVersion = newVersion,
            createdAt = System.currentTimeMillis(),
            lastUsed = System.currentTimeMillis(),
            rotationCount = currentMetadata.rotationCount + 1
        )
        saveKeyMetadata(newMetadata)

        // Delete old key
        keystoreManager.deleteKey(currentMetadata.keyAlias)
        SafeLog.i(TAG, "Biometric key rotated successfully: new version=$newVersion")

        return encrypted
    }

    /**
     * Revokes all biometric keys for a vault
     *
     * Use this for security incidents or when user wants to disable biometrics
     */
    fun revokeAllKeys(vaultId: String) {
        SafeLog.w(TAG, "Revoking all biometric keys for vault: ${SafeLog.redact(vaultId)}")

        val metadata = getKeyMetadata(vaultId)
        metadata?.let {
            keystoreManager.deleteKey(it.keyAlias)
            SafeLog.d(TAG, "Deleted biometric key: ${it.keyAlias}")
        }

        deleteKeyMetadata(vaultId)
        SafeLog.i(TAG, "All biometric keys revoked for vault: ${SafeLog.redact(vaultId)}")
    }

    /**
     * Checks if a key should be auto-rotated based on age
     */
    fun shouldRotateKey(vaultId: String): Boolean {
        val metadata = getKeyMetadata(vaultId) ?: return false
        return metadata.shouldAutoRotate()
    }

    /**
     * Gets statistics about biometric keys (for debugging/monitoring)
     */
    fun getKeyStatistics(vaultId: String): Map<String, Any>? {
        val metadata = getKeyMetadata(vaultId) ?: return null

        val age = System.currentTimeMillis() - metadata.createdAt
        val daysSinceCreation = age / MILLIS_PER_DAY
        val daysSinceLastUse = (System.currentTimeMillis() - metadata.lastUsed) / MILLIS_PER_DAY

        return mapOf(
            "version" to metadata.keyVersion,
            "rotationCount" to metadata.rotationCount,
            "daysSinceCreation" to daysSinceCreation,
            "daysSinceLastUse" to daysSinceLastUse,
            "shouldAutoRotate" to metadata.shouldAutoRotate(),
            "keyAlias" to metadata.keyAlias
        )
    }

    /**
     * Lists all vaults with biometric keys enabled
     */
    fun listVaultsWithBiometric(): List<String> {
        return encryptedPrefs.all.keys.toList()
    }

    // ========== Private Methods ==========

    private fun buildKeyAlias(vaultId: String, version: Int): String {
        return "${KEY_PREFIX}${vaultId}${KEY_SUFFIX}_v${version}"
    }

    private fun saveKeyMetadata(metadata: BiometricKeyMetadata) {
        val json = gson.toJson(metadata)
        encryptedPrefs.edit().putString(metadata.vaultId, json).apply()
    }

    private fun deleteKeyMetadata(vaultId: String) {
        encryptedPrefs.edit().remove(vaultId).apply()
    }

    /**
     * Migrates legacy biometric keys (without versioning) to versioned keys
     *
     * This should be called once to migrate existing installations
     * Legacy keys use format: genpwd_vault_{vaultId}_biometric
     * New keys use format: genpwd_vault_{vaultId}_biometric_v{version}
     */
    fun migrateLegacyKeys() {
        val legacyKeys = keystoreManager.listKeys().filter { alias ->
            alias.matches(Regex("${KEY_PREFIX}[a-f0-9-]+${KEY_SUFFIX}$")) // No version suffix
        }

        if (legacyKeys.isEmpty()) {
            SafeLog.d(TAG, "No legacy biometric keys found")
            return
        }

        SafeLog.i(TAG, "Found ${legacyKeys.size} legacy biometric keys to migrate")

        legacyKeys.forEach { legacyAlias ->
            try {
                // Extract vaultId from legacy alias
                val vaultId = legacyAlias
                    .removePrefix(KEY_PREFIX)
                    .removeSuffix(KEY_SUFFIX)

                // Check if already migrated
                if (getKeyMetadata(vaultId) != null) {
                    SafeLog.d(TAG, "Vault already migrated: ${SafeLog.redact(vaultId)}")
                    return@forEach
                }

                // Create metadata for legacy key (version 1)
                val metadata = BiometricKeyMetadata(
                    vaultId = vaultId,
                    keyAlias = legacyAlias,
                    keyVersion = 1,
                    createdAt = System.currentTimeMillis(),
                    lastUsed = System.currentTimeMillis(),
                    rotationCount = 0
                )
                saveKeyMetadata(metadata)

                SafeLog.i(TAG, "Migrated legacy key: ${SafeLog.redact(vaultId)} → version 1")
            } catch (e: Exception) {
                SafeLog.e(TAG, "Failed to migrate legacy key: $legacyAlias", e)
            }
        }
    }
}
