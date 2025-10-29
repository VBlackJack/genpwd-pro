package com.julien.genpwdpro.presentation.widget.storage

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import androidx.core.content.edit

private const val PREF_FILE = "password_widget_state"
private const val KEY_NEEDS_REFRESH = "needs_refresh"

/**
 * Préférences stockées dans le Device Protected Storage pour conserver l'état du widget
 * même lorsque l'appareil n'est pas encore déverrouillé.
 */
object WidgetDeviceStorage {

    fun markNeedsRefresh(context: Context) {
        prefs(context).edit { putBoolean(KEY_NEEDS_REFRESH, true) }
    }

    fun consumeNeedsRefresh(context: Context): Boolean {
        val prefs = prefs(context)
        val needsRefresh = prefs.getBoolean(KEY_NEEDS_REFRESH, false)
        if (needsRefresh) {
            prefs.edit { putBoolean(KEY_NEEDS_REFRESH, false) }
        }
        return needsRefresh
    }

    private fun prefs(context: Context): SharedPreferences {
        val targetContext = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            val deviceContext = context.createDeviceProtectedStorageContext()
            deviceContext.moveSharedPreferencesFrom(context, PREF_FILE)
            deviceContext
        } else {
            context
        }
        return targetContext.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE)
    }
}
