package com.julien.genpwdpro.presentation.analysis

import com.julien.genpwdpro.data.models.vault.EntryType
import com.julien.genpwdpro.data.models.vault.VaultEntryEntity
import com.julien.genpwdpro.data.repository.FileVaultRepository
import io.mockk.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.*
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Ignore
import org.junit.Test

/**
 * Tests unitaires pour PasswordHealthViewModel
 *
 * Tests :
 * - Analyse de santé du vault
 * - Détection des mots de passe faibles
 * - Détection des mots de passe réutilisés
 * - Calcul du score de santé
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PasswordHealthViewModelTest {

    private lateinit var viewModel: PasswordHealthViewModel
    private lateinit var fileVaultRepository: FileVaultRepository
    private val testDispatcher = StandardTestDispatcher()

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        fileVaultRepository = mockk(relaxed = true)

        viewModel = PasswordHealthViewModel(fileVaultRepository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
        unmockkAll()
    }

    @Test
    fun `initial state is Loading`() {
        // Assert
        assertTrue(viewModel.uiState.value is HealthUiState.Loading)
    }

    @Test
    fun `analyzeVaultHealth detects weak passwords`() = runTest {
        // Arrange
        val vaultId = "test-vault"
        val entries = listOf(
            createMockEntry("entry1", "Weak123", 40),
            createMockEntry("entry2", "VerySecurePassword123!", 90)
        )

        coEvery { fileVaultRepository.getEntries() } returns flowOf(entries)

        // Act
        viewModel.analyzeVaultHealth(vaultId)
        testDispatcher.scheduler.advanceUntilIdle()

        // Assert
        val state = viewModel.uiState.value as HealthUiState.Success
        assertEquals(1, state.weakPasswords.size)
        assertEquals("entry1", state.weakPasswords[0].id)
    }

    @Test
    fun `analyzeVaultHealth detects reused passwords`() = runTest {
        // Arrange
        val vaultId = "test-vault"
        val sharedPassword = "SharedPassword123!"

        val entries = listOf(
            createMockEntry("entry1", sharedPassword, 80),
            createMockEntry("entry2", sharedPassword, 80),
            createMockEntry("entry3", "UniquePassword", 85)
        )

        coEvery { fileVaultRepository.getEntries() } returns flowOf(entries)

        // Act
        viewModel.analyzeVaultHealth(vaultId)
        testDispatcher.scheduler.advanceUntilIdle()

        // Assert
        val state = viewModel.uiState.value as HealthUiState.Success
        assertEquals(1, state.reusedPasswords.size)
        assertEquals(2, state.reusedPasswords[0].count)
    }

    @Test
    fun `analyzeVaultHealth detects old passwords`() = runTest {
        // Arrange
        val vaultId = "test-vault"
        val now = System.currentTimeMillis()
        val ninetyOneDaysAgo = now - (91L * 24 * 60 * 60 * 1000)

        val entries = listOf(
            createMockEntry("entry1", "OldPassword", 70, ninetyOneDaysAgo),
            createMockEntry("entry2", "RecentPassword", 75, now)
        )

        coEvery { fileVaultRepository.getEntries() } returns flowOf(entries)

        // Act
        viewModel.analyzeVaultHealth(vaultId)
        testDispatcher.scheduler.advanceUntilIdle()

        // Assert
        val state = viewModel.uiState.value as HealthUiState.Success
        assertEquals(1, state.oldPasswords.size)
        assertEquals("entry1", state.oldPasswords[0].id)
        assertTrue(state.oldPasswords[0].daysSinceUpdate >= 91)
    }

    @Test
    @Ignore("TODO: Fix PasswordHealthViewModel score calculation logic")
    fun `analyzeVaultHealth calculates correct health score`() = runTest {
        // Arrange
        val vaultId = "test-vault"
        val entries = listOf(
            createMockEntry("entry1", "WeakPassword", 40),      // Weak
            createMockEntry("entry2", "password", 30),           // Weak
            createMockEntry("entry3", "VerySecure123!", 90),    // Good
            createMockEntry("entry4", "VerySecure123!", 90)     // Reused
        )

        coEvery { fileVaultRepository.getEntries() } returns flowOf(entries)

        // Act
        viewModel.analyzeVaultHealth(vaultId)
        testDispatcher.scheduler.advanceUntilIdle()

        // Assert
        val state = viewModel.uiState.value as HealthUiState.Success
        assertTrue(state.healthScore in 0..100)
        // Score should be reduced due to weak and reused passwords
        assertTrue(state.healthScore < 70)
    }

    @Test
    fun `analyzeVaultHealth ignores non-login entries`() = runTest {
        // Arrange
        val vaultId = "test-vault"
        val entries = listOf(
            createMockEntry("note1", "", 0, entryType = EntryType.NOTE.name),
            createMockEntry("login1", "TestPassword", 75)
        )

        coEvery { fileVaultRepository.getEntries() } returns flowOf(entries)

        // Act
        viewModel.analyzeVaultHealth(vaultId)
        testDispatcher.scheduler.advanceUntilIdle()

        // Assert
        val state = viewModel.uiState.value as HealthUiState.Success
        assertEquals(1, state.statistics.totalPasswords)
    }

    @Test
    fun `analyzeVaultHealth handles empty vault`() = runTest {
        // Arrange
        val vaultId = "empty-vault"
        coEvery { fileVaultRepository.getEntries() } returns flowOf(emptyList())

        // Act
        viewModel.analyzeVaultHealth(vaultId)
        testDispatcher.scheduler.advanceUntilIdle()

        // Assert
        val state = viewModel.uiState.value as HealthUiState.Success
        assertEquals(100, state.healthScore) // Empty vault = perfect score
        assertEquals(0, state.statistics.totalPasswords)
        assertEquals(0, state.weakPasswords.size)
        assertEquals(0, state.reusedPasswords.size)
    }

    @Test
    fun `analyzeVaultHealth handles repository errors`() = runTest {
        // Arrange
        val vaultId = "error-vault"
        coEvery { fileVaultRepository.getEntries() } throws Exception("Database error")

        // Act
        viewModel.analyzeVaultHealth(vaultId)
        testDispatcher.scheduler.advanceUntilIdle()

        // Assert
        val state = viewModel.uiState.value
        assertTrue(state is HealthUiState.Error)
        val errorState = state as HealthUiState.Error
        assertTrue(errorState.message.contains("Database error"))
    }

    // Helper method to create mock entries
    private fun createMockEntry(
        id: String,
        password: String,
        strength: Int,
        modifiedAt: Long = System.currentTimeMillis(),
        entryType: String = EntryType.LOGIN.name
    ): VaultEntryEntity {
        return VaultEntryEntity(
            id = id,
            vaultId = "test-vault",
            entryType = entryType,
            title = "Entry $id",
            username = "user@example.com",
            password = password,
            url = "https://example.com",
            notes = "",
            passwordStrength = strength,
            isFavorite = false,
            createdAt = System.currentTimeMillis(),
            modifiedAt = modifiedAt
        )
    }
}
