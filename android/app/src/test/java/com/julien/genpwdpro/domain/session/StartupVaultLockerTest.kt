package com.julien.genpwdpro.domain.session

import android.util.Log
import com.julien.genpwdpro.data.local.dao.VaultRegistryDao
import io.mockk.coEvery
import io.mockk.coJustRun
import io.mockk.coVerify
import io.mockk.every
import io.mockk.justRun
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.unmockkAll
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Before
import org.junit.Test

class StartupVaultLockerTest {

    private lateinit var sessionManager: SessionManager
    private lateinit var vaultSessionManager: VaultSessionManager
    private lateinit var vaultRegistryDao: VaultRegistryDao

    private lateinit var locker: StartupVaultLocker

    @Before
    fun setUp() {
        mockkStatic(Log::class)
        every { Log.d(any(), any()) } returns 0
        every { Log.e(any(), any(), any()) } returns 0

        sessionManager = mockk(relaxed = true)
        vaultSessionManager = mockk()
        vaultRegistryDao = mockk()

        locker = StartupVaultLocker(sessionManager, vaultSessionManager, vaultRegistryDao)
    }

    @After
    fun tearDown() {
        unmockkAll()
    }

    @Test
    fun `lockAllVaultsOnStartup locks sessions and resets flags`() = runTest {
        justRun { sessionManager.lockVault() }
        coJustRun { vaultSessionManager.lockVault() }
        coJustRun { vaultRegistryDao.resetAllLoadedFlags() }

        locker.lockAllVaultsOnStartup()

        io.mockk.verify { sessionManager.lockVault() }
        coVerify { vaultSessionManager.lockVault() }
        coVerify { vaultRegistryDao.resetAllLoadedFlags() }
    }

    @Test
    fun `lockAllVaultsOnStartup resets flags even when vault locking fails`() = runTest {
        justRun { sessionManager.lockVault() }
        coJustRun { vaultRegistryDao.resetAllLoadedFlags() }
        io.mockk.coEvery { vaultSessionManager.lockVault() } throws IllegalStateException("boom")

        locker.lockAllVaultsOnStartup()

        io.mockk.verify { sessionManager.lockVault() }
        coVerify { vaultSessionManager.lockVault() }
        coVerify { vaultRegistryDao.resetAllLoadedFlags() }
    }
}
