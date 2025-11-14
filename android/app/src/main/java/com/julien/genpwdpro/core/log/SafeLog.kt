package com.julien.genpwdpro.core.log

import android.util.Log
import com.julien.genpwdpro.BuildConfig

/**
 * Centralized logging helper that avoids leaking sensitive data.
 *
 * SECURITY GUIDELINES:
 * - Use d() and i() for non-sensitive debug info (only logged in DEBUG builds)
 * - Use w() and e() for errors (always logged, even in production)
 * - NEVER use sensitive() for logging sensitive data like tokens, passwords, etc.
 * - Use redact() to sanitize sensitive values before logging
 */
object SafeLog {
    private const val DEFAULT_TAG = "GenPwdPro"
    private const val REDACTED = "❰redacted❱"

    private fun resolveTag(tag: String?): String = tag?.takeIf { it.isNotBlank() } ?: DEFAULT_TAG

    /**
     * Debug log (only in DEBUG builds).
     * SECURITY: Accessible via logcat by apps with READ_LOGS permission.
     */
    fun d(tag: String? = null, message: String) {
        if (BuildConfig.DEBUG) {
            Log.d(resolveTag(tag), message)
        }
    }

    /**
     * Info log (only in DEBUG builds).
     * SECURITY: Accessible via logcat by apps with READ_LOGS permission.
     */
    fun i(tag: String? = null, message: String) {
        if (BuildConfig.DEBUG) {
            Log.i(resolveTag(tag), message)
        }
    }

    /**
     * Warning log (always logged, even in production).
     */
    fun w(tag: String? = null, message: String, throwable: Throwable? = null) {
        if (throwable != null) {
            Log.w(resolveTag(tag), message, throwable)
        } else {
            Log.w(resolveTag(tag), message)
        }
    }

    /**
     * Error log (always logged, even in production).
     */
    fun e(tag: String? = null, message: String, throwable: Throwable? = null) {
        if (throwable != null) {
            Log.e(resolveTag(tag), message, throwable)
        } else {
            Log.e(resolveTag(tag), message)
        }
    }

    /**
     * SECURITY: Never logs anything, even in DEBUG builds.
     * Use this for operations involving sensitive data (tokens, passwords, etc.).
     *
     * This function exists to make it explicit that sensitive operations
     * should NOT be logged, preventing accidental logging of credentials.
     *
     * @param tag Optional tag for documentation purposes (not actually logged)
     * @param message Message for documentation purposes (not actually logged)
     */
    fun sensitive(tag: String? = null, message: String) {
        // SECURITY: Never log sensitive operations, even in DEBUG
        // This function intentionally does nothing
    }

    /**
     * Redact a sensitive value for logging.
     * Returns a placeholder string instead of the actual value.
     */
    fun redact(value: Any?): String = REDACTED

    /**
     * Redact multiple sensitive values for logging.
     * Returns a list of placeholder strings.
     */
    fun redact(values: Iterable<*>): String = values.joinToString(prefix = "[", postfix = "]") { REDACTED }
}
