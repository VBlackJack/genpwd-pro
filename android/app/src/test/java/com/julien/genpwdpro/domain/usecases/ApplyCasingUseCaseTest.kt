package com.julien.genpwdpro.domain.usecases

import com.julien.genpwdpro.data.models.CaseBlock
import com.julien.genpwdpro.data.models.CaseMode
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests unitaires pour le use case d'application de casse
 */
class ApplyCasingUseCaseTest {

    private lateinit var applyCasingUseCase: ApplyCasingUseCase

    @Before
    fun setup() {
        applyCasingUseCase = ApplyCasingUseCase()
    }

    @Test
    fun `LOWERCASE mode should convert all to lowercase`() {
        val input = "HELLO WORLD"
        val mode = CaseMode.LOWERCASE

        val result = applyCasingUseCase(input, mode, emptyList())

        assertEquals("hello world", result)
    }

    @Test
    fun `UPPERCASE mode should convert all to uppercase`() {
        val input = "hello world"
        val mode = CaseMode.UPPERCASE

        val result = applyCasingUseCase(input, mode, emptyList())

        assertEquals("HELLO WORLD", result)
    }

    @Test
    fun `CAPITALIZE mode should capitalize first letter`() {
        val input = "hello world"
        val mode = CaseMode.CAPITALIZE

        val result = applyCasingUseCase(input, mode, emptyList())

        assertEquals("Hello world", result)
    }

    @Test
    fun `CAPITALIZE_WORDS mode should capitalize each word`() {
        val input = "hello world test"
        val mode = CaseMode.CAPITALIZE_WORDS

        val result = applyCasingUseCase(input, mode, emptyList())

        assertEquals("Hello World Test", result)
    }

    @Test
    fun `CAPITALIZE_WORDS should handle multiple spaces`() {
        val input = "hello  world   test"
        val mode = CaseMode.CAPITALIZE_WORDS

        val result = applyCasingUseCase(input, mode, emptyList())

        // Les espaces doivent être préservés
        assertTrue("Should capitalize after spaces", result.contains("Hello"))
        assertTrue("Should capitalize after spaces", result.contains("World"))
    }

    @Test
    fun `TOGGLE mode should alternate case`() {
        val input = "abcdefgh"
        val mode = CaseMode.TOGGLE

        val result = applyCasingUseCase(input, mode, emptyList())

        // Devrait alterner entre minuscule et majuscule
        assertTrue("First char should be lowercase", result[0].isLowerCase())
        assertTrue("Second char should be uppercase", result[1].isUpperCase())
        assertTrue("Third char should be lowercase", result[2].isLowerCase())
    }

    @Test
    fun `VISUAL_BLOCKS mode should apply custom blocks`() {
        val input = "abcdefgh" // 8 chars
        val mode = CaseMode.VISUAL_BLOCKS
        val blocks = listOf(
            CaseBlock.UPPERCASE,  // 0-2: ABC
            CaseBlock.LOWERCASE,  // 3-5: def
            CaseBlock.TITLECASE   // 6-7: Gh
        )

        val result = applyCasingUseCase(input, mode, blocks)

        assertEquals('A', result[0]) // Upper
        assertEquals('B', result[1]) // Upper
        assertEquals('C', result[2]) // Upper
        assertEquals('d', result[3]) // Lower
        assertEquals('e', result[4]) // Lower
        assertEquals('f', result[5]) // Lower
        assertEquals('G', result[6]) // Title (first upper)
        assertEquals('h', result[7]) // Title (rest lower)
    }

    @Test
    fun `VISUAL_BLOCKS with TITLECASE should capitalize first char of block`() {
        val input = "hello"
        val mode = CaseMode.VISUAL_BLOCKS
        val blocks = listOf(CaseBlock.TITLECASE)

        val result = applyCasingUseCase(input, mode, blocks)

        assertEquals('H', result[0])
        assertEquals('e', result[1])
        assertEquals('l', result[2])
        assertEquals('l', result[3])
        assertEquals('o', result[4])
    }

