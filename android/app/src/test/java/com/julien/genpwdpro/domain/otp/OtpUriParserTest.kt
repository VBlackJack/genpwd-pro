package com.julien.genpwdpro.domain.otp

import android.net.Uri
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class OtpUriParserTest {

    private val parser = OtpUriParser()

    @Test
    fun `parse TOTP uri with issuer and defaults`() {
        val uri = Uri.parse("otpauth://totp/GenPwd:account@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GenPwd")

        val result = parser.parse(uri)

        assertEquals(OtpType.TOTP, result.type)
        assertEquals("GenPwd", result.issuer)
        assertEquals("account@example.com", result.label)
        assertEquals(OtpAlgorithm.SHA1, result.algorithm)
        assertEquals(6, result.digits)
        assertEquals(30, result.period)
        assertEquals(null, result.counter)
        assertEquals("JBSWY3DPEHPK3PXP", result.secret)
    }

    @Test
    fun `parse HOTP uri requires counter`() {
        val uri = Uri.parse("otpauth://hotp/Label?secret=JBSWY3DPEHPK3PXP")

        assertThrows(OtpUriParserException::class.java) {
            parser.parse(uri)
        }
    }

    @Test
    fun `parse rejects invalid algorithm`() {
        val uri = Uri.parse("otpauth://totp/Label?secret=JBSWY3DPEHPK3PXP&algorithm=MD5")

        assertThrows(OtpUriParserException::class.java) {
            parser.parse(uri)
        }
    }

    @Test
    fun `parse rejects unsupported digit length`() {
        val uri = Uri.parse("otpauth://totp/Label?secret=JBSWY3DPEHPK3PXP&digits=7")

        assertThrows(OtpUriParserException::class.java) {
            parser.parse(uri)
        }
    }

    @Test
    fun `parse trims secret and validates base32`() {
        val uri = Uri.parse("otpauth://totp/Label?secret= jbsw y3dp ehpk 3pxp &digits=8&algorithm=SHA512")

        val result = parser.parse(uri)

        assertEquals("JBSWY3DPEHPK3PXP", result.secret)
        assertEquals(8, result.digits)
        assertEquals(OtpAlgorithm.SHA512, result.algorithm)
    }

    @Test
    fun `parse rejects migration payload`() {
        val uri = Uri.parse("otpauth-migration://offline?data=AbCd")

        val exception = assertThrows(OtpUriMigrationNotSupportedException::class.java) {
            parser.parse(uri)
        }
        assertTrue(exception.message!!.contains("not supported"))
    }

    @Test
    fun `parse rejects overly long secrets`() {
        val longSecret = buildString {
            repeat(600) { append('A') }
        }
        val uri = Uri.parse("otpauth://totp/Label?secret=$longSecret")

        assertThrows(OtpUriParserException::class.java) {
            parser.parse(uri)
        }
    }
}
