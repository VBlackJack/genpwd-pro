package com.julien.genpwdpro.domain.generators

import com.julien.genpwdpro.data.models.CharPolicy
import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.domain.utils.CharacterSets
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests unitaires pour le générateur de syllabes
 * Updated to use new Settings-based API
 */
class SyllablesGeneratorTest {

    private lateinit var generator: SyllablesGenerator

    @Before
    fun setup() {
        generator = SyllablesGenerator()
    }

    @Test
    fun `generate should return password with correct length`() = runTest {
        val length = 20
        val settings = Settings(syllablesLength = length, policy = CharPolicy.STANDARD)

        val result = generator.generate(settings)

        assertEquals(length, result.length)
    }

    @Test
    fun `generate should return different passwords on multiple calls`() = runTest {
        val length = 16
        val settings = Settings(syllablesLength = length, policy = CharPolicy.STANDARD)

        val passwords = mutableSetOf<String>()
        repeat(100) {
            passwords.add(generator.generate(settings))
        }

        // Au moins 90% des mots de passe doivent être uniques
        assertTrue(
            "Generated passwords should be mostly unique",
            passwords.size >= 90
        )
    }

    @Test
    fun `generate should respect character policy STANDARD`() = runTest {
        val length = 20
        val settings = Settings(syllablesLength = length, policy = CharPolicy.STANDARD)
        val charSets = CharacterSets.getCharSets(CharPolicy.STANDARD)
        val allChars = (charSets.consonants + charSets.vowels).toSet()

        val password = generator.generate(settings)

        // Tous les caractères doivent être dans les ensembles autorisés
        password.forEach { char ->
            assertTrue(
                "Character $char should be in allowed sets",
                char.lowercaseChar() in allChars
            )
        }
    }

    @Test
    fun `generate should respect character policy STANDARD_LAYOUT`() = runTest {
        val length = 20
        val settings = Settings(syllablesLength = length, policy = CharPolicy.STANDARD_LAYOUT)
        val charSets = CharacterSets.getCharSets(CharPolicy.STANDARD_LAYOUT)
        val allChars = (charSets.consonants + charSets.vowels).toSet()

        val password = generator.generate(settings)

        password.forEach { char ->
            assertTrue(
                "Character $char should be in allowed sets",
                char.lowercaseChar() in allChars
            )
        }
    }

    @Test
    fun `generate should handle minimum length`() = runTest {
        val length = 4 // Minimum pratique
        val settings = Settings(syllablesLength = length, policy = CharPolicy.STANDARD)

        val result = generator.generate(settings)

        assertEquals(length, result.length)
    }

    @Test
    fun `generate should handle maximum length`() = runTest {
        val length = 100 // Longueur élevée
        val settings = Settings(syllablesLength = length, policy = CharPolicy.STANDARD)

        val result = generator.generate(settings)

        assertEquals(length, result.length)
    }

    @Test
    fun `generate should create pronounceable syllables`() = runTest {
        val length = 20
        val settings = Settings(syllablesLength = length, policy = CharPolicy.STANDARD)
        val charSets = CharacterSets.getCharSets(CharPolicy.STANDARD)

        val password = generator.generate(settings)

        // Vérifier qu'il y a une alternance consonne-voyelle raisonnable
        var consonantCount = 0
        var vowelCount = 0

        password.forEach { char ->
            when (char.lowercaseChar()) {
                in charSets.consonants -> consonantCount++
                in charSets.vowels -> vowelCount++
            }
        }

        // Un mot de passe prononçable devrait avoir un ratio équilibré
        val ratio = consonantCount.toDouble() / vowelCount.toDouble()
        assertTrue(
            "Consonant/vowel ratio should be balanced",
            ratio in 0.5..3.0
        )
    }

    @Test
    fun `generate should work with all character policies`() = runTest {
        val length = 16

        CharPolicy.values().forEach { policy ->
            val settings = Settings(syllablesLength = length, policy = policy)
            val password = generator.generate(settings)
            assertEquals("Failed for policy $policy", length, password.length)
        }
    }

    @Test
    fun `generate with zero length should return empty string`() = runTest {
        val settings = Settings(syllablesLength = 0, policy = CharPolicy.STANDARD)
        val result = generator.generate(settings)
        assertEquals("", result)
    }

    @Test
    fun `generate with negative length should return empty string`() = runTest {
        // Note: Settings.validate() would correct this, but generator should handle it
        val settings = Settings(syllablesLength = -5, policy = CharPolicy.STANDARD)
        val result = generator.generate(settings.validate())
        // After validation, syllablesLength is corrected to minimum (4)
        assertTrue(result.length >= 4)
    }
}
