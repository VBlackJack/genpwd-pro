package com.julien.genpwdpro.presentation.util

import android.content.Context
import android.os.Handler
import android.os.Looper
import androidx.annotation.VisibleForTesting
import com.julien.genpwdpro.R
import com.julien.genpwdpro.core.clipboard.ClipboardSanitizer
import com.julien.genpwdpro.core.crypto.SecretUtils
import com.julien.genpwdpro.data.secure.SensitiveActionPreferences

object ClipboardUtils {
    interface ClipboardDelegate {
        fun setPrimaryClip(label: CharSequence, text: CharSequence)
        fun hasPrimaryClip(): Boolean
        fun clearPrimaryClip()
    }

    fun interface ClearScheduler {
        fun schedule(delayMs: Long, block: () -> Unit)
    }

    @VisibleForTesting
    internal var delegateFactory: (Context) -> ClipboardDelegate = { context ->
        SystemClipboardDelegate(context)
    }

    @VisibleForTesting
    internal var schedulerFactory: () -> ClearScheduler = {
        HandlerClearScheduler()
    }

    @JvmStatic
    fun copySensitive(
        context: Context,
        label: String,
        value: CharArray,
        ttlMs: Long = SensitiveActionPreferences.DEFAULT_CLIPBOARD_TTL_MS,
        delegate: ClipboardDelegate = delegateFactory(context),
        scheduler: ClearScheduler = schedulerFactory()
    ) {
        val sanitizedLabel = ClipboardSanitizer.sanitizeLabel(label)
        val sanitizedChars = ClipboardSanitizer.sanitize(value)
        val clipValue = sanitizedChars.concatToString()
        try {
            delegate.setPrimaryClip(sanitizedLabel, clipValue)
            if (ttlMs > 0) {
                scheduler.schedule(ttlMs) {
                    if (delegate.hasPrimaryClip()) {
                        delegate.clearPrimaryClip()
                    }
                }
            }
        } finally {
            SecretUtils.wipe(value)
            SecretUtils.wipe(sanitizedChars)
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

    private class SystemClipboardDelegate(context: Context) : ClipboardDelegate {
        private val clipboardManager = context.getSystemService(
            android.content.ClipboardManager::class.java
        )

        override fun setPrimaryClip(label: CharSequence, text: CharSequence) {
            clipboardManager?.setPrimaryClip(android.content.ClipData.newPlainText(label, text))
        }

        override fun hasPrimaryClip(): Boolean = clipboardManager?.hasPrimaryClip() == true

        override fun clearPrimaryClip() {
            clipboardManager?.setPrimaryClip(android.content.ClipData.newPlainText("", ""))
        }
    }

    private class HandlerClearScheduler : ClearScheduler {
        private val handler: Handler? = Looper.getMainLooper()?.let { Handler(it) }

        override fun schedule(delayMs: Long, block: () -> Unit) {
            handler?.postDelayed(block, delayMs)
        }
    }
}
