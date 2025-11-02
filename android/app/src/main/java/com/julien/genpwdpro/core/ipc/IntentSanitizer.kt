package com.julien.genpwdpro.core.ipc

import android.content.Intent
import android.os.Bundle

/**
 * Central helpers to make sure we never leak sensitive extras across process boundaries.
 *
 * The intent sanitization strategy is deliberately conservative: unless a caller explicitly
 * allows a key, any suspicious extra (matching known sensitive hints) will be redacted or
 * stripped before the intent leaves our process. This protects widgets, notifications,
 * broadcasts and cross-process launches from accidentally carrying plaintext secrets.
 */
object IntentSanitizer {

    private val sensitiveKeyHints = listOf(
        "password",
        "secret",
        "token",
        "otp",
        "pin",
        "credential",
        "passcode",
        "seed"
    )

    fun redact(value: String?): String = "‹redacted›"

    fun putRedacted(intent: Intent, key: String, value: String?) {
        intent.putExtra(key, redact(value))
    }

    /**
     * Remove every extra except the keys explicitly allowed.
     */
    fun stripAllExcept(intent: Intent, allowedKeys: Set<String> = emptySet()) {
        val extras = intent.extras ?: return
        val keys = extras.keySet().toList()
        keys.forEach { key ->
            if (!allowedKeys.contains(key)) {
                intent.removeExtra(key)
            }
        }
    }

    /**
     * Redact suspicious extras in-place. Allowed keys keep their value, everything matching
     * a sensitive hint is redacted (Strings/CharSequences) or wiped (byte arrays) and the rest
     * is stripped.
     */
    fun sanitize(intent: Intent, allowedKeys: Set<String> = emptySet()) {
        val extras = intent.extras ?: return
        sanitize(extras, intent, allowedKeys)
    }

    /**
     * Ensure the provided bundle does not keep sensitive information. Primarily used when
     * we receive intents from untrusted sources.
     */
    fun sanitize(bundle: Bundle, intent: Intent? = null, allowedKeys: Set<String> = emptySet()) {
        val keys = bundle.keySet().toList()
        keys.forEach { key ->
            if (allowedKeys.contains(key)) {
                return@forEach
            }

            val lower = key.lowercase()
            if (sensitiveKeyHints.any { hint -> lower.contains(hint) }) {
                when (val value = bundle.get(key)) {
                    is String? -> {
                        if (intent != null) {
                            putRedacted(intent, key, value)
                        } else {
                            bundle.putString(key, redact(value))
                        }
                    }
                    is CharSequence? -> {
                        val redacted = redact(value?.toString())
                        if (intent != null) {
                            intent.putExtra(key, redacted)
                        } else {
                            bundle.putCharSequence(key, redacted)
                        }
                    }
                    is ByteArray -> {
                        value.fill(0)
                        if (intent != null) {
                            intent.putExtra(key, ByteArray(value.size))
                        } else {
                            bundle.putByteArray(key, ByteArray(value.size))
                        }
                    }
                    else -> {
                        if (intent != null) {
                            intent.removeExtra(key)
                        } else {
                            bundle.remove(key)
                        }
                    }
                }
            } else if (intent != null) {
                // For intents we also want to avoid leaking unknown structured data.
                intent.removeExtra(key)
            }
        }
    }
}
