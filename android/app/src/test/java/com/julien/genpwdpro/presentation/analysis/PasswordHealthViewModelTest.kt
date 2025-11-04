package com.julien.genpwdpro.presentation.analysis

import com.julien.genpwdpro.data.local.entity.EntryType
import com.julien.genpwdpro.data.repository.VaultRepository
import com.julien.genpwdpro.data.services.BreachCheckResult
import com.julien.genpwdpro.data.services.HaveIBeenPwnedService
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
 * Tests unitaires pour PasswordHealthViewModel
 *
 * Tests :
 * - Analyse de santé du vault
 * - Détection des mots de passe faibles
 * - Détection des mots de passe réutilisés
 * - Intégration HIBP pour mots de passe compromis
 * - Calcul du score de santé
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PasswordHealthViewModelTest {

    private lateinit var viewModel: PasswordHealthViewModel
    private lateinit var vaultRepository: VaultRepository
    private lateinit var hibpService: HaveIBeenPwnedService
    private val testDispatcher = StandardTestDispatcher()

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        vaultRepository = mockk(relaxed = true)
        hibpService = mockk(relaxed = true)

        viewModel = PasswordHealthViewModel(vaultRepository, hibpService)
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

        coEvery { vaultRepository.getEntries(vaultId) } returns flowOf(entries)
        coEvery { hibpService.checkPassword(any()) } returns BreachCheckResult.Safe

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

        coEvery { vaultRepository.getEntries(vaultId) } returns flowOf(entries)
        coEvery { hibpService.checkPassword(any()) } returns BreachCheckResult.Safe

        // Act
        viewModel.analyzeVaultHealth(vaultId)
        testDispatcher.scheduler.advanceUntilIdle()

        // Assert
        val state = viewModel.uiState.value as HealthUiState.Success
        assertEquals(1, state.reusedPasswords.size)
        assertEquals(2, state.reusedPasswords[0].count)
    }

    @Test
    fun `analyzeVaultHealth detects compromised passwords`() = runTest {
        // Arrange
        val vaultId = "test-vault"
        val compromisedPassword = "password"

        val entries = listOf(
            createMockEntry("entry1", compromisedPassword, 50),
            createMockEntry("entry2", "SecurePassword123!", 85)
        )

        coEvery { vaultRepository.getEntries(vaultId) } returns flowOf(entries)
        coEvery { hibpService.checkPassword(compromisedPassword) } returns BreachCheckResult.Breached(123456)
        coEvery { hibpService.checkPassword("SecurePassword123!") } returns BreachCheckResult.Safe

        // Act
        viewModel.analyzeVaultHealth(vaultId)
        testDispatcher.scheduler.advanceUntilIdle()

        // Assert
        val state = viewModel.uiState.value as HealthUiState.Success
        assertEquals(1, state.compromisedPasswords.size)
        assertEquals("entry1", state.compromisedPasswords[0].id)
        assertEquals(123456, state.compromisedPasswords[0].breachCount)
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

        coEvery { vaultRepository.getEntries(vaultId) } returns flowOf(entries)
        coEvery { hibpService.checkPassword(any()) } returns BreachCheckResult.Safe

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
    fun `analyzeVaultHealth calculates correct health score`() = runTest {
        // Arrange
        val vaultId = "test-vault"
        val entries = listOf(
            createMockEntry("entry1", "WeakPassword", 40),      // Weak
            createMockEntry("entry2", "password", 30),           // Weak + Breached
            createMockEntry("entry3", "VerySecure123!", 90),    // Good
            createMockEntry("entry4", "VerySecure123!", 90)     // Reused
        )

        coEvery { vaultRepository.getEntries(vaultId) } returns flowOf(entries)
        coEvery { hibpService.checkPassword("WeakPassword") } returns BreachCheckResult.Safe
        coEvery { hibpService.checkPassword("password") } returns BreachCheckResult.Breached(3000000)
        coEvery { hibpService.checkPassword("VerySecure123!") } returns BreachCheckResult.Safe

        // Act
        viewModel.analyzeVaultHealth(vaultId)
        testDispatcher.scheduler.advanceUntilIdle()

        // Assert
        val state = viewModel.uiState.value as HealthUiState.Success
        assertTrue(state.healthScore in 0..100)
        // Score should be reduced due to weak, compromised, and reused passwords
        assertTrue(state.healthScore < 70)
    }

    @Test
    fun `analyzeVaultHealth handles HIBP service errors gracefully`() = runTest {
        // Arrange
        val vaultId = "test-vault"
        val entries = listOf(
            createMockEntry("entry1", "TestPassword", 70)
        )

        coEvery { vaultRepository.getEntries(vaultId) } returns flowOf(entries)
        coEvery { hibpService.checkPassword(any()) } throws Exception("Network error")

        // Act
        viewModel.analyzeVaultHealth(vaultId)
        testDispatcher.scheduler.advanceUntilIdle()

        // Assert
        // Should complete successfully even if HIBP fails
        val state = viewModel.uiState.value
        assertTrue(state is HealthUiState.Success)
    }

    @Test
    fun `analyzeVaultHealth ignores non-login entries`() = runTest {
        // Arrange
        val vaultId = "test-vault"
        val entries = listOf(
            VaultRepository.DecryptedEntry(
                id = "note1",
                vaultId = vaultId,
                entryType = EntryType.NOTE,
                title = "Secure Note",
                username = "",
                password = "",
                url = "",
                notes = "This is a secure note",
                passwordStrength = 0,
                isFavorite = false,
                createdAt = System.currentTimeMillis(),
                modifiedAt = System.currentTimeMillis()
            ),
            createMockEntry("login1", "TestPassword", 75)
        )

        coEvery { vaultRepository.getEntries(vaultId) } returns flowOf(entries)
        coEvery { hibpService.checkPassword(any()) } returns BreachCheckResult.Safe

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
        coEvery { vaultRepository.getEntries(vaultId) } returns flowOf(emptyList())

        // Act
        viewModel.analyzeVaultHealth(vaultId)
        testDispatcher.scheduler.advanceUntilIdle()

        // Assert
        val state = viewModel.uiState.value as HealthUiState.Success
        assertEquals(100, state.healthScore) // Empty vault = perfect score
        assertEquals(0, state.statistics.totalPasswords)
        assertEquals(0, state.weakPasswords.size)
        assertEquals(0, state.reusedPasswords.size)
        assertEquals(0, state.compromisedPasswords.size)
    }

    @Test
    fun `analyzeVaultHealth handles repository errors`() = runTest {
        // Arrange
        val vaultId = "error-vault"
        coEvery { vaultRepository.getEntries(vaultId) } throws Exception("Database error")

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
        modifiedAt: Long = System.currentTimeMillis()
    ): VaultRepository.DecryptedEntry {
        return VaultRepository.DecryptedEntry(
            id = id,
            vaultId = "test-vault",
            entryType = EntryType.LOGIN,
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
