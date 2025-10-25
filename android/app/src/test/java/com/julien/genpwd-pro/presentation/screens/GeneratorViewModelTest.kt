package com.julien.genpwd-pro.presentation.screens

import com.julien.genpwd-pro.data.local.preferences.SettingsDataStore
import com.julien.genpwd-pro.data.models.*
import com.julien.genpwd-pro.data.repository.PasswordHistoryRepository
import com.julien.genpwd-pro.domain.usecases.GeneratePasswordUseCase
import io.mockk.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.*
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests pour GeneratorViewModel
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GeneratorViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var generatePasswordUseCase: GeneratePasswordUseCase
    private lateinit var historyRepository: PasswordHistoryRepository
    private lateinit var settingsDataStore: SettingsDataStore
    private lateinit var viewModel: GeneratorViewModel

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        generatePasswordUseCase = mockk(relaxed = true)
        historyRepository = mockk(relaxed = true)
        settingsDataStore = mockk(relaxed = true)

        // Mock settings flow
        every { settingsDataStore.settingsFlow } returns flowOf(Settings())

        viewModel = GeneratorViewModel(
            generatePasswordUseCase,
            historyRepository,
            settingsDataStore
        )

        // Run pending coroutines from init block
        testDispatcher.scheduler.advanceUntilIdle()
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial state is correct`() {
        val state = viewModel.uiState.value

        assertFalse(state.isGenerating)
        assertNull(state.error)
        assertTrue(state.results.isEmpty())
        assertTrue(state.expandedSections.contains(Section.MAIN_OPTIONS))
        assertTrue(state.expandedSections.contains(Section.CHARACTERS))
    }

    @Test
    fun `generatePasswords updates state correctly`() = runTest {
        val expectedResult = createPasswordResult("test123")
        every { generatePasswordUseCase.invoke(any()) } returns listOf(expectedResult)
        coEvery { historyRepository.savePasswords(any()) } just Runs

        viewModel.generatePasswords()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isGenerating)
        assertEquals(1, state.results.size)
        assertEquals("test123", state.results[0].password)
        assertNull(state.error)

        coVerify { historyRepository.savePasswords(listOf(expectedResult)) }
    }

    @Test
    fun `generatePasswords handles errors`() = runTest {
        every { generatePasswordUseCase.invoke(any()) } throws RuntimeException("Test error")

        viewModel.generatePasswords()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isGenerating)
        assertEquals("Test error", state.error)
        assertTrue(state.results.isEmpty())

        coVerify(exactly = 0) { historyRepository.savePasswords(any()) }
    }

    @Test
    fun `generatePasswords sets isGenerating during generation`() = runTest {
        val results = listOf(createPasswordResult("test"))
        every { generatePasswordUseCase.invoke(any()) } returns results
        coEvery { historyRepository.savePasswords(any()) } just Runs

        // État avant génération
        assertFalse(viewModel.uiState.value.isGenerating)

        viewModel.generatePasswords()

        // Laisser le temps de démarrer
        testDispatcher.scheduler.runCurrent()

        // Devrait être en cours de génération
        assertTrue(viewModel.uiState.value.isGenerating)

        // Terminer
        testDispatcher.scheduler.advanceUntilIdle()

        // Ne devrait plus être en génération
        assertFalse(viewModel.uiState.value.isGenerating)
    }

    @Test
    fun `updateSettings updates state and persists`() = runTest {
        coEvery { settingsDataStore.saveSettings(any()) } just Runs

        val newMode = GenerationMode.PASSPHRASE
        viewModel.updateSettings { it.copy(mode = newMode) }
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(newMode, state.settings.mode)

        coVerify { settingsDataStore.saveSettings(match { it.mode == newMode }) }
    }

    @Test
    fun `updateSettings validates settings`() = runTest {
        coEvery { settingsDataStore.saveSettings(any()) } just Runs

        // Essayer de définir une longueur invalide
        viewModel.updateSettings { it.copy(syllablesLength = -10) }
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        // La validation devrait corriger la valeur
        assertTrue(state.settings.syllablesLength >= 4)
    }

    @Test
    fun `toggleMask toggles specific result`() {
        // D'abord, générer quelques résultats
        val results = listOf(
            createPasswordResult("pass1", id = "id1"),
            createPasswordResult("pass2", id = "id2")
        )
        every { generatePasswordUseCase.invoke(any()) } returns results
        coEvery { historyRepository.savePasswords(any()) } just Runs

        viewModel.generatePasswords()
        testDispatcher.scheduler.advanceUntilIdle()

        // Les résultats devraient être non masqués par défaut
        assertFalse(viewModel.uiState.value.results[0].isMasked)

        // Basculer le masque du premier
        viewModel.toggleMask("id1")

        val state = viewModel.uiState.value
        assertTrue(state.results[0].isMasked)
        assertFalse(state.results[1].isMasked) // Le deuxième ne devrait pas changer
    }

    @Test
    fun `toggleMask only affects specified result`() {
        val results = listOf(
            createPasswordResult("pass1", id = "id1", isMasked = false),
            createPasswordResult("pass2", id = "id2", isMasked = false),
            createPasswordResult("pass3", id = "id3", isMasked = false)
        )
        every { generatePasswordUseCase.invoke(any()) } returns results
        coEvery { historyRepository.savePasswords(any()) } just Runs

        viewModel.generatePasswords()
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.toggleMask("id2")

        val state = viewModel.uiState.value
        assertFalse(state.results[0].isMasked)
        assertTrue(state.results[1].isMasked)
        assertFalse(state.results[2].isMasked)
    }

    @Test
    fun `clearResults empties results list`() {
        val results = listOf(createPasswordResult("test"))
        every { generatePasswordUseCase.invoke(any()) } returns results
        coEvery { historyRepository.savePasswords(any()) } just Runs

        viewModel.generatePasswords()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(1, viewModel.uiState.value.results.size)

        viewModel.clearResults()

        assertTrue(viewModel.uiState.value.results.isEmpty())
    }

    @Test
    fun `toggleSection expands collapsed section`() {
        // Initialement, CASING n'est pas étendu
        assertFalse(viewModel.uiState.value.expandedSections.contains(Section.CASING))

        viewModel.toggleSection(Section.CASING)

        assertTrue(viewModel.uiState.value.expandedSections.contains(Section.CASING))
    }

    @Test
    fun `toggleSection collapses expanded section`() {
        // Initialement, MAIN_OPTIONS est étendu
        assertTrue(viewModel.uiState.value.expandedSections.contains(Section.MAIN_OPTIONS))

        viewModel.toggleSection(Section.MAIN_OPTIONS)

        assertFalse(viewModel.uiState.value.expandedSections.contains(Section.MAIN_OPTIONS))
    }

    @Test
    fun `toggleSection can be called multiple times`() {
        viewModel.toggleSection(Section.CASING)
        assertTrue(viewModel.uiState.value.expandedSections.contains(Section.CASING))

        viewModel.toggleSection(Section.CASING)
        assertFalse(viewModel.uiState.value.expandedSections.contains(Section.CASING))

        viewModel.toggleSection(Section.CASING)
        assertTrue(viewModel.uiState.value.expandedSections.contains(Section.CASING))
    }

    // Helper function
    private fun createPasswordResult(
        password: String,
        id: String = "test-id",
        isMasked: Boolean = false
    ): PasswordResult {
        return PasswordResult(
            id = id,
            password = password,
            entropy = 64.0,
            mode = GenerationMode.SYLLABLES,
            timestamp = System.currentTimeMillis(),
            settings = Settings(),
            isMasked = isMasked
        )
    }
}
