package com.julien.genpwdpro.core.crypto

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SecretUtilsTest {

    @Test
    fun `timingSafeEquals returns true for identical byte arrays`() {
        val first = byteArrayOf(1, 2, 3, 4)
        val second = byteArrayOf(1, 2, 3, 4)

        assertTrue(SecretUtils.timingSafeEquals(first, second))
    }

    @Test
    fun `timingSafeEquals handles different lengths without leaking`() {
        val short = byteArrayOf(1, 2, 3)
        val long = byteArrayOf(1, 2, 3, 4, 5)

        assertFalse(SecretUtils.timingSafeEquals(short, long))
        assertFalse(SecretUtils.timingSafeEquals(long, short))
    }

    @Test
    fun `wipe clears char arrays`() {
        val chars = charArrayOf('s', 'e', 'c', 'r', 'e', 't')

        SecretUtils.wipe(chars)

        assertArrayEquals(CharArray(chars.size) { '\u0000' }, chars)
    }

    @Test
    fun `wipe clears byte arrays`() {
        val bytes = byteArrayOf(9, 8, 7, 6)

        SecretUtils.wipe(bytes)

        assertArrayEquals(ByteArray(bytes.size), bytes)
    }
}
