package com.julien.genpwdpro.domain.usecases

import com.julien.genpwdpro.data.models.CaseMode
import com.julien.genpwdpro.data.models.GenerationMode
import com.julien.genpwdpro.data.models.Placement
import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.domain.generators.CustomPhraseGenerator
import com.julien.genpwdpro.domain.generators.LeetSpeakGenerator
import com.julien.genpwdpro.domain.generators.PassphraseGenerator
import com.julien.genpwdpro.domain.generators.SyllablesGenerator
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests pour GeneratePasswordUseCase
 * Updated to match new suspend API
 */
class GeneratePasswordUseCaseTest {

    private lateinit var syllablesGenerator: SyllablesGenerator
    private lateinit var passphraseGenerator: PassphraseGenerator
    private lateinit var leetSpeakGenerator: LeetSpeakGenerator
    private lateinit var customPhraseGenerator: CustomPhraseGenerator
    private lateinit var applyCasingUseCase: ApplyCasingUseCase
    private lateinit var placeCharactersUseCase: PlaceCharactersUseCase
    private lateinit var useCase: GeneratePasswordUseCase

    @Before
    fun setup() {
        syllablesGenerator = mockk(relaxed = true)
        passphraseGenerator = mockk(relaxed = true)
        leetSpeakGenerator = mockk(relaxed = true)
        customPhraseGenerator = mockk(relaxed = true)
        applyCasingUseCase = mockk(relaxed = true)
        placeCharactersUseCase = mockk(relaxed = true)

        useCase = GeneratePasswordUseCase(
            syllablesGenerator,
            passphraseGenerator,
            leetSpeakGenerator,
            customPhraseGenerator,
            applyCasingUseCase,
            placeCharactersUseCase
        )
    }

    @Test
    fun `invoke with SYLLABLES mode calls syllables generator`() = runTest {
        val settings = Settings(mode = GenerationMode.SYLLABLES, quantity = 1)
        coEvery { syllablesGenerator.generate(any()) } returns "testpassword"
        every { applyCasingUseCase.invoke(any(), any()) } returns "testpassword"
        every { placeCharactersUseCase.invoke(any(), any()) } returns "testpassword"

        val results = useCase(settings)

        assertEquals(1, results.size)
        assertEquals("testpassword", results[0].password)
        coVerify { syllablesGenerator.generate(any()) }
    }

    @Test
    fun `invoke with PASSPHRASE mode calls passphrase generator`() = runTest {
        val settings = Settings(mode = GenerationMode.PASSPHRASE, quantity = 1)
        coEvery { passphraseGenerator.generate(any()) } returns "correct-horse-battery-staple"
        every { applyCasingUseCase.invoke(any(), any()) } returns "correct-horse-battery-staple"
        every { placeCharactersUseCase.invoke(any(), any()) } returns "correct-horse-battery-staple"

        val results = useCase(settings)

        assertEquals(1, results.size)
        assertEquals("correct-horse-battery-staple", results[0].password)
        coVerify { passphraseGenerator.generate(any()) }
    }

    @Test
    fun `invoke with LEET mode calls leet speak generator`() = runTest {
        val settings = Settings(mode = GenerationMode.LEET, quantity = 1)
        coEvery { leetSpeakGenerator.generate(any()) } returns "73571337"
        every { applyCasingUseCase.invoke(any(), any()) } returns "73571337"
        every { placeCharactersUseCase.invoke(any(), any()) } returns "73571337"

        val results = useCase(settings)

        assertEquals(1, results.size)
        assertEquals("73571337", results[0].password)
        coVerify { leetSpeakGenerator.generate(any()) }
    }

