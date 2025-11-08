package com.julien.genpwdpro.domain.otp

import android.net.Uri
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.test.assertFailsWith

class OtpUriParserTest {

    private val parser = OtpUriParser()

    @Test
    fun `parse TOTP uri with issuer and defaults`() {
        val uri = Uri.parse(
            "otpauth://totp/GenPwd:account@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GenPwd"
        )

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

        assertFailsWith<OtpUriParserException> {
            parser.parse(uri)
        }
    }

    @Test
    fun `parse rejects invalid algorithm`() {
        val uri = Uri.parse("otpauth://totp/Label?secret=JBSWY3DPEHPK3PXP&algorithm=MD5")

        assertFailsWith<OtpUriParserException> {
            parser.parse(uri)
        }
    }

    @Test
    fun `parse rejects unsupported digit length`() {
        val uri = Uri.parse("otpauth://totp/Label?secret=JBSWY3DPEHPK3PXP&digits=7")

        assertFailsWith<OtpUriParserException> {
            parser.parse(uri)
        }
    }

    @Test
    fun `parse trims secret and validates base32`() {
        val uri = Uri.parse(
            "otpauth://totp/Label?secret= jbsw y3dp ehpk 3pxp &digits=8&algorithm=SHA512"
        )

        val result = parser.parse(uri)

        assertEquals("JBSWY3DPEHPK3PXP", result.secret)
        assertEquals(8, result.digits)
        assertEquals(OtpAlgorithm.SHA512, result.algorithm)
    }

    @Test
    fun `parse rejects migration payload`() {
        val uri = Uri.parse("otpauth-migration://offline?data=AbCd")

        val exception = assertFailsWith<OtpUriMigrationNotSupportedException> {
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

        assertFailsWith<OtpUriParserException> {
            parser.parse(uri)
        }
    }

    @Test
    fun `parse fuzzed invalid uris reject without leaking sensitive data`() {
        val baseSecret = "JBSWY3DPEHPK3PXP"
        val maxUriLabel = "Issuer:" + "L".repeat(4000)
        val veryLongSecret = "A".repeat(1024)
        buildInvalidOtpCases(baseSecret, maxUriLabel, veryLongSecret).forEach { case ->
            val exception = assertFailsWith<OtpUriParserException>(case.description) {
                parser.parse(Uri.parse(case.uri))
            }

            val message = exception.message.orEmpty()
            assertTrue(
                "Exception message should not be blank for ${case.description}",
                message.isNotBlank()
            )
            case.sensitiveSnippets.forEach { snippet ->
                assertTrue(
                    "Exception message leaked sensitive data for ${case.description} -> $message",
                    !message.contains(snippet, ignoreCase = true)
                )
            }
        }
    }
}

private data class InvalidCase(
    val description: String,
    val uri: String,
    val sensitiveSnippets: List<String>
)

private fun buildInvalidOtpCases(
    baseSecret: String,
    maxUriLabel: String,
    veryLongSecret: String
): List<InvalidCase> {
    val invalidSecrets = listOf(
        "1234567890", // numerals are invalid for Base32
        "JBSWY3DPEHPK3PXP=", // padding anomaly
        "JBSW=Y3DP=EHPK3PXP==",
        "JBSWY3DPEHPK3PXP!"
    )
    val invalidAlgorithms = listOf("SHA1024", "BLAKE2", "MD5", "SHA-1")
    val invalidDigits = listOf("0", "1", "5", "9", "abc", "999")
    val invalidPeriods = listOf("0", "-30", "86401", "999999")
    val invalidCounters = listOf(null, "-1", "abc", "999999999999999999999")

    val invalidCases = mutableListOf(
        InvalidCase(
            description = "URI longer than limit due to label",
            uri = "otpauth://totp/$maxUriLabel?secret=$baseSecret",
            sensitiveSnippets = listOf(maxUriLabel.takeLast(32))
        ),
        InvalidCase(
            description = "Secret exceeds maximum length",
            uri = "otpauth://totp/Label?secret=$veryLongSecret",
            sensitiveSnippets = listOf(veryLongSecret.takeLast(32))
        )
    )

    invalidSecrets.forEach { secret ->
        invalidCases += InvalidCase(
            description = "Invalid Base32 secret $secret",
            uri = "otpauth://totp/Label?secret=$secret",
            sensitiveSnippets = listOf(secret.take(16))
        )
    }
    invalidAlgorithms.forEach { algorithm ->
        invalidCases += InvalidCase(
            description = "Unsupported algorithm $algorithm",
            uri = "otpauth://totp/Label?secret=$baseSecret&algorithm=$algorithm",
            sensitiveSnippets = listOf(algorithm)
        )
    }
    invalidDigits.forEach { digits ->
        invalidCases += InvalidCase(
            description = "Invalid digits $digits",
            uri = "otpauth://totp/Label?secret=$baseSecret&digits=$digits",
            sensitiveSnippets = listOf(digits)
        )
    }
    invalidPeriods.forEach { period ->
        invalidCases += InvalidCase(
            description = "Invalid period $period",
            uri = "otpauth://totp/Label?secret=$baseSecret&period=$period",
            sensitiveSnippets = listOf(period.take(8))
        )
    }
    invalidCounters.forEach { counter ->
        val counterParam = counter?.let { "&counter=$it" } ?: ""
        invalidCases += InvalidCase(
            description = "Invalid HOTP counter $counter",
            uri = "otpauth://hotp/Label?secret=$baseSecret$counterParam",
            sensitiveSnippets = listOfNotNull(counter?.take(16))
        )
    }
    return invalidCases
}
