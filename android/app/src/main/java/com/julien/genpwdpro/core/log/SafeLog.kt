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
     * SECURITY NOTE: In RELEASE builds, only logs the exception type, not the full stack trace.
     */
    fun w(tag: String? = null, message: String, throwable: Throwable? = null) {
        if (throwable != null) {
            if (BuildConfig.DEBUG) {
                // In DEBUG: Full stack trace for debugging
                Log.w(resolveTag(tag), message, throwable)
            } else {
                // In RELEASE: Only exception type to avoid leaking sensitive data in stack traces
                Log.w(resolveTag(tag), "$message [${throwable.javaClass.simpleName}]")
            }
        } else {
            Log.w(resolveTag(tag), message)
        }
    }

    /**
     * Error log (always logged, even in production).
     * SECURITY NOTE: In RELEASE builds, only logs the exception type, not the full stack trace.
     */
    fun e(tag: String? = null, message: String, throwable: Throwable? = null) {
        if (throwable != null) {
            if (BuildConfig.DEBUG) {
                // In DEBUG: Full stack trace for debugging
                Log.e(resolveTag(tag), message, throwable)
            } else {
                // In RELEASE: Only exception type to avoid leaking sensitive data in stack traces
                Log.e(resolveTag(tag), "$message [${throwable.javaClass.simpleName}]")
            }
        } else {
            Log.e(resolveTag(tag), message)
        }
    }

    /**
     * Error log with full stack trace (even in production).
     * WARNING: Only use this when you're certain the stack trace contains no sensitive data.
     * For most cases, use e() which automatically sanitizes stack traces in production.
     */
    fun eWithStackTrace(tag: String? = null, message: String, throwable: Throwable) {
        Log.e(resolveTag(tag), message, throwable)
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
