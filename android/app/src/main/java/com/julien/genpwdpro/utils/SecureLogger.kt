package com.julien.genpwdpro.utils

import android.util.Log
import com.julien.genpwdpro.BuildConfig

/**
 * Secure logging wrapper that respects build configuration
 *
 * SECURITY: Prevents sensitive information leakage in production builds
 *
 * Features:
 * - Only logs in DEBUG builds
 * - Provides different levels: debug, info, warning, error
 * - Sensitive data method that NEVER logs (even in debug)
 * - Optional Crashlytics integration for production error tracking
 *
 * Usage:
 * ```kotlin
 * SecureLogger.d(TAG, "Debug message")  // Logs only in DEBUG
 * SecureLogger.e(TAG, "Error occurred", exception)  // Logs in DEBUG, reports exception in RELEASE
 * SecureLogger.sensitive(TAG, "Password: $password")  // NEVER logs
 * ```
 */
object SecureLogger {

    /**
     * Check if logging is enabled (DEBUG builds only)
     */
    private fun isLoggingEnabled(): Boolean = BuildConfig.DEBUG

    /**
     * Debug log - only in DEBUG builds
     *
     * @param tag Log tag
     * @param message Message to log
     */
    fun d(tag: String, message: String) {
        if (isLoggingEnabled()) {
            Log.d(tag, message)
        }
    }

    /**
     * Info log - only in DEBUG builds
     *
     * @param tag Log tag
     * @param message Message to log
     */
    fun i(tag: String, message: String) {
        if (isLoggingEnabled()) {
            Log.i(tag, message)
        }
    }

    /**
     * Warning log - only in DEBUG builds
     *
     * @param tag Log tag
     * @param message Message to log
     */
    fun w(tag: String, message: String) {
        if (isLoggingEnabled()) {
            Log.w(tag, message)
        }
    }

    /**
     * Warning log with exception - only in DEBUG builds
     *
     * @param tag Log tag
     * @param message Message to log
     * @param throwable Exception to log
     */
    fun w(tag: String, message: String, throwable: Throwable) {
        if (isLoggingEnabled()) {
            Log.w(tag, message, throwable)
        }
    }

    /**
     * Error log
     * - Logs full details in DEBUG builds
     * - Only reports exception class in RELEASE builds (no details)
     *
     * @param tag Log tag
     * @param message Message to log
     * @param throwable Exception to log (optional)
     */
    fun e(tag: String, message: String, throwable: Throwable? = null) {
        if (isLoggingEnabled()) {
            // DEBUG: Log everything
            if (throwable != null) {
                Log.e(tag, message, throwable)
            } else {
                Log.e(tag, message)
            }
        } else {
            // RELEASE: Only report exception to crash reporting (if configured)
            throwable?.let {
                reportExceptionToAnalytics(it)
            }
        }
    }

    /**
     * Sensitive data log - NEVER logs, even in debug
     *
     * Use this for passwords, tokens, keys, or any sensitive data
     *
     * @param tag Log tag (ignored)
     * @param message Sensitive message (NOT logged)
     */
    fun sensitive(tag: String, message: String) {
        // Intentionally empty - NEVER log sensitive data
    }

    /**
     * Verbose log - only in DEBUG builds
     *
     * @param tag Log tag
     * @param message Message to log
     */
    fun v(tag: String, message: String) {
        if (isLoggingEnabled()) {
            Log.v(tag, message)
        }
    }

    /**
     * What a Terrible Failure log - always logs (critical errors)
     *
     * Use sparingly for conditions that should never happen
     *
     * @param tag Log tag
     * @param message Message to log
     * @param throwable Exception to log (optional)
     */
    fun wtf(tag: String, message: String, throwable: Throwable? = null) {
        // WTF logs are always logged, even in release (critical bugs)
        if (throwable != null) {
            Log.wtf(tag, message, throwable)
        } else {
            Log.wtf(tag, message)
        }

        // Also report to analytics in release
        if (!isLoggingEnabled()) {
            throwable?.let { reportExceptionToAnalytics(it) }
        }
    }

    /**
     * Report exception to crash analytics (Crashlytics, Sentry, etc.)
     *
     * Currently a stub - integrate with your analytics solution
     *
     * @param throwable Exception to report
     */
    private fun reportExceptionToAnalytics(throwable: Throwable) {
        // TODO: Integrate with Firebase Crashlytics or similar
        // Example:
        // FirebaseCrashlytics.getInstance().recordException(throwable)

        // For now, silently ignore in release builds
    }

    /**
     * Log vault operation (sanitized)
     *
     * Logs vault ID in DEBUG, but hides sensitive details
     *
     * @param tag Log tag
     * @param operation Operation being performed
     * @param vaultId Vault ID (sanitized in RELEASE)
     */
    fun vaultOperation(tag: String, operation: String, vaultId: String) {
        if (isLoggingEnabled()) {
            d(tag, "$operation: vault $vaultId")
        } else {
            // In release, only log operation type (no vault ID)
            // This is still useful for debugging production issues
        }
    }

    /**
     * Log file operation (sanitized)
     *
     * Logs file path in DEBUG, but hides in RELEASE
     *
     * @param tag Log tag
     * @param operation Operation being performed
     * @param filePath File path (sanitized in RELEASE)
     */
    fun fileOperation(tag: String, operation: String, filePath: String) {
        if (isLoggingEnabled()) {
            d(tag, "$operation: $filePath")
        } else {
            // In release, don't log file paths (privacy concern)
        }
    }
}
