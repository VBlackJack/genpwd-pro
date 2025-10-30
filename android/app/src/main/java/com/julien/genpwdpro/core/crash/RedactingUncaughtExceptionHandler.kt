package com.julien.genpwdpro.core.crash

import java.lang.reflect.Field

/**
 * Wraps the default [Thread.UncaughtExceptionHandler] and redacts sensitive
 * information from exception messages before delegating.
 */
class RedactingUncaughtExceptionHandler(
    private val delegate: Thread.UncaughtExceptionHandler?
) : Thread.UncaughtExceptionHandler {

    override fun uncaughtException(thread: Thread, throwable: Throwable) {
        val sanitised = sanitizeThrowable(throwable, mutableSetOf())
        delegate?.uncaughtException(thread, sanitised) ?: run {
            System.err.println(
                "Unhandled exception in thread '${thread.name}': ${sanitised::class.java.simpleName}"
            )
            sanitised.printStackTrace()
        }
    }

    private fun sanitizeThrowable(
        throwable: Throwable,
        visited: MutableSet<Throwable>
    ): Throwable {
        if (!visited.add(throwable)) {
            return throwable
        }
        throwable.message?.let { original ->
            val sanitized = sanitizeMessage(original)
            if (sanitized != original) {
                updateDetailMessage(throwable, sanitized)
            }
        }
        throwable.cause?.let { sanitizeThrowable(it, visited) }
        throwable.suppressed.forEach { sanitizeThrowable(it, visited) }
        return throwable
    }

    private fun sanitizeMessage(message: String): String {
        val trimmed = message.trim()
        if (trimmed.isEmpty()) {
            return message
        }
        val sanitized = SECRET_PATTERN.replace(trimmed) { MATCH_REPLACEMENT }
        return sanitized.ifEmpty { MATCH_REPLACEMENT }
    }

    private fun updateDetailMessage(target: Throwable, message: String) {
        runCatching {
            DETAIL_MESSAGE_FIELD?.let { field ->
                field.isAccessible = true
                field.set(target, message)
            }
        }
    }

    companion object {
        private const val MATCH_REPLACEMENT = "***"
        private val SECRET_PATTERN = Regex("""([A-Za-z0-9+/=_-]{12,}|[0-9]{6,}|[A-Fa-f0-9]{8,})""")
        private val DETAIL_MESSAGE_FIELD: Field? = runCatching {
            Throwable::class.java.getDeclaredField("detailMessage")
        }.getOrNull()
    }
}
