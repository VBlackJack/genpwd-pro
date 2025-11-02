package com.julien.genpwdpro.data.repository

import com.julien.genpwdpro.data.db.dao.VaultRegistryDao
import com.julien.genpwdpro.domain.session.VaultSessionManager
import com.julien.genpwdpro.security.BiometricVaultManager
import io.mockk.MockKAnnotations
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.impl.annotations.MockK
import io.mockk.mockk
import kotlin.test.assertTrue
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class FileVaultRepositoryTest {

    @MockK(relaxed = true)
    private lateinit var vaultSessionManager: VaultSessionManager

    @MockK(relaxed = true)
    private lateinit var vaultRegistryDao: VaultRegistryDao

    @MockK(relaxed = true)
    private lateinit var biometricVaultManager: BiometricVaultManager

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
    fun `unlockVault delegates to session manager`() = runTest {
        val vaultId = "test-vault-123"
        val password = "SecurePass123!"

        coEvery { vaultSessionManager.unlockVault(vaultId, password) } returns Result.success(Unit)

        val result = repository.unlockVault(vaultId, password)

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { vaultSessionManager.unlockVault(vaultId, password) }
    }

    @Test
    fun `lockVault delegates to session manager`() = runTest {
        repository.lockVault()

        coVerify(exactly = 1) { vaultSessionManager.lockVault() }
    }

    @Test
    fun `unlockVaultWithBiometric unlocks session with returned password`() = runTest {
        val vaultId = "vault-1"
        val password = "Secret!"

        coEvery { biometricVaultManager.unlockWithBiometric(any(), vaultId) } returns Result.success(password)
        coEvery { vaultSessionManager.unlockVault(vaultId, password) } returns Result.success(Unit)

        val result = repository.unlockVaultWithBiometric(mockk(relaxed = true), vaultId)

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { vaultSessionManager.unlockVault(vaultId, password) }
    }

    private fun createRepository(): FileVaultRepository {
        return FileVaultRepository(
            vaultSessionManager = vaultSessionManager,
            vaultRegistryDao = vaultRegistryDao,
            biometricVaultManager = biometricVaultManager
        )
    }
}
