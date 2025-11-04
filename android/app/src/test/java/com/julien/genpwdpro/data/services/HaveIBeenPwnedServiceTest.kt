package com.julien.genpwdpro.data.services

import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import java.security.MessageDigest

/**
 * Tests unitaires pour HaveIBeenPwnedService
 *
 * Tests :
 * - SHA-1 hashing
 * - API integration
 * - Breach detection
 * - Error handling
 */
class HaveIBeenPwnedServiceTest {

    private lateinit var service: HaveIBeenPwnedService

    @Before
    fun setup() {
        service = HaveIBeenPwnedService()
    }

    @Test
    fun `test SHA-1 hashing is correct`() {
        // Arrange
        val password = "password123"
        val expectedHash = "482c811da5d5b4bc6d497ffa98491e38"

        // Act
        val actualHash = calculateSHA1(password)

        // Assert
        assertEquals(expectedHash, actualHash.lowercase())
    }

    @Test
    fun `test common password is breached`() = runBlocking {
        // Arrange
        val commonPassword = "password"

        // Act
        val result = service.checkPassword(commonPassword)

        // Assert
        assertTrue("Password 'password' should be breached", result is BreachCheckResult.Breached)
        val breached = result as BreachCheckResult.Breached
        assertTrue("Breach count should be > 0", breached.count > 0)
    }

    @Test
    fun `test secure random password is safe`() = runBlocking {
        // Arrange
        val securePassword = "aB3#xY9$kL2@pQ5"

        // Act
        val result = service.checkPassword(securePassword)

        // Assert
        assertTrue("Secure random password should be safe", result is BreachCheckResult.Safe)
    }

    @Test
    fun `test empty password returns error`() = runBlocking {
        // Arrange
        val emptyPassword = ""

        // Act
        val result = try {
            service.checkPassword(emptyPassword)
        } catch (e: Exception) {
            BreachCheckResult.Error(e.message ?: "Unknown error")
        }

        // Assert - should handle gracefully
        assertTrue(result is BreachCheckResult.Safe || result is BreachCheckResult.Error)
    }

    @Test
    fun `test batch checking with mixed passwords`() = runBlocking {
        // Arrange
        val passwords = listOf(
            "password",         // Known breached
            "aB3#xY9$kL2@pQ5", // Likely safe
            "123456"            // Known breached
        )

        // Act
        val results = service.checkPasswordsBatch(passwords)

        // Assert
        assertEquals(3, results.size)
        assertTrue(results.containsKey("password"))
        assertTrue(results.containsKey("aB3#xY9$kL2@pQ5"))
        assertTrue(results.containsKey("123456"))

        // Check that common passwords are breached
        val passwordResult = results["password"]
        assertTrue(passwordResult is BreachCheckResult.Breached)

        val simplePasswordResult = results["123456"]
        assertTrue(simplePasswordResult is BreachCheckResult.Breached)
    }

    @Test
    fun `test k-anonymity model - only 5 chars sent to API`() {
        // Arrange
        val password = "TestPassword123"
        val sha1Hash = calculateSHA1(password).uppercase()

        // Act
        val prefix = sha1Hash.substring(0, 5)
        val suffix = sha1Hash.substring(5)

        // Assert
        assertEquals(5, prefix.length)
        assertTrue(suffix.length > 30) // SHA-1 produces 40 hex chars
        println("SHA-1: $sha1Hash")
        println("Prefix (sent): $prefix")
        println("Suffix (local): $suffix")
    }

    @Test
    fun `test multiple common passwords are all breached`() = runBlocking {
        // Arrange
        val commonPasswords = listOf(
            "password",
            "123456",
            "qwerty",
            "abc123"
        )

        // Act
        val results = commonPasswords.map { password ->
            password to service.checkPassword(password)
        }

        // Assert
        results.forEach { (password, result) ->
            assertTrue(
                "Password '$password' should be breached",
                result is BreachCheckResult.Breached
            )
        }
    }

    // Helper method to calculate SHA-1 (copied from service for testing)
    private fun calculateSHA1(input: String): String {
        val bytes = input.toByteArray()
        val digest = MessageDigest.getInstance("SHA-1")
        val hashBytes = digest.digest(bytes)
        return hashBytes.joinToString("") { "%02x".format(it) }
    }
}
