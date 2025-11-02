package com.julien.genpwdpro.data.models

import com.julien.genpwdpro.data.models.vault.VaultFileHeader
import org.junit.Assert.*
import org.junit.Test

/**
 * Security tests for VaultFileHeader
 *
 * These tests verify proper version handling and salt requirements
 * for vault file security.
 */
class VaultFileHeaderTest {

    @Test
    fun `current version is 2`() {
        assertEquals("Current version should be 2", 2, VaultFileHeader.CURRENT_VERSION)
    }

    @Test
    fun `version 1 header without salt is valid for backward compatibility`() {
        // Arrange - Legacy vault from version 1 (no kdfSalt)
        val legacyHeader = VaultFileHeader(
            version = 1,
            vaultId = "legacy-vault",
            createdAt = System.currentTimeMillis(),
            modifiedAt = System.currentTimeMillis(),
            checksum = "abc123",
            kdfSalt = null // Version 1 didn't have random salt
        )

        // Assert
        assertTrue("Legacy header should be valid", legacyHeader.isValid())
        assertFalse("Legacy header should not have kdfSalt", legacyHeader.hasKdfSalt())
    }

    @Test
    fun `version 2 header with salt is valid`() {
        // Arrange - Modern vault with random kdfSalt
        val modernHeader = VaultFileHeader(
            version = 2,
            vaultId = "modern-vault",
            createdAt = System.currentTimeMillis(),
            modifiedAt = System.currentTimeMillis(),
            checksum = "abc123",
            kdfSalt = "0123456789abcdef0123456789abcdef" // 32 hex chars = 16 bytes
        )

        // Assert
        assertTrue("Modern header should be valid", modernHeader.isValid())
        assertTrue("Modern header should have kdfSalt", modernHeader.hasKdfSalt())
    }

    @Test
    fun `header with future version is invalid`() {
        // Arrange - Vault from future version
        val futureHeader = VaultFileHeader(
            version = 999,
            vaultId = "future-vault",
            createdAt = System.currentTimeMillis(),
            modifiedAt = System.currentTimeMillis(),
            checksum = "abc123",
            kdfSalt = "abc123"
        )

        // Assert
        assertFalse("Future version header should be invalid", futureHeader.isValid())
    }

    @Test
    fun `header with wrong magic number is invalid`() {
        // Arrange
        val invalidHeader = VaultFileHeader(
            magicNumber = "INVALID",
            version = 2,
            vaultId = "test-vault",
            createdAt = System.currentTimeMillis(),
            modifiedAt = System.currentTimeMillis(),
            checksum = "abc123"
        )

        // Assert
        assertFalse("Header with wrong magic number should be invalid", invalidHeader.isValid())
    }

    @Test
    fun `hasKdfSalt returns false for empty salt`() {
        // Arrange
        val header = VaultFileHeader(
            vaultId = "test-vault",
            createdAt = System.currentTimeMillis(),
            modifiedAt = System.currentTimeMillis(),
            checksum = "abc123",
            kdfSalt = ""
        )

        // Assert
        assertFalse("Empty salt should return false", header.hasKdfSalt())
    }

    @Test
    fun `hasKdfSalt returns false for blank salt`() {
        // Arrange
        val header = VaultFileHeader(
            vaultId = "test-vault",
            createdAt = System.currentTimeMillis(),
            modifiedAt = System.currentTimeMillis(),
            checksum = "abc123",
            kdfSalt = "   "
        )

        // Assert
        assertFalse("Blank salt should return false", header.hasKdfSalt())
    }

    @Test
    fun `default kdfAlgorithm is argon2id`() {
        // Arrange
        val header = VaultFileHeader(
            vaultId = "test-vault",
            createdAt = System.currentTimeMillis(),
            modifiedAt = System.currentTimeMillis(),
            checksum = "abc123"
        )

        // Assert
        assertEquals("Default KDF should be argon2id", "argon2id", header.kdfAlgorithm)
        assertEquals("Constant should match default", VaultFileHeader.DEFAULT_KDF, header.kdfAlgorithm)
    }

    @Test
    fun `requiresKeyFile returns true when keyFileHash is set`() {
        // Arrange
        val header = VaultFileHeader(
            vaultId = "test-vault",
            createdAt = System.currentTimeMillis(),
            modifiedAt = System.currentTimeMillis(),
            checksum = "abc123",
            keyFileHash = "sha256hash"
        )

        // Assert
        assertTrue("Should require key file when hash is set", header.requiresKeyFile())
    }

    @Test
    fun `requiresKeyFile returns false when keyFileHash is null`() {
        // Arrange
        val header = VaultFileHeader(
            vaultId = "test-vault",
            createdAt = System.currentTimeMillis(),
            modifiedAt = System.currentTimeMillis(),
            checksum = "abc123",
            keyFileHash = null
        )

        // Assert
        assertFalse("Should not require key file when hash is null", header.requiresKeyFile())
    }

    @Test
    fun `version 1 and version 2 with same data have compatible validation`() {
        // Arrange
        val v1Header = VaultFileHeader(
            version = 1,
            vaultId = "test-vault",
            createdAt = 1000L,
            modifiedAt = 2000L,
            checksum = "abc123",
            kdfSalt = null
        )

        val v2Header = v1Header.copy(
            version = 2,
            kdfSalt = "0123456789abcdef0123456789abcdef"
        )

        // Assert
        assertTrue("V1 header should be valid", v1Header.isValid())
        assertTrue("V2 header should be valid", v2Header.isValid())
        assertFalse("V1 should not have salt", v1Header.hasKdfSalt())
        assertTrue("V2 should have salt", v2Header.hasKdfSalt())
    }
}
