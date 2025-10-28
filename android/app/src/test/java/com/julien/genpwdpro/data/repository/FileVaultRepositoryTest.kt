package com.julien.genpwdpro.data.repository

import com.julien.genpwdpro.data.local.dao.VaultRegistryDao
import com.julien.genpwdpro.domain.session.VaultSessionManager
import com.julien.genpwdpro.security.BiometricVaultManager
import io.mockk.MockKAnnotations
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.impl.annotations.MockK
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Before
import org.junit.Test
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class FileVaultRepositoryTest {

    @MockK(relaxed = true)
    private lateinit var vaultSessionManager: VaultSessionManager

    @MockK(relaxed = true)
    private lateinit var vaultRegistryDao: VaultRegistryDao

    @MockK(relaxed = true)
    private lateinit var biometricVaultManager: BiometricVaultManager

    @MockK
    private lateinit var legacyVaultRepository: VaultRepository

    private lateinit var repository: FileVaultRepository

    @Before
    fun setUp() {
        MockKAnnotations.init(this, relaxUnitFun = true)
        repository = createRepository()
    }

    @After
    fun tearDown() {
        clearAllMocks()
    }

    @Test
    fun `when unlocking file vault, legacy vault is synchronized`() = runTest {
        val vaultId = "test-vault-123"
        val password = "SecurePass123!"

        coEvery { vaultSessionManager.unlockVault(vaultId, password) } returns Result.success(Unit)
        coEvery { legacyVaultRepository.unlockVault(vaultId, password) } returns true

        val result = repository.unlockVault(vaultId, password)

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { legacyVaultRepository.unlockVault(vaultId, password) }
    }

    @Test
    fun `when legacy sync fails, file vault continues to work`() = runTest {
        val vaultId = "test-vault-123"
        val password = "SecurePass123!"

        coEvery { vaultSessionManager.unlockVault(vaultId, password) } returns Result.success(Unit)
        coEvery { legacyVaultRepository.unlockVault(any(), any()) } throws RuntimeException("Room crash")

        val result = repository.unlockVault(vaultId, password)

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { legacyVaultRepository.unlockVault(vaultId, password) }
    }

    @Test
    fun `when legacy sync feature flag is disabled, legacy repository is not called`() = runTest {
        val vaultId = "test-vault-123"
        val password = "SecurePass123!"
        repository = createRepository(legacySyncEnabled = false)

        coEvery { vaultSessionManager.unlockVault(vaultId, password) } returns Result.success(Unit)

        val result = repository.unlockVault(vaultId, password)

        assertTrue(result.isSuccess)
        coVerify(exactly = 0) { legacyVaultRepository.unlockVault(any(), any()) }
    }

    private fun createRepository(legacySyncEnabled: Boolean = true): FileVaultRepository {
        return FileVaultRepository(
            vaultSessionManager = vaultSessionManager,
            vaultRegistryDao = vaultRegistryDao,
            biometricVaultManager = biometricVaultManager,
            legacyVaultRepository = legacyVaultRepository,
            legacySyncEnabled = legacySyncEnabled
        )
    }
}
