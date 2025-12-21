package com.julien.genpwdpro.domain.generators

import com.julien.genpwdpro.data.models.DictionaryType
import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.domain.utils.DictionaryManager
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests unitaires pour le générateur de phrases de passe
 * Updated to use new Settings-based API
 */
class PassphraseGeneratorTest {

    private lateinit var generator: PassphraseGenerator
    private lateinit var dictionaryManager: DictionaryManager

    // Sample word lists for testing
    private val frenchWords = listOf(
        "maison", "jardin", "soleil", "fleur", "arbre",
        "chaise", "table", "livre", "porte", "fenetre"
    )
    private val englishWords = listOf(
        "house", "garden", "sun", "flower", "tree",
        "chair", "table", "book", "door", "window"
    )

    @Before
    fun setup() {
        dictionaryManager = mockk()
        coEvery { dictionaryManager.getDictionary(DictionaryType.FRENCH) } returns frenchWords
        coEvery { dictionaryManager.getDictionary(DictionaryType.ENGLISH) } returns englishWords
        coEvery { dictionaryManager.getDictionary(DictionaryType.LATIN) } returns englishWords // Use same list for Latin

        generator = PassphraseGenerator(dictionaryManager)
    }

    @Test
    fun `generate should return correct number of words`() = runTest {
        val wordCount = 5
        val settings = Settings(
            passphraseWordCount = wordCount,
            dictionary = DictionaryType.FRENCH,
            passphraseSeparator = " "
        )

        val result = generator.generate(settings)
        val words = result.split(" ")

        assertEquals(wordCount, words.size)
    }

    @Test
    fun `generate should use space as default separator`() = runTest {
        val wordCount = 4
        val settings = Settings(
            passphraseWordCount = wordCount,
            dictionary = DictionaryType.FRENCH,
            passphraseSeparator = " "
        )

        val result = generator.generate(settings)

        assertTrue("Result should contain spaces", result.contains(" "))
        assertEquals(
            "Separator count should be word count - 1",
            wordCount - 1,
            result.count { it == ' ' }
        )
    }

    @Test
    fun `generate should use custom separator`() = runTest {
        val wordCount = 3
        val settings = Settings(
            passphraseWordCount = wordCount,
            dictionary = DictionaryType.ENGLISH,
            passphraseSeparator = "-"
        )

        val result = generator.generate(settings)

        assertTrue("Result should contain dashes", result.contains("-"))
        assertEquals(
            "Dash count should be word count - 1",
            wordCount - 1,
            result.count { it == '-' }
        )
    }

    @Test
    fun `generate should return different passphrases on multiple calls`() = runTest {
        val wordCount = 5
        val settings = Settings(
            passphraseWordCount = wordCount,
            dictionary = DictionaryType.FRENCH,
            passphraseSeparator = " "
        )

        val passphrases = mutableSetOf<String>()
        repeat(50) {
            passphrases.add(generator.generate(settings))
        }

        // Most passphrases should be unique
        assertTrue(
            "Generated passphrases should be mostly unique",
            passphrases.size >= 30
        )
    }

    @Test
    fun `generate should work with French dictionary`() = runTest {
        val wordCount = 4
        val settings = Settings(
            passphraseWordCount = wordCount,
            dictionary = DictionaryType.FRENCH,
            passphraseSeparator = " "
        )

        val result = generator.generate(settings)
        val words = result.split(" ")

        assertEquals(wordCount, words.size)
        words.forEach { word ->
            assertTrue("Word '$word' should be in French dictionary", word in frenchWords)
        }
    }

    @Test
    fun `generate should work with English dictionary`() = runTest {
        val wordCount = 4
        val settings = Settings(
            passphraseWordCount = wordCount,
            dictionary = DictionaryType.ENGLISH,
            passphraseSeparator = " "
        )

        val result = generator.generate(settings)
        val words = result.split(" ")

        assertEquals(wordCount, words.size)
        words.forEach { word ->
            assertTrue("Word '$word' should be in English dictionary", word in englishWords)
        }
    }

    @Test
    fun `generate should handle minimum word count`() = runTest {
        val wordCount = 1
        val settings = Settings(
            passphraseWordCount = wordCount,
            dictionary = DictionaryType.FRENCH,
            passphraseSeparator = " "
        )

        val result = generator.generate(settings)

        assertFalse(
            "Single word should not contain spaces",
            result.contains(" ")
        )
    }

    @Test
    fun `generate should handle maximum word count`() = runTest {
        val wordCount = 10
        val settings = Settings(
            passphraseWordCount = wordCount,
            dictionary = DictionaryType.FRENCH,
            passphraseSeparator = " "
        )

        val result = generator.generate(settings)
        val words = result.split(" ")

        assertEquals(wordCount, words.size)
    }

    @Test
    fun `generate with zero words should return empty string`() = runTest {
        val settings = Settings(
            passphraseWordCount = 0,
            dictionary = DictionaryType.FRENCH,
            passphraseSeparator = " "
        )

        val result = generator.generate(settings)
        assertEquals("", result)
    }

    @Test
    fun `generate should work with all dictionary types`() = runTest {
        val wordCount = 4

        DictionaryType.values().forEach { dictionary ->
            val settings = Settings(
                passphraseWordCount = wordCount,
                dictionary = dictionary,
                passphraseSeparator = " "
            )
            val result = generator.generate(settings)
            val words = result.split(" ")
            assertEquals(
                "Failed for dictionary $dictionary",
                wordCount,
                words.size
            )
        }
    }

    @Test
    fun `words should be lowercase`() = runTest {
        val wordCount = 5
        val settings = Settings(
            passphraseWordCount = wordCount,
            dictionary = DictionaryType.FRENCH,
            passphraseSeparator = " "
        )

        val result = generator.generate(settings)

        assertEquals(
            "All words should be lowercase",
            result,
            result.lowercase()
        )
    }
}
