package com.julien.genpwdpro.domain.otp

import android.net.Uri
import java.net.URLDecoder
import java.nio.charset.StandardCharsets
import java.util.Locale
import org.apache.commons.codec.binary.Base32

class OtpUriParser {

    private val base32 = Base32()

    fun parse(uri: Uri): OtpConfig {
        val normalizedLength = uri.toString().length
        if (normalizedLength > MAX_URI_LENGTH) {
            throw OtpUriParserException("OTP URI too long")
        }

        val scheme = uri.scheme?.lowercase(Locale.US)
            ?: throw OtpUriParserException("Missing URI scheme")
        if (scheme == MIGRATION_SCHEME) {
            throw OtpUriMigrationNotSupportedException()
        }
        if (scheme != OTP_SCHEME) {
            throw OtpUriParserException("Unsupported scheme")
        }

        val authority = uri.authority?.lowercase(Locale.US)
            ?: throw OtpUriParserException("Missing OTP type")
        val type = when (authority) {
            "totp" -> OtpType.TOTP
            "hotp" -> OtpType.HOTP
            else -> throw OtpUriParserException("Unsupported OTP type")
        }

        val labelData = uri.path.orEmpty().removePrefix("/")
        val decodedLabel = if (labelData.isNotBlank()) {
            URLDecoder.decode(labelData, StandardCharsets.UTF_8.name())
        } else {
            ""
        }
        val (issuerFromLabel, accountLabel) = parseLabel(decodedLabel)

        val queryParams = uri.queryParameterNames.associateWith { key ->
            uri.getQueryParameter(key)?.trim()
        }

        val secret = sanitizeSecret(queryParams["secret"]) ?: throw OtpUriParserException("Missing secret parameter")
        validateSecret(secret)

        val algorithmParam = queryParams["algorithm"]?.uppercase(Locale.US)
        val algorithm = if (algorithmParam.isNullOrBlank()) {
            OtpAlgorithm.SHA1
        } else {
            OtpAlgorithm.from(algorithmParam)
        }

        val digits = parseDigits(queryParams["digits"])
        val period = parsePeriod(queryParams["period"], type)
        val counter = parseCounter(queryParams["counter"], type)

        val issuerFromParam = queryParams["issuer"]
        val issuer = (issuerFromParam ?: issuerFromLabel)?.takeIf { it.isNotBlank() }?.trim()
        val label = accountLabel?.takeIf { it.isNotBlank() }?.trim()

        return OtpConfig(
            type = type,
            issuer = issuer,
            label = label,
            secret = secret,
            algorithm = algorithm,
            digits = digits,
            period = period,
            counter = counter
        )
    }

    private fun parseDigits(rawDigits: String?): Int {
        if (rawDigits.isNullOrBlank()) {
            return DEFAULT_DIGITS
        }
        val parsed = rawDigits.toIntOrNull() ?: throw OtpUriParserException("Invalid digits parameter")
        if (parsed !in ALLOWED_DIGITS) {
            throw OtpUriParserException("Unsupported digits parameter")
        }
        return parsed
    }

    private fun parsePeriod(rawPeriod: String?, type: OtpType): Int {
        if (type == OtpType.HOTP) {
            return DEFAULT_PERIOD
        }
        if (rawPeriod.isNullOrBlank()) {
            return DEFAULT_PERIOD
        }
        val parsed = rawPeriod.toIntOrNull() ?: throw OtpUriParserException("Invalid period parameter")
        if (parsed !in 1..MAX_PERIOD_SECONDS) {
            throw OtpUriParserException("Unsupported period parameter")
        }
        return parsed
    }

    private fun parseCounter(rawCounter: String?, type: OtpType): Long? {
        if (type != OtpType.HOTP) {
            return null
        }
        val parsed = rawCounter?.toLongOrNull()
            ?: throw OtpUriParserException("Missing HOTP counter")
        if (parsed < 0) {
            throw OtpUriParserException("Invalid HOTP counter")
        }
        return parsed
    }

    private fun sanitizeSecret(raw: String?): String? {
        if (raw.isNullOrBlank()) {
            return null
        }
        val normalized = raw.replace(WHITESPACE_REGEX, "").replace("-", "").uppercase(Locale.US)
        return normalized.takeIf { it.isNotBlank() }
    }

    private fun validateSecret(secret: String) {
        if (secret.length > MAX_SECRET_LENGTH) {
            throw OtpUriParserException("Secret length unsupported")
        }
        if (!SECRET_REGEX.matches(secret)) {
            throw OtpUriParserException("Secret contains invalid characters")
        }
        val decoded = try {
            base32.decode(secret)
        } catch (error: IllegalArgumentException) {
            throw OtpUriParserException("Secret is not valid Base32")
        }
        if (decoded.isEmpty()) {
            throw OtpUriParserException("Secret could not be decoded")
        }
    }

    private fun parseLabel(label: String): Pair<String?, String?> {
        if (label.isBlank()) {
            return null to null
        }
        val parts = label.split(":", limit = 2)
        return if (parts.size == 2) {
            val issuer = parts[0].takeIf { it.isNotBlank() }
            val account = parts[1].takeIf { it.isNotBlank() }
            issuer to account
        } else {
            null to parts[0].takeIf { it.isNotBlank() }
        }
    }

    companion object {
        private const val OTP_SCHEME = "otpauth"
        private const val MIGRATION_SCHEME = "otpauth-migration"
        private const val DEFAULT_PERIOD = 30
        private const val DEFAULT_DIGITS = 6
        private const val MAX_PERIOD_SECONDS = 86400
        private const val MAX_URI_LENGTH = 4096
        private const val MAX_SECRET_LENGTH = 512
        private val ALLOWED_DIGITS = setOf(6, 8)
        private val SECRET_REGEX = Regex("^[2-7A-Z]+=*")
        private val WHITESPACE_REGEX = Regex("\\s+")
    }
}
