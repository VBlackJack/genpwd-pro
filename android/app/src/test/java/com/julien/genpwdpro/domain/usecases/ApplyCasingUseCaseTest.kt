package com.julien.genpwdpro.domain.usecases

import com.julien.genpwdpro.data.models.CaseBlock
import com.julien.genpwdpro.data.models.CaseMode
import com.julien.genpwdpro.data.models.Settings
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests unitaires pour le use case d'application de casse
 * Updated to match new API: invoke(password, settings)
 */
class ApplyCasingUseCaseTest {

    private lateinit var applyCasingUseCase: ApplyCasingUseCase

    @Before
    fun setup() {
        applyCasingUseCase = ApplyCasingUseCase()
    }

    @Test
    fun `LOWER mode should convert all to lowercase`() {
        val input = "HELLO WORLD"
        val settings = Settings(caseMode = CaseMode.LOWER)

        val result = applyCasingUseCase(input, settings)

        assertEquals("hello world", result)
    }

    @Test
    fun `UPPER mode should convert all to uppercase`() {
        val input = "hello world"
        val settings = Settings(caseMode = CaseMode.UPPER)

        val result = applyCasingUseCase(input, settings)

        assertEquals("HELLO WORLD", result)
    }

    @Test
    fun `TITLE mode should capitalize first letter of each word`() {
        val input = "hello-world-test"
        val settings = Settings(caseMode = CaseMode.TITLE)

        val result = applyCasingUseCase(input, settings)

        assertEquals("Hello-World-Test", result)
    }

    @Test
    fun `TITLE should handle words separated by spaces`() {
        val input = "hello world test"
        val settings = Settings(caseMode = CaseMode.TITLE)

        val result = applyCasingUseCase(input, settings)

        assertEquals("Hello World Test", result)
    }

    @Test
    fun `TITLE should handle underscores as separators`() {
        val input = "hello_world_test"
        val settings = Settings(caseMode = CaseMode.TITLE)

        val result = applyCasingUseCase(input, settings)

        assertEquals("Hello_World_Test", result)
    }

    @Test
    fun `MIXED mode should produce varying case`() {
        val input = "abcdefghij"
        val settings = Settings(caseMode = CaseMode.MIXED)

        // Run multiple times to verify randomness
        val results = (1..10).map { applyCasingUseCase(input, settings) }
        val uniqueResults = results.toSet()

        // Should have some variation (not all identical)
        assertTrue("MIXED mode should produce varying results", uniqueResults.size >= 2)
    }

    @Test
    fun `BLOCKS mode should apply custom blocks with separators`() {
        val input = "hello-world-test"
        val blocks = listOf(CaseBlock.U, CaseBlock.L, CaseBlock.T)
        val settings = Settings(caseMode = CaseMode.BLOCKS, caseBlocks = blocks)

        val result = applyCasingUseCase(input, settings)

        // U = HELLO, L = world, T = Test
        assertEquals("HELLO-world-Test", result)
    }

    @Test
    fun `BLOCKS with T block should capitalize first char`() {
        val input = "hello"
        val blocks = listOf(CaseBlock.T)
        val settings = Settings(caseMode = CaseMode.BLOCKS, caseBlocks = blocks)

        val result = applyCasingUseCase(input, settings)

        assertEquals("Hello", result)
    }

    @Test
    fun `BLOCKS with empty blocks should keep original`() {
        val input = "HelloWorld"
        val blocks = emptyList<CaseBlock>()
        val settings = Settings(caseMode = CaseMode.BLOCKS, caseBlocks = blocks)

        val result = applyCasingUseCase(input, settings)

        assertEquals(input, result)
    }

    @Test
    fun `should handle empty string`() {
        val input = ""

        CaseMode.values().forEach { mode ->
            val settings = Settings(caseMode = mode)
            val result = applyCasingUseCase(input, settings)
            assertEquals("Failed for mode $mode", "", result)
        }
    }

    @Test
    fun `should handle single character`() {
        val input = "a"

        val upperResult = applyCasingUseCase(input, Settings(caseMode = CaseMode.UPPER))
        assertEquals("A", upperResult)

        val lowerResult = applyCasingUseCase(input, Settings(caseMode = CaseMode.LOWER))
        assertEquals("a", lowerResult)
    }

    @Test
    fun `should preserve non-letter characters`() {
        val input = "hello123!@#world"
        val settings = Settings(caseMode = CaseMode.UPPER)

        val result = applyCasingUseCase(input, settings)

        assertEquals("HELLO123!@#WORLD", result)
    }

    @Test
    fun `BLOCKS should divide password into chunks without separators`() {
        val input = "abcdefghij" // 10 chars
        val blocks = listOf(CaseBlock.U, CaseBlock.L, CaseBlock.T)
        val settings = Settings(caseMode = CaseMode.BLOCKS, caseBlocks = blocks)

        val result = applyCasingUseCase(input, settings)

        // Should be divided into 3 chunks: 4+4+2 or 4+3+3
        assertEquals(10, result.length)
        // First chunk should be uppercase
        assertTrue("First chars should be uppercase", result[0].isUpperCase())
    }

    @Test
    fun `should work with unicode characters`() {
        val input = "héllo wörld"
        val settings = Settings(caseMode = CaseMode.UPPER)

        val result = applyCasingUseCase(input, settings)

        assertEquals("HÉLLO WÖRLD", result)
    }

    @Test
    fun `case modes should be consistent for deterministic modes`() {
        val input = "testpassword"

        // UPPER, LOWER, TITLE are deterministic
        listOf(CaseMode.UPPER, CaseMode.LOWER, CaseMode.TITLE).forEach { mode ->
            val settings = Settings(caseMode = mode)
            val result1 = applyCasingUseCase(input, settings)
            val result2 = applyCasingUseCase(input, settings)

            assertEquals(
                "Results should be consistent for mode $mode",
                result1,
                result2
            )
        }
    }
}
