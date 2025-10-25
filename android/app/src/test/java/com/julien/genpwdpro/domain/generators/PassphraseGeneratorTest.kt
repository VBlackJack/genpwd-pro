package com.julien.genpwdpro.domain.generators

import com.julien.genpwdpro.data.models.DictionaryType
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests unitaires pour le générateur de phrases de passe
 */
class PassphraseGeneratorTest {

    private lateinit var generator: PassphraseGenerator

    @Before
    fun setup() {
        generator = PassphraseGenerator()
    }

    @Test
    fun `generate should return correct number of words`() {
        val wordCount = 5
        val dictionary = DictionaryType.EFF_LARGE

        val result = generator.generate(wordCount, dictionary)
        val words = result.split(" ")

        assertEquals(wordCount, words.size)
    }

    @Test
    fun `generate should use space as separator`() {
        val wordCount = 4
        val dictionary = DictionaryType.EFF_LARGE

        val result = generator.generate(wordCount, dictionary)

        assertTrue("Result should contain spaces", result.contains(" "))
        assertEquals("Separator count should be word count - 1",
            wordCount - 1, result.count { it == ' ' })
    }

    @Test
    fun `generate should return different passphrases on multiple calls`() {
        val wordCount = 5
        val dictionary = DictionaryType.EFF_LARGE

        val passphrases = mutableSetOf<String>()
        repeat(50) {
            passphrases.add(generator.generate(wordCount, dictionary))
        }

        // Au moins 90% des phrases doivent être uniques
        assertTrue("Generated passphrases should be mostly unique",
            passphrases.size >= 45)
    }

    @Test
    fun `generate should work with EFF_LARGE dictionary`() {
        val wordCount = 6
        val dictionary = DictionaryType.EFF_LARGE

        val result = generator.generate(wordCount, dictionary)
        val words = result.split(" ")

        assertEquals(wordCount, words.size)
        words.forEach { word ->
            assertTrue("Word should not be empty", word.isNotEmpty())
        }
    }

    @Test
    fun `generate should work with EFF_SHORT dictionary`() {
        val wordCount = 6
        val dictionary = DictionaryType.EFF_SHORT

        val result = generator.generate(wordCount, dictionary)
        val words = result.split(" ")

        assertEquals(wordCount, words.size)
        // Les mots courts devraient généralement faire 4-5 caractères
        words.forEach { word ->
            assertTrue("Short word should be 3-6 chars", word.length in 3..6)
        }
    }

    @Test
    fun `generate should work with BEALE dictionary`() {
        val wordCount = 5
        val dictionary = DictionaryType.BEALE

        val result = generator.generate(wordCount, dictionary)
        val words = result.split(" ")

        assertEquals(wordCount, words.size)
    }

    @Test
    fun `generate should work with SKEY dictionary`() {
        val wordCount = 6
        val dictionary = DictionaryType.SKEY

        val result = generator.generate(wordCount, dictionary)
        val words = result.split(" ")

        assertEquals(wordCount, words.size)
    }

    @Test
    fun `generate should handle minimum word count`() {
        val wordCount = 1
        val dictionary = DictionaryType.EFF_LARGE

        val result = generator.generate(wordCount, dictionary)

        assertFalse("Single word should not contain spaces",
            result.contains(" "))
    }

    @Test
    fun `generate should handle maximum word count`() {
        val wordCount = 20
        val dictionary = DictionaryType.EFF_LARGE

        val result = generator.generate(wordCount, dictionary)
        val words = result.split(" ")

        assertEquals(wordCount, words.size)
    }

    @Test
    fun `generate with zero words should return empty string`() {
        val result = generator.generate(0, DictionaryType.EFF_LARGE)
        assertEquals("", result)
    }

    @Test
    fun `generate with negative word count should return empty string`() {
        val result = generator.generate(-3, DictionaryType.EFF_LARGE)
        assertEquals("", result)
    }

    @Test
    fun `generate should work with all dictionary types`() {
        val wordCount = 4

        DictionaryType.values().forEach { dictionary ->
            val result = generator.generate(wordCount, dictionary)
            val words = result.split(" ")
            assertEquals("Failed for dictionary $dictionary",
                wordCount, words.size)
        }
    }

    @Test
    fun `words should be lowercase`() {
        val wordCount = 5
        val dictionary = DictionaryType.EFF_LARGE

        val result = generator.generate(wordCount, dictionary)

        assertEquals("All words should be lowercase",
            result, result.lowercase())
    }

    @Test
    fun `words should not contain special characters`() {
        val wordCount = 5
        val dictionary = DictionaryType.EFF_LARGE

        val result = generator.generate(wordCount, dictionary)

        // Seuls lettres et espaces sont autorisés
        result.forEach { char ->
            assertTrue("Character should be letter or space",
                char.isLetter() || char == ' ')
        }
    }
}
