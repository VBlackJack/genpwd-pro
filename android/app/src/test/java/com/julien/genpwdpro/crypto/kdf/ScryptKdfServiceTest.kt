package com.julien.genpwdpro.crypto.kdf

import java.nio.charset.StandardCharsets
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test

class ScryptKdfServiceTest {

    @Test
    fun `deriveKey should match RFC 7914 test vector`() {
        val service = ScryptKdfService(
            ScryptConfig(
                cost = 1024,
                blockSize = 8,
                parallelization = 16,
                keyLength = 64
            )
        )

        val password = "password".toCharArray()
        val salt = "NaCl".toByteArray(StandardCharsets.UTF_8)

        val derived = service.deriveKey(password, salt)
        val expected = (
            "fdbabe1c9d3472007856e7190d01e9fe" +
                "7c6ad7cbc8237830e77376634b373162" +
                "2eaf30d92e22a3886ff109279d9830da" +
                "c727afb94a83ee6d8360cbdfa2cc0640"
            ).hexToBytes()

        assertArrayEquals(expected, derived)
    }

    @Test
    fun `deriveKey should honor requested key length override`() {
        val service = ScryptKdfService(
            ScryptConfig(
                cost = 16,
                blockSize = 1,
                parallelization = 1,
                keyLength = 64
            )
        )

        val password = "pass".toCharArray()
        val salt = "salt".toByteArray(StandardCharsets.UTF_8)

        val derived = service.deriveKey(password, salt, keyLength = 32)
        assertEquals(32, derived.size)
    }

    @Test
    fun `factory should create scrypt service by default`() {
        val factory = KdfServiceFactory(
            KdfConfig(
                algorithm = KdfAlgorithm.SCRYPT,
                scrypt = ScryptConfig(cost = 16, blockSize = 1, parallelization = 1, keyLength = 32)
            )
        )

        val service = factory.create()
        assertEquals(KdfAlgorithm.SCRYPT, service.algorithm)
    }

    @Test(expected = UnsupportedOperationException::class)
    fun `factory should signal missing argon2 implementation`() {
        val factory = KdfServiceFactory(
            KdfConfig(
                algorithm = KdfAlgorithm.ARGON2ID,
                scrypt = ScryptConfig(cost = 16, blockSize = 1, parallelization = 1, keyLength = 32)
            )
        )

        factory.create()
    }

    private fun String.hexToBytes(): ByteArray {
        check(length % 2 == 0) { "Hex string must have even length" }
        return chunked(2)
            .map { it.toInt(16).toByte() }
            .toByteArray()
    }
}
