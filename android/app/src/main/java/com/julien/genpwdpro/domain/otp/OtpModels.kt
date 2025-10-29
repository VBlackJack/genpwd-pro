package com.julien.genpwdpro.domain.otp

import android.os.Parcelable
import kotlinx.parcelize.Parcelize

enum class OtpType {
    TOTP,
    HOTP
}

enum class OtpAlgorithm(val value: String) {
    SHA1("SHA1"),
    SHA256("SHA256"),
    SHA512("SHA512");

    companion object {
        fun from(value: String): OtpAlgorithm = entries.firstOrNull { it.value.equals(value, ignoreCase = true) }
            ?: throw OtpUriParserException("Unsupported algorithm")
    }
}

@Parcelize
data class OtpConfig(
    val type: OtpType,
    val issuer: String?,
    val label: String?,
    val secret: String,
    val algorithm: OtpAlgorithm,
    val digits: Int,
    val period: Int,
    val counter: Long?
) : Parcelable {
    override fun toString(): String {
        val maskedSecret = maskSecret(secret)
        val counterLabel = counter?.let { "counter=••" } ?: "counter=null"
        return "OtpConfig(type=$type, issuer=$issuer, label=$label, secret=$maskedSecret, algorithm=${algorithm.value}, digits=$digits, period=$period, $counterLabel)"
    }

    companion object {
        private fun maskSecret(secret: String): String {
            if (secret.isEmpty()) {
                return "••••"
            }
            val visible = secret.take(2)
            return "$visible••••"
        }
    }
}
