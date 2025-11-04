package com.julien.genpwdpro.core.crypto

import java.util.Arrays

/**
 * Helpers for handling sensitive buffers and comparisons without leaking information.
 */
object SecretUtils {
    fun wipe(buf: CharArray) {
        Arrays.fill(buf, '\u0000')
    }

    fun wipe(buf: ByteArray) {
        Arrays.fill(buf, 0)
    }

    fun timingSafeEquals(a: ByteArray?, b: ByteArray?): Boolean {
        if (a == null || b == null) return false

        var diff = a.size xor b.size
        val maxLength = maxOf(a.size, b.size)
        for (i in 0 until maxLength) {
            val left = if (i < a.size) a[i].toInt() else 0
            val right = if (i < b.size) b[i].toInt() else 0
            diff = diff or (left xor right)
        }
        return diff == 0
    }
}