    @Test
    fun `VISUAL_BLOCKS with empty blocks should keep original case`() {
        val input = "HelloWorld"
        val mode = CaseMode.VISUAL_BLOCKS
        val blocks = emptyList<CaseBlock>()

        val result = applyCasingUseCase(input, mode, blocks)

        assertEquals(input, result)
    }

    @Test
    fun `should handle empty string`() {
        val input = ""

        CaseMode.values().forEach { mode ->
            val result = applyCasingUseCase(input, mode, emptyList())
            assertEquals("Failed for mode $mode", "", result)
        }
    }

    @Test
    fun `should handle single character`() {
        val input = "a"

        val upperResult = applyCasingUseCase(input, CaseMode.UPPERCASE, emptyList())
        assertEquals("A", upperResult)

        val lowerResult = applyCasingUseCase(input, CaseMode.LOWERCASE, emptyList())
        assertEquals("a", lowerResult)
    }

    @Test
    fun `should preserve non-letter characters`() {
        val input = "hello123!@#world"
        val mode = CaseMode.UPPERCASE

        val result = applyCasingUseCase(input, mode, emptyList())

        assertEquals("HELLO123!@#WORLD", result)
    }

    @Test
    fun `CAPITALIZE_WORDS should handle words separated by dashes`() {
        val input = "hello-world-test"
        val mode = CaseMode.CAPITALIZE_WORDS

        val result = applyCasingUseCase(input, mode, emptyList())

        // Devrait capitaliser après les tirets aussi
        assertTrue("Should handle dashes", result.contains("Hello"))
    }

    @Test
    fun `TOGGLE mode should handle non-letters`() {
        val input = "a1b2c3"
        val mode = CaseMode.TOGGLE

        val result = applyCasingUseCase(input, mode, emptyList())

        // Les chiffres ne changent pas, mais les lettres alternent
        assertTrue("'a' should be lowercase", result[0] == 'a')
        assertTrue("'1' should remain", result[1] == '1')
        assertTrue("'b' should be uppercase", result[2] == 'B')
    }

    @Test
    fun `VISUAL_BLOCKS should handle blocks larger than password`() {
        val input = "abc"
        val mode = CaseMode.VISUAL_BLOCKS
        val blocks = listOf(
            CaseBlock.UPPERCASE,
            CaseBlock.LOWERCASE,
            CaseBlock.UPPERCASE,
            CaseBlock.LOWERCASE,
            CaseBlock.UPPERCASE
        )

        val result = applyCasingUseCase(input, mode, blocks)

        // Ne devrait pas crasher, utiliser les blocs disponibles
        assertEquals(3, result.length)
    }

    @Test
    fun `should work with unicode characters`() {
        val input = "héllo wörld"
        val mode = CaseMode.UPPERCASE

        val result = applyCasingUseCase(input, mode, emptyList())

        assertEquals("HÉLLO WÖRLD", result)
    }

    @Test
    fun `multiple blocks should divide password evenly`() {
        val input = "abcdefghij" // 10 chars
        val mode = CaseMode.VISUAL_BLOCKS
        val blocks = listOf(
            CaseBlock.UPPERCASE,  // chars 0-3
            CaseBlock.LOWERCASE,  // chars 4-6
            CaseBlock.TITLECASE   // chars 7-9
        )

        val result = applyCasingUseCase(input, mode, blocks)

        // Vérifier que les blocs sont appliqués correctement
        val firstPart = result.substring(0, 4)
        assertTrue("First part should be uppercase",
            firstPart == firstPart.uppercase())
    }

    @Test
    fun `case modes should be consistent across multiple calls`() {
        val input = "testpassword"

        CaseMode.values().forEach { mode ->
            val result1 = applyCasingUseCase(input, mode, emptyList())
            val result2 = applyCasingUseCase(input, mode, emptyList())

            assertEquals("Results should be consistent for mode $mode",
                result1, result2)
        }
    }
}
