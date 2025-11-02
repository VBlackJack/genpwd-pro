package com.julien.genpwdpro.core.clipboard

/**
 * Sanitizes clipboard metadata and payloads before they are published.
 *
 * The sanitizer is deliberately conservative: it removes zero-width markers,
 * bidi overrides and non printable/control characters that can be abused to
 * obfuscate secrets or trick downstream consumers. Regular whitespace and
 * printable characters are preserved.
 */
object ClipboardSanitizer {
    private val zeroWidthCharacters = setOf(
        '\u200B', // ZERO WIDTH SPACE
        '\u200C', // ZERO WIDTH NON-JOINER
        '\u200D', // ZERO WIDTH JOINER
        '\u200E', // LEFT-TO-RIGHT MARK
        '\u200F', // RIGHT-TO-LEFT MARK
        '\u202A', // LEFT-TO-RIGHT EMBEDDING
        '\u202B', // RIGHT-TO-LEFT EMBEDDING
        '\u202C', // POP DIRECTIONAL FORMATTING
        '\u202D', // LEFT-TO-RIGHT OVERRIDE
        '\u202E', // RIGHT-TO-LEFT OVERRIDE
        '\u2060', // WORD JOINER
        '\u2061', '\u2062', '\u2063', '\u2064', // Function/application separators
        '\u2066', '\u2067', '\u2068', '\u2069', // Directional isolates
        '\u206A', '\u206B', '\u206C', '\u206D', '\u206E', '\u206F',
        '\uFEFF' // ZERO WIDTH NO-BREAK SPACE
    )

    private val preservedControlCharacters = setOf('\n', '\r', '\t')

    const val DEFAULT_LABEL: String = "sensitive"
    private const val MAX_LABEL_LENGTH = 64

    fun sanitizeLabel(label: CharSequence?): String {
        val trimmed = label?.toString()?.trim().orEmpty()
        if (trimmed.isEmpty()) {
            return DEFAULT_LABEL
        }
        val sanitized = buildString(trimmed.length) {
            trimmed.forEach { ch ->
                if (shouldKeep(ch, treatAsLabel = true)) {
                    append(ch)
                }
            }
        }
        val candidate = if (sanitized.isEmpty()) DEFAULT_LABEL else sanitized
        return candidate.take(MAX_LABEL_LENGTH)
    }

    fun sanitize(value: CharArray): CharArray {
        val sanitized = sanitizeToString(value.concatToString())
        return sanitized.toCharArray()
    }

    fun sanitize(value: String): String = sanitizeToString(value)

    private fun sanitizeToString(raw: String): String {
        if (raw.isEmpty()) return raw
        return buildString(raw.length) {
            raw.forEach { ch ->
                if (shouldKeep(ch, treatAsLabel = false)) {
                    append(ch)
                }
            }
        }
    }

    private fun shouldKeep(ch: Char, treatAsLabel: Boolean): Boolean {
        if (zeroWidthCharacters.contains(ch)) {
            return false
        }
        val type = Character.getType(ch)
        if (type == Character.PRIVATE_USE.toInt() ||
            type == Character.SURROGATE.toInt() ||
            type == Character.UNASSIGNED.toInt()
        ) {
            return false
        }
        if (type == Character.CONTROL.toInt() && !preservedControlCharacters.contains(ch)) {
            return false
        }
        if (treatAsLabel && ch == '\n') {
            return false
        }
        return true
    }
}
