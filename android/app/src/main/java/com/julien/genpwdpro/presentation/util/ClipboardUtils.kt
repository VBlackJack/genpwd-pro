package com.julien.genpwdpro.presentation.util

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Handler
import android.os.Looper
import com.julien.genpwdpro.R
import com.julien.genpwdpro.core.crypto.SecretUtils
import com.julien.genpwdpro.data.secure.SensitiveActionPreferences

object ClipboardUtils {
    @JvmStatic
    fun copySensitive(
        context: Context,
        label: String,
        value: CharArray,
        ttlMs: Long = SensitiveActionPreferences.DEFAULT_CLIPBOARD_TTL_MS
    ) {
        val clipValue = value.concatToString()
        val cm = context.getSystemService(ClipboardManager::class.java)
        try {
            cm?.setPrimaryClip(ClipData.newPlainText(label, clipValue))
            if (ttlMs > 0) {
                Handler(Looper.getMainLooper()).postDelayed({
                    if (cm?.hasPrimaryClip() == true) {
                        cm.setPrimaryClip(ClipData.newPlainText("", ""))
                    }
                }, ttlMs)
            }
        } finally {
            SecretUtils.wipe(value)
        }
    }

    fun copySensitive(
        context: Context,
        label: String,
        value: String,
        ttlMs: Long = SensitiveActionPreferences.DEFAULT_CLIPBOARD_TTL_MS
    ) {
        val buffer = value.toCharArray()
        copySensitive(context, label, buffer, ttlMs)
    }

    fun buildAutoClearMessage(context: Context, ttlMs: Long): String {
        return if (ttlMs > 0) {
            val seconds = (ttlMs / 1000L).coerceAtLeast(1)
            context.getString(R.string.clipboard_auto_clear_message, seconds)
        } else {
            context.getString(R.string.msg_copied)
        }
    }
}
