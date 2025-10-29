package com.julien.genpwdpro.presentation.util

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Handler
import android.os.Looper

object ClipboardUtils {
    @JvmStatic
    fun copySensitive(context: Context, label: String, value: String, ttlMs: Long = 10_000L) {
        val cm = context.getSystemService(ClipboardManager::class.java)
        cm?.setPrimaryClip(ClipData.newPlainText(label, value))
        // Auto-clear after ttlMs
        Handler(Looper.getMainLooper()).postDelayed({
            if (cm?.hasPrimaryClip() == true) {
                cm.setPrimaryClip(ClipData.newPlainText("", ""))
            }
        }, ttlMs)
    }
}
