package com.julien.genpwdpro.domain.usecases

import com.julien.genpwdpro.data.models.CaseMode
import com.julien.genpwdpro.data.models.CharacterPlacement
import com.julien.genpwdpro.data.models.GenerationMode
import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.domain.generators.LeetSpeakGenerator
import com.julien.genpwdpro.domain.generators.PassphraseGenerator
import com.julien.genpwdpro.domain.generators.SyllablesGenerator
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests pour GeneratePasswordUseCase
 */
class GeneratePasswordUseCaseTest {

    private lateinit var syllablesGenerator: SyllablesGenerator
    private lateinit var passphraseGenerator: PassphraseGenerator
    private lateinit var leetSpeakGenerator: LeetSpeakGenerator
    private lateinit var applyCasingUseCase: ApplyCasingUseCase
    private lateinit var placeCharactersUseCase: PlaceCharactersUseCase
    private lateinit var useCase: GeneratePasswordUseCase

    @Before
    fun setup() {
        syllablesGenerator = mockk(relaxed = true)
        passphraseGenerator = mockk(relaxed = true)
        leetSpeakGenerator = mockk(relaxed = true)
        applyCasingUseCase = mockk(relaxed = true)
        placeCharactersUseCase = mockk(relaxed = true)

        useCase = GeneratePasswordUseCase(
            syllablesGenerator,
            passphraseGenerator,
            leetSpeakGenerator,
            applyCasingUseCase,
            placeCharactersUseCase
        )
    }

    @Test
    fun `invoke with SYLLABLES mode calls syllables generator`() {
        val settings = Settings(mode = GenerationMode.SYLLABLES)
        every { syllablesGenerator.generate(settings) } returns "testpassword"
        every { applyCasingUseCase.invoke(any(), settings) } returns "testpassword"
        every { placeCharactersUseCase.invoke(any(), settings) } returns "testpassword"

        val result = useCase(settings)

        assertEquals("testpassword", result)
        verify { syllablesGenerator.generate(settings) }
        verify { applyCasingUseCase.invoke(any(), settings) }
        verify { placeCharactersUseCase.invoke(any(), settings) }
    }

    @Test
    fun `invoke with PASSPHRASE mode calls passphrase generator`() {
        val settings = Settings(mode = GenerationMode.PASSPHRASE)
        every { passphraseGenerator.generate(settings) } returns "correct-horse-battery-staple"
        every { applyCasingUseCase.invoke(any(), settings) } returns "correct-horse-battery-staple"
        every { placeCharactersUseCase.invoke(any(), settings) } returns "correct-horse-battery-staple"

        val result = useCase(settings)

        assertEquals("correct-horse-battery-staple", result)
        verify { passphraseGenerator.generate(settings) }
        verify { applyCasingUseCase.invoke(any(), settings) }
        verify { placeCharactersUseCase.invoke(any(), settings) }
    }

    @Test
    fun `invoke with LEET mode calls leet speak generator`() {
        val settings = Settings(mode = GenerationMode.LEET)
        every { leetSpeakGenerator.generate(settings) } returns "73571337"
        every { applyCasingUseCase.invoke(any(), settings) } returns "73571337"
        every { placeCharactersUseCase.invoke(any(), settings) } returns "73571337"

        val result = useCase(settings)

        assertEquals("73571337", result)
        verify { leetSpeakGenerator.generate(settings) }
        verify { applyCasingUseCase.invoke(any(), settings) }
        verify { placeCharactersUseCase.invoke(any(), settings) }
    }

    @Test
    fun `invoke applies casing transformation`() {
        val settings = Settings(
            mode = GenerationMode.SYLLABLES,
            caseMode = CaseMode.UPPER
        )
        every { syllablesGenerator.generate(settings) } returns "password"
        every { applyCasingUseCase.invoke("password", settings) } returns "PASSWORD"
        every { placeCharactersUseCase.invoke("PASSWORD", settings) } returns "PASSWORD"

        val result = useCase(settings)

        assertEquals("PASSWORD", result)
        verify { applyCasingUseCase.invoke("password", settings) }
    }

    @Test
    fun `invoke applies character placement`() {
        val settings = Settings(
            mode = GenerationMode.SYLLABLES,
            digitsCount = 2,
            specialsCount = 2
        )
        every { syllablesGenerator.generate(settings) } returns "password"
        every { applyCasingUseCase.invoke(any(), settings) } returns "password"
        every { placeCharactersUseCase.invoke("password", settings) } returns "12password!@"

        val result = useCase(settings)

        assertEquals("12password!@", result)
        verify { placeCharactersUseCase.invoke("password", settings) }
    }

    @Test
    fun `invoke chains all transformations correctly`() {
        val settings = Settings(
            mode = GenerationMode.SYLLABLES,
            caseMode = CaseMode.UPPER,
            digitsCount = 2,
            digitsPosition = CharacterPlacement.END
        )

        every { syllablesGenerator.generate(settings) } returns "password"
        every { applyCasingUseCase.invoke("password", settings) } returns "PASSWORD"
        every { placeCharactersUseCase.invoke("PASSWORD", settings) } returns "PASSWORD12"

        val result = useCase(settings)

        assertEquals("PASSWORD12", result)

        // Vérifie l'ordre d'exécution
        verify(exactly = 1) { syllablesGenerator.generate(settings) }
        verify(exactly = 1) { applyCasingUseCase.invoke("password", settings) }
        verify(exactly = 1) { placeCharactersUseCase.invoke("PASSWORD", settings) }
    }

    @Test
    fun `invoke handles empty generator result`() {
        val settings = Settings(mode = GenerationMode.SYLLABLES)
        every { syllablesGenerator.generate(settings) } returns ""
        every { applyCasingUseCase.invoke("", settings) } returns ""
        every { placeCharactersUseCase.invoke("", settings) } returns "123"

        val result = useCase(settings)

        assertEquals("123", result)
    }

    @Test
    fun `invoke with different modes produces different results`() {
        val settingsSyllables = Settings(mode = GenerationMode.SYLLABLES)
        val settingsPassphrase = Settings(mode = GenerationMode.PASSPHRASE)

        every { syllablesGenerator.generate(settingsSyllables) } returns "syllable"
        every { passphraseGenerator.generate(settingsPassphrase) } returns "passphrase"
        every { applyCasingUseCase.invoke(any(), any()) } answers { firstArg() }
        every { placeCharactersUseCase.invoke(any(), any()) } answers { firstArg() }

        val result1 = useCase(settingsSyllables)
        val result2 = useCase(settingsPassphrase)

        assertNotEquals(result1, result2)
    }
}
