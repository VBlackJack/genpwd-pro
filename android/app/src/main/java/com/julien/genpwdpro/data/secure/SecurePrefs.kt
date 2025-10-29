package com.julien.genpwdpro.data.secure

import android.app.KeyguardManager
import android.content.Context
import android.os.Build
import android.os.UserManager
import androidx.core.content.getSystemService
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SecurePrefs @Inject constructor(
    @ApplicationContext context: Context
) {
    private val appContext = context.applicationContext

    private val masterKey: MasterKey by lazy {
        MasterKey.Builder(appContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
    }

    private val encryptedPrefs by lazy {
        EncryptedSharedPreferences.create(
            appContext,
            PREF_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    fun isUnlocked(): Boolean = isDeviceUnlocked()

    fun getString(key: String, defaultValue: String? = null): String? {
        return prefsIfUnlocked()?.getString(key, defaultValue) ?: defaultValue
    }

    fun putString(key: String, value: String?) {
        val prefs = prefsIfUnlocked() ?: return
        prefs.edit().apply {
            if (value == null) {
                remove(key)
            } else {
                putString(key, value)
            }
            apply()
        }
    }

    fun getBoolean(key: String, defaultValue: Boolean = false): Boolean {
        return prefsIfUnlocked()?.getBoolean(key, defaultValue) ?: defaultValue
    }

    fun putBoolean(key: String, value: Boolean) {
        prefsIfUnlocked()?.edit()?.apply {
            putBoolean(key, value)
            apply()
        }
    }

    fun getLong(key: String, defaultValue: Long = 0L): Long {
        return prefsIfUnlocked()?.getLong(key, defaultValue) ?: defaultValue
    }

    fun putLong(key: String, value: Long) {
        prefsIfUnlocked()?.edit()?.apply {
            putLong(key, value)
            apply()
        }
    }

    fun contains(key: String): Boolean {
        return prefsIfUnlocked()?.contains(key) ?: false
    }

    fun remove(vararg keys: String) {
        val prefs = prefsIfUnlocked() ?: return
        prefs.edit().apply {
            keys.forEach { remove(it) }
            apply()
        }
    }

    fun clearAll() {
        prefsIfUnlocked()?.edit()?.clear()?.apply()
    }

    private fun prefsIfUnlocked() = if (isDeviceUnlocked()) encryptedPrefs else null

    private fun isDeviceUnlocked(): Boolean {
        val userManager = appContext.getSystemService<UserManager>()
        val keyguardManager = appContext.getSystemService<KeyguardManager>()

        val isUserUnlocked = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            userManager?.isUserUnlocked == true
        } else {
            true
        }

        val isLocked = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            keyguardManager?.isDeviceLocked == true
        } else {
            keyguardManager?.inKeyguardRestrictedInputMode() == true
        }

        return isUserUnlocked && !isLocked
    }

    companion object {
        private const val PREF_NAME = "secure_prefs"
    }
}
