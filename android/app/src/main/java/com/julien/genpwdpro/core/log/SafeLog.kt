package com.julien.genpwdpro.core.log

import android.util.Log

/**
 * Centralized logging helper that avoids leaking sensitive data.
 */
object SafeLog {
    private const val DEFAULT_TAG = "GenPwdPro"
    private const val REDACTED = "❰redacted❱"

    private fun resolveTag(tag: String?): String = tag?.takeIf { it.isNotBlank() } ?: DEFAULT_TAG

    fun d(tag: String? = null, message: String) {
        Log.d(resolveTag(tag), message)
    }

    fun i(tag: String? = null, message: String) {
        Log.i(resolveTag(tag), message)
    }

    fun w(tag: String? = null, message: String, throwable: Throwable? = null) {
        if (throwable != null) {
            Log.w(resolveTag(tag), message, throwable)
        } else {
            Log.w(resolveTag(tag), message)
        }
    }

    fun e(tag: String? = null, message: String, throwable: Throwable? = null) {
        if (throwable != null) {
            Log.e(resolveTag(tag), message, throwable)
        } else {
            Log.e(resolveTag(tag), message)
        }
    }

    fun redact(value: Any?): String = REDACTED
}
