package com.julien.genpwdpro.vault.domain

import java.time.Instant

/**
 * Represents an entry in the password vault.
 */
data class VaultEntry(
    val id: String,
    val title: String,
    val username: String? = null,
    val password: String? = null,
    val url: String? = null,
    val notes: String? = null,
    val groupId: String? = null,
    val otp: OtpConfig? = null,
    val updatedAt: Instant = Instant.now()
)

/**
 * Represents a logical grouping of vault entries.
 */
data class VaultGroup(
    val id: String,
    val name: String,
    val parentGroupId: String? = null
)

/**
 * Configuration for one-time password (OTP) generation.
 */
data class OtpConfig(
    val secret: String,
    val digits: Int = 6,
    val periodSeconds: Long = 30,
    val algorithm: OtpAlgorithm = OtpAlgorithm.TOTP
) {
    enum class OtpAlgorithm { TOTP, HOTP }
}

/**
 * Parameters used to derive encryption keys from user supplied secrets.
 */
data class KdfParams(
    val algorithm: String,
    val salt: String,
    val iterations: Int,
    val memoryCostKb: Int? = null
)
