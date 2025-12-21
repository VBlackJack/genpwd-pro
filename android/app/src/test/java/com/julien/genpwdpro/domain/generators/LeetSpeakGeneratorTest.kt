package com.julien.genpwdpro.domain.generators

import com.julien.genpwdpro.data.models.Settings
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Ignore
import org.junit.Test

/**
 * Tests unitaires pour le générateur LeetSpeak
 * Updated to use new Settings-based API
 */
class LeetSpeakGeneratorTest {

    private lateinit var generator: LeetSpeakGenerator

    @Before
    fun setup() {
        generator = LeetSpeakGenerator()
    }

    @Test
    fun `generate should transform word to leetspeak`() = runTest {
        val word = "password"
        val settings = Settings(leetWord = word)

        val result = generator.generate(settings)

        // Should contain leet substitutions
        assertTrue("Result should differ from input", result != word)
    }

    @Test
    fun `generate should return default when word is empty`() = runTest {
        val settings = Settings(leetWord = "")

        val result = generator.generate(settings)

        assertEquals("P@55W0RD", result)
    }

    @Test
    fun `generate should contain leetspeak substitutions`() = runTest {
        val word = "EliteHacker"
        val settings = Settings(leetWord = word)

        val result = generator.generate(settings)

        // Should contain at least one leet char (digit or special)
        val hasLeetChar = result.any { char ->
            char.isDigit() || char in setOf('@', '3', '!', '1', '0', '5', '7', '8', '$')
        }

        assertTrue("Result should contain leetspeak substitutions", hasLeetChar)
    }

    @Test
    fun `generate should preserve unsubstituted characters`() = runTest {
        val word = "xyz" // Characters without leet substitutions
        val settings = Settings(leetWord = word)

        val result = generator.generate(settings)

        assertEquals(word.length, result.length)
    }

    @Test
    fun `generate should handle common word transformations`() = runTest {
        // Test with a word that has known substitutions
        val word = "leet"
        val settings = Settings(leetWord = word)

        val result = generator.generate(settings)

        // 'e' -> '3', 't' -> '7' are common leet substitutions
        assertTrue(
            "Should apply leet substitutions",
            result.contains('3') || result.contains('7')
        )
    }

    @Test
    fun `generate should handle uppercase input`() = runTest {
        val word = "PASSWORD"
        val settings = Settings(leetWord = word)

        val result = generator.generate(settings)

        // Should produce some output
        assertTrue(result.isNotEmpty())
    }

    @Test
    fun `generate should handle mixed case input`() = runTest {
        val word = "PaSsWoRd"
        val settings = Settings(leetWord = word)

        val result = generator.generate(settings)

        assertTrue(result.isNotEmpty())
    }

    @Test
    @Ignore("TODO: Fix UncaughtExceptionsBeforeTest with coroutine test")
    fun `generate should handle numbers in input`() = runTest {
        val word = "test123"
        val settings = Settings(leetWord = word)

        val result = generator.generate(settings)

        // Numbers should pass through or be transformed
        assertTrue(result.isNotEmpty())
    }

    @Test
    fun `generate should handle special characters in input`() = runTest {
        val word = "test@user"
        val settings = Settings(leetWord = word)

        val result = generator.generate(settings)

        // Should handle the @ character
        assertTrue(result.isNotEmpty())
    }

    @Test
    fun `generate should produce consistent output for same input`() = runTest {
        val word = "consistent"
        val settings = Settings(leetWord = word)

        val result1 = generator.generate(settings)
        val result2 = generator.generate(settings)

        assertEquals("Same input should produce same output", result1, result2)
    }

    @Test
    fun `generate should handle long words`() = runTest {
        val word = "supercalifragilisticexpialidocious"
        val settings = Settings(leetWord = word)

        val result = generator.generate(settings)

        assertEquals(word.length, result.length)
    }

    @Test
    fun `generate should handle single character`() = runTest {
        val word = "a"
        val settings = Settings(leetWord = word)

        val result = generator.generate(settings)

        assertEquals(1, result.length)
    }
}
