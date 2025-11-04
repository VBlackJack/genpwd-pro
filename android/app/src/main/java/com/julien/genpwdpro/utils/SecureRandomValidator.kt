package com.julien.genpwdpro.utils

import android.util.Log
import java.security.SecureRandom

/**
 * Validator for SecureRandom functionality
 *
 * SECURITY: Validates that SecureRandom is working correctly
 * Some older Android devices may have faulty SecureRandom implementations
 *
 * Reference: https://android-developers.googleblog.com/2013/08/some-securerandom-thoughts.html
 *
 * Usage:
 * ```kotlin
 * // In Application.onCreate()
 * if (!SecureRandomValidator.validate()) {
 *     throw SecurityException("SecureRandom validation failed!")
 * }
 * ```
 */
object SecureRandomValidator {

    private const val TAG = "SecureRandomValidator"

    /**
     * Validate that SecureRandom is working correctly
     *
     * Performs multiple tests:
     * 1. Generate random bytes (not all zeros)
     * 2. Generate two sequences (must be different)
     * 3. Statistical randomness check (basic)
     *
     * @return true if SecureRandom appears to be working correctly
     */
    fun validate(): Boolean {
        return try {
            val random = SecureRandom()

            // Test 1: Generate random bytes
            val testBytes = ByteArray(32)
            random.nextBytes(testBytes)

            // Test 2: Check not all zeros (would indicate failure)
            if (testBytes.all { it == 0.toByte() }) {
                Log.e(TAG, "SecureRandom generated all zeros!")
                return false
            }

            // Test 3: Check not all same value
            val firstByte = testBytes[0]
            if (testBytes.all { it == firstByte }) {
                Log.e(TAG, "SecureRandom generated all same values!")
                return false
            }

            // Test 4: Generate two sequences, ensure different
            val bytes1 = ByteArray(16)
            val bytes2 = ByteArray(16)
            random.nextBytes(bytes1)
            random.nextBytes(bytes2)

            if (bytes1.contentEquals(bytes2)) {
                Log.e(TAG, "SecureRandom generated identical sequences!")
                return false
            }

            // Test 5: Basic statistical test (check for variety)
            val largeSequence = ByteArray(256)
            random.nextBytes(largeSequence)

            // Count unique bytes (should be close to 256 with high probability)
            val uniqueBytes = largeSequence.distinct().size
            if (uniqueBytes < 100) {
                // Less than 100 unique bytes in 256 samples is suspicious
                Log.w(TAG, "SecureRandom has low entropy: only $uniqueBytes unique bytes in 256 samples")
                return false
            }

            // All tests passed
            Log.i(TAG, "SecureRandom validation passed (uniqueBytes=$uniqueBytes/256)")
            true

        } catch (e: Exception) {
            Log.e(TAG, "SecureRandom validation failed with exception", e)
            false
        }
    }

    /**
     * Validate and throw exception if validation fails
     *
     * Use this in Application.onCreate() to fail fast on broken devices
     *
     * @throws SecurityException if SecureRandom validation fails
     */
    fun validateOrThrow() {
        if (!validate()) {
            throw SecurityException(
                "SecureRandom validation failed! This device may have a faulty random number generator. " +
                "Cannot proceed safely with cryptographic operations."
            )
        }
    }

    /**
     * Get detailed validation report
     *
     * @return Validation report with test results
     */
    fun getValidationReport(): ValidationReport {
        val random = SecureRandom()

        // Run all tests
        val test1 = testNotAllZeros(random)
        val test2 = testNotAllSameValue(random)
        val test3 = testDifferentSequences(random)
        val test4 = testStatisticalRandomness(random)

        val allPassed = test1 && test2 && test3 && test4

        return ValidationReport(
            passed = allPassed,
            testNotAllZeros = test1,
            testNotAllSameValue = test2,
            testDifferentSequences = test3,
            testStatisticalRandomness = test4,
            provider = random.provider.name,
            algorithm = random.algorithm
        )
    }

    private fun testNotAllZeros(random: SecureRandom): Boolean {
        val testBytes = ByteArray(32)
        random.nextBytes(testBytes)
        return !testBytes.all { it == 0.toByte() }
    }

    private fun testNotAllSameValue(random: SecureRandom): Boolean {
        val testBytes = ByteArray(32)
        random.nextBytes(testBytes)
        val firstByte = testBytes[0]
        return !testBytes.all { it == firstByte }
    }

    private fun testDifferentSequences(random: SecureRandom): Boolean {
        val bytes1 = ByteArray(16)
        val bytes2 = ByteArray(16)
        random.nextBytes(bytes1)
        random.nextBytes(bytes2)
        return !bytes1.contentEquals(bytes2)
    }

    private fun testStatisticalRandomness(random: SecureRandom): Boolean {
        val largeSequence = ByteArray(256)
        random.nextBytes(largeSequence)
        val uniqueBytes = largeSequence.distinct().size
        return uniqueBytes >= 100  // At least 100 unique bytes in 256 samples
    }
}

/**
 * Validation report with detailed test results
 */
data class ValidationReport(
    val passed: Boolean,
    val testNotAllZeros: Boolean,
    val testNotAllSameValue: Boolean,
    val testDifferentSequences: Boolean,
    val testStatisticalRandomness: Boolean,
    val provider: String,
    val algorithm: String
) {
    override fun toString(): String {
        return buildString {
            appendLine("SecureRandom Validation Report")
            appendLine("==============================")
            appendLine("Overall: ${if (passed) "✅ PASSED" else "❌ FAILED"}")
            appendLine("Provider: $provider")
            appendLine("Algorithm: $algorithm")
            appendLine()
            appendLine("Tests:")
            appendLine("  Not all zeros: ${if (testNotAllZeros) "✅" else "❌"}")
            appendLine("  Not all same value: ${if (testNotAllSameValue) "✅" else "❌"}")
            appendLine("  Different sequences: ${if (testDifferentSequences) "✅" else "❌"}")
            appendLine("  Statistical randomness: ${if (testStatisticalRandomness) "✅" else "❌"}")
        }
    }
}