    @Test
    fun `invoke applies casing transformation`() = runTest {
        val settings = Settings(
            mode = GenerationMode.SYLLABLES,
            caseMode = CaseMode.UPPER,
            quantity = 1
        )
        coEvery { syllablesGenerator.generate(any()) } returns "password"
        every { applyCasingUseCase.invoke("password", any()) } returns "PASSWORD"
        every { placeCharactersUseCase.invoke("PASSWORD", any()) } returns "PASSWORD"

        val results = useCase(settings)

        assertEquals("PASSWORD", results[0].password)
        verify { applyCasingUseCase.invoke("password", any()) }
    }

    @Test
    fun `invoke applies character placement`() = runTest {
        val settings = Settings(
            mode = GenerationMode.SYLLABLES,
            digitsCount = 2,
            specialsCount = 2,
            quantity = 1
        )
        coEvery { syllablesGenerator.generate(any()) } returns "password"
        every { applyCasingUseCase.invoke(any(), any()) } returns "password"
        every { placeCharactersUseCase.invoke("password", any()) } returns "12password!@"

        val results = useCase(settings)

        assertEquals("12password!@", results[0].password)
        verify { placeCharactersUseCase.invoke("password", any()) }
    }

    @Test
    fun `invoke chains all transformations correctly`() = runTest {
        val settings = Settings(
            mode = GenerationMode.SYLLABLES,
            caseMode = CaseMode.UPPER,
            digitsCount = 2,
            digitsPlacement = Placement.END,
            quantity = 1
        )

        coEvery { syllablesGenerator.generate(any()) } returns "password"
        every { applyCasingUseCase.invoke("password", any()) } returns "PASSWORD"
        every { placeCharactersUseCase.invoke("PASSWORD", any()) } returns "PASSWORD12"

        val results = useCase(settings)

        assertEquals("PASSWORD12", results[0].password)

        // Vérifie l'ordre d'exécution
        coVerify(exactly = 1) { syllablesGenerator.generate(any()) }
        verify(exactly = 1) { applyCasingUseCase.invoke("password", any()) }
        verify(exactly = 1) { placeCharactersUseCase.invoke("PASSWORD", any()) }
    }

    @Test
    fun `invoke generates correct quantity of passwords`() = runTest {
        val settings = Settings(mode = GenerationMode.SYLLABLES, quantity = 5)
        coEvery { syllablesGenerator.generate(any()) } returns "testpassword"
        every { applyCasingUseCase.invoke(any(), any()) } returns "testpassword"
        every { placeCharactersUseCase.invoke(any(), any()) } returns "testpassword"

        val results = useCase(settings)

        assertEquals(5, results.size)
    }

    @Test
    fun `invoke with different modes produces different results`() = runTest {
        val settingsSyllables = Settings(mode = GenerationMode.SYLLABLES, quantity = 1)
        val settingsPassphrase = Settings(mode = GenerationMode.PASSPHRASE, quantity = 1)

        coEvery { syllablesGenerator.generate(any()) } returns "syllable"
        coEvery { passphraseGenerator.generate(any()) } returns "passphrase"
        every { applyCasingUseCase.invoke(any(), any()) } answers { firstArg() }
        every { placeCharactersUseCase.invoke(any(), any()) } answers { firstArg() }

        val result1 = useCase(settingsSyllables)
        val result2 = useCase(settingsPassphrase)

        assertNotEquals(result1[0].password, result2[0].password)
    }

    @Test
    fun `invoke with CUSTOM_PHRASE mode calls custom phrase generator`() = runTest {
        val settings = Settings(
            mode = GenerationMode.CUSTOM_PHRASE,
            customPhraseWords = listOf("apple", "banana", "cherry"),
            customPhraseWordCount = 3,
            quantity = 1
        )
        coEvery { customPhraseGenerator.generate(any()) } returns "apple-banana-cherry"
        every { applyCasingUseCase.invoke(any(), any()) } returns "apple-banana-cherry"
        every { placeCharactersUseCase.invoke(any(), any()) } returns "apple-banana-cherry"

        val results = useCase(settings)

        assertEquals(1, results.size)
        assertEquals("apple-banana-cherry", results[0].password)
        coVerify { customPhraseGenerator.generate(any()) }
    }
}
