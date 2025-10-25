package com.julien.genpwdpro.domain.generators

import com.julien.genpwdpro.data.models.CharPolicy
import com.julien.genpwdpro.domain.utils.CharacterSets
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests unitaires pour le générateur de syllabes
 */
class SyllablesGeneratorTest {

    private lateinit var generator: SyllablesGenerator

    @Before
    fun setup() {
        generator = SyllablesGenerator()
    }

    @Test
    fun `generate should return password with correct length`() {
        val length = 20
        val policy = CharPolicy.STANDARD

        val result = generator.generate(length, policy)

        assertEquals(length, result.length)
    }

    @Test
    fun `generate should return different passwords on multiple calls`() {
        val length = 16
        val policy = CharPolicy.STANDARD

        val passwords = mutableSetOf<String>()
        repeat(100) {
            passwords.add(generator.generate(length, policy))
        }

        // Au moins 90% des mots de passe doivent être uniques
        assertTrue("Generated passwords should be mostly unique",
            passwords.size >= 90)
    }

    @Test
    fun `generate should respect character policy STANDARD`() {
        val length = 20
        val policy = CharPolicy.STANDARD
        val charSets = CharacterSets.getCharacterSets(policy)
        val allChars = (charSets.consonants + charSets.vowels).toSet()

        val password = generator.generate(length, policy)

        // Tous les caractères doivent être dans les ensembles autorisés
        password.forEach { char ->
            assertTrue("Character $char should be in allowed sets",
                char.lowercaseChar() in allChars)
        }
    }

    @Test
    fun `generate should respect character policy EXTENDED`() {
        val length = 20
        val policy = CharPolicy.EXTENDED
        val charSets = CharacterSets.getCharacterSets(policy)
        val allChars = (charSets.consonants + charSets.vowels).toSet()

        val password = generator.generate(length, policy)

        password.forEach { char ->
            assertTrue("Character $char should be in allowed sets",
                char.lowercaseChar() in allChars)
        }
    }

    @Test
    fun `generate should handle minimum length`() {
        val length = 4 // Minimum pratique
        val policy = CharPolicy.STANDARD

        val result = generator.generate(length, policy)

        assertEquals(length, result.length)
    }

    @Test
    fun `generate should handle maximum length`() {
        val length = 100 // Longueur élevée
        val policy = CharPolicy.STANDARD

        val result = generator.generate(length, policy)

        assertEquals(length, result.length)
    }

    @Test
    fun `generate should create pronounceable syllables`() {
        val length = 20
        val policy = CharPolicy.STANDARD
        val charSets = CharacterSets.getCharacterSets(policy)

        val password = generator.generate(length, policy)

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
        assertTrue("Consonant/vowel ratio should be balanced",
            ratio in 0.5..3.0)
    }

    @Test
    fun `generate should work with all character policies`() {
        val length = 16

        CharPolicy.values().forEach { policy ->
            val password = generator.generate(length, policy)
            assertEquals("Failed for policy $policy", length, password.length)
        }
    }

    @Test
    fun `generate with zero length should return empty string`() {
        val result = generator.generate(0, CharPolicy.STANDARD)
        assertEquals("", result)
    }

    @Test
    fun `generate with negative length should return empty string`() {
        val result = generator.generate(-5, CharPolicy.STANDARD)
        assertEquals("", result)
    }
}
