package com.julien.genpwdpro.domain.generators

import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests unitaires pour le générateur LeetSpeak
 */
class LeetSpeakGeneratorTest {

    private lateinit var generator: LeetSpeakGenerator

    @Before
    fun setup() {
        generator = LeetSpeakGenerator()
    }

    @Test
    fun `generate should return string with correct length`() {
        val length = 16

        val result = generator.generate(length)

        assertEquals(length, result.length)
    }

    @Test
    fun `generate should contain leetspeak substitutions`() {
        val length = 20

        val result = generator.generate(length)

        // Doit contenir au moins un caractère leet (chiffre ou caractère spécial)
        val hasLeetChar = result.any { char ->
            char.isDigit() || char in setOf('@', '3', '!', '1', '0', '5', '7', '8', '$')
        }

        assertTrue("Result should contain leetspeak substitutions", hasLeetChar)
    }

    @Test
    fun `generate should return different passwords on multiple calls`() {
        val length = 16

        val passwords = mutableSetOf<String>()
        repeat(100) {
            passwords.add(generator.generate(length))
        }

        // Au moins 90% des mots de passe doivent être uniques
        assertTrue("Generated passwords should be mostly unique",
            passwords.size >= 90)
    }

    @Test
    fun `generate should handle minimum length`() {
        val length = 4

        val result = generator.generate(length)

        assertEquals(length, result.length)
    }

    @Test
    fun `generate should handle maximum length`() {
        val length = 100

        val result = generator.generate(length)

        assertEquals(length, result.length)
    }

    @Test
    fun `generate should have reasonable substitution rate`() {
        val length = 20

        val result = generator.generate(length)

        // Compter les substitutions leet
        val leetChars = result.count { char ->
            char.isDigit() || char in setOf('@', '!', '$')
        }

        val leetRate = leetChars.toDouble() / length

        // Le taux de substitution devrait être entre 10% et 80%
        assertTrue("Leet substitution rate should be reasonable (10-80%)",
            leetRate in 0.1..0.8)
    }

    @Test
    fun `generate should contain mix of character types`() {
        val length = 20

        val result = generator.generate(length)

        val hasLetter = result.any { it.isLetter() }
        val hasDigitOrSpecial = result.any { it.isDigit() || !it.isLetterOrDigit() }

        assertTrue("Should contain letters", hasLetter)
        assertTrue("Should contain digits or special chars", hasDigitOrSpecial)
    }

    @Test
    fun `generate with zero length should return empty string`() {
        val result = generator.generate(0)
        assertEquals("", result)
    }

    @Test
    fun `generate with negative length should return empty string`() {
        val result = generator.generate(-5)
        assertEquals("", result)
    }

    @Test
    fun `common leetspeak substitutions should be present`() {
        // Générer plusieurs mots de passe et vérifier la présence des substitutions communes
        val passwords = List(50) { generator.generate(20) }
        val allChars = passwords.joinToString("")

        // Vérifier que certaines substitutions leetspeak classiques apparaissent
        val commonLeetChars = setOf('3', '1', '0', '@', '!')
        val foundLeetChars = commonLeetChars.filter { allChars.contains(it) }

        assertTrue("Should contain common leet substitutions",
            foundLeetChars.size >= 3)
    }

    @Test
    fun `generate should maintain readability with some letters`() {
        val length = 20

        val result = generator.generate(length)

        // Au moins 20% devrait être des lettres pour maintenir une lisibilité
        val letterCount = result.count { it.isLetter() }
        val letterRate = letterCount.toDouble() / length

        assertTrue("Should maintain some letters for readability",
            letterRate >= 0.2)
    }

    @Test
    fun `multiple generations should show variation`() {
        val length = 16

        val passwords = List(10) { generator.generate(length) }

        // Vérifier que les premiers caractères sont différents (indication de variation)
        val firstChars = passwords.map { it.first() }.toSet()
        assertTrue("First characters should vary",
            firstChars.size >= 5)
    }
}
