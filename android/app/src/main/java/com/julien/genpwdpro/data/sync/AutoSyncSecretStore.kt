package com.julien.genpwdpro.data.sync

import android.util.Base64
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.data.secure.SecurePrefs
import com.julien.genpwdpro.security.EncryptedKeystoreData
import com.julien.genpwdpro.security.KeystoreAlias
import com.julien.genpwdpro.security.KeystoreManager
import javax.inject.Inject
import javax.inject.Singleton
import org.json.JSONObject

/**
 * Secure storage for auto-sync secrets.
 *
 * The master password is encrypted with the dedicated sync keystore key and
 * stored inside EncryptedSharedPreferences. WorkManager only receives an
 * opaque reference (vaultId) so its database never contains the plaintext.
 */
@Singleton
class AutoSyncSecretStore @Inject constructor(
    private val securePrefs: SecurePrefs,
    private val keystoreManager: KeystoreManager
) {
    companion object {
        private const val TAG = "AutoSyncSecretStore"
        private const val PREF_PREFIX = "sync_secret_"
        private const val FIELD_CIPHERTEXT = "ciphertext"
        private const val FIELD_IV = "iv"
        private const val FIELD_KEY_ALIAS = "keyAlias"
    }

    /**
     * Persist the master password encrypted with the sync keystore key.
     */
    fun persistSecret(vaultId: String, masterPassword: String): Boolean {
        return runCatching {
            val encrypted = keystoreManager.encryptString(
                masterPassword,
                KeystoreAlias.SYNC.alias
            )
            val payload = JSONObject().apply {
                put(FIELD_CIPHERTEXT, encrypted.ciphertext.encode())
                put(FIELD_IV, encrypted.iv.encode())
                put(FIELD_KEY_ALIAS, encrypted.keyAlias)
            }
            securePrefs.putString(prefKey(vaultId), payload.toString())
        }.onFailure { error ->
            SafeLog.e(
                TAG,
                "Failed to persist auto-sync secret: vaultId=${SafeLog.redact(vaultId)}",
                error
            )
        }.getOrDefault(false)
    }

    /**
     * Retrieve the decrypted master password for a vault.
     */
    fun canAccessSecrets(): Boolean = securePrefs.isUnlocked()

    fun getSecret(vaultId: String): String? {
        val encoded = securePrefs.getString(prefKey(vaultId)) ?: return null
        val payload = runCatching { JSONObject(encoded) }.getOrElse { error ->
            SafeLog.e(
                TAG,
                "Corrupted auto-sync secret payload: vaultId=${SafeLog.redact(vaultId)}",
                error
            )
            securePrefs.remove(prefKey(vaultId))
            return null
        }

        val ciphertext = payload.optString(FIELD_CIPHERTEXT, null)?.decode() ?: return null
        val iv = payload.optString(FIELD_IV, null)?.decode() ?: return null
        val keyAlias = payload.optString(FIELD_KEY_ALIAS, null) ?: return null

        return runCatching {
            val encrypted = EncryptedKeystoreData(
                ciphertext = ciphertext,
                iv = iv,
                keyAlias = keyAlias
            )
            keystoreManager.decryptString(encrypted)
        }.onFailure { error ->
            SafeLog.e(
                TAG,
                "Unable to decrypt auto-sync secret: vaultId=${SafeLog.redact(vaultId)}",
                error
            )
        }.getOrNull()
    }

    /**
     * Remove the stored secret for a vault.
     */
    fun clearSecret(vaultId: String) {
        if (!securePrefs.remove(prefKey(vaultId))) {
            SafeLog.w(
                TAG,
                "Unable to clear auto-sync secret: vaultId=${SafeLog.redact(vaultId)}"
            )
        }
    }

    private fun ByteArray.encode(): String = Base64.encodeToString(this, Base64.NO_WRAP)

    private fun String.decode(): ByteArray = Base64.decode(this, Base64.NO_WRAP)

    private fun prefKey(vaultId: String) = "$PREF_PREFIX$vaultId"
}
