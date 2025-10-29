package com.julien.genpwdpro.domain.session

import com.julien.genpwdpro.data.db.dao.VaultRegistryDao
import io.mockk.MockKAnnotations
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.impl.annotations.MockK
import io.mockk.verify
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class VaultStartupLockerTest {

    @MockK(relaxed = true)
    private lateinit var vaultSessionManager: VaultSessionManager

    @MockK(relaxed = true)
    private lateinit var sessionManager: SessionManager

    @MockK
    private lateinit var vaultRegistryDao: VaultRegistryDao

    private lateinit var locker: VaultStartupLocker

    @Before
    fun setUp() {
        MockKAnnotations.init(this, relaxUnitFun = true)
        locker = VaultStartupLocker(
            vaultSessionManager = vaultSessionManager,
            sessionManager = sessionManager,
            vaultRegistryDao = vaultRegistryDao,
            ioDispatcher = UnconfinedTestDispatcher()
        )
    }

    @Test
    fun `secureStartup locks sessions and resets registry`() = runTest {
        coEvery { vaultRegistryDao.resetAllLoadedFlags() } returns Unit

        val result = locker.secureStartup()

        coVerify(exactly = 1) { vaultSessionManager.lockVault() }
        verify(exactly = 1) { sessionManager.lockVault() }
        coVerify(exactly = 1) { vaultRegistryDao.resetAllLoadedFlags() }
        assertTrue(result.isSecure)
        assertTrue(result.registryResetSucceeded)
        assertFalse(result.fallbackApplied)
        assertTrue(result.errors.isEmpty())
    }

    @Test
    fun `secureStartup applies fallback when registry reset keeps failing`() = runTest {
        coEvery { vaultRegistryDao.resetAllLoadedFlags() } throws IllegalStateException("db locked")
        coEvery { vaultRegistryDao.getLoadedVaultIds() } returns listOf("vault-a", "vault-b")
        coEvery { vaultRegistryDao.updateLoadedStatus(any(), any()) } returns Unit

        val result = locker.secureStartup()

        coVerify(exactly = 2) { vaultRegistryDao.resetAllLoadedFlags() }
        coVerify { vaultRegistryDao.getLoadedVaultIds() }
        coVerify { vaultRegistryDao.updateLoadedStatus("vault-a", false) }
        coVerify { vaultRegistryDao.updateLoadedStatus("vault-b", false) }
        assertTrue(result.fallbackApplied)
        assertTrue(result.isSecure)
        assertFalse(result.registryResetSucceeded)
        assertTrue(result.errors.isNotEmpty())
    }

    @Test
    fun `secureStartup reports failure when fallback also fails`() = runTest {
        val throwable = IllegalStateException("db locked")
        coEvery { vaultRegistryDao.resetAllLoadedFlags() } throws throwable
        coEvery { vaultRegistryDao.getLoadedVaultIds() } throws throwable

        val result = locker.secureStartup()

        assertFalse(result.registryResetSucceeded)
        assertFalse(result.fallbackApplied)
        assertFalse(result.errors.isEmpty())
        assertFalse(result.isSecure)
        coVerify { vaultRegistryDao.resetAllLoadedFlags() }
        coVerify { vaultRegistryDao.getLoadedVaultIds() }
        verify { sessionManager.lockVault() }
        coVerify { vaultSessionManager.lockVault() }
        coVerify(exactly = 0) { vaultRegistryDao.updateLoadedStatus(any(), any()) }
    }
}
