package com.julien.genpwdpro.domain.session

import androidx.lifecycle.LifecycleOwner
import io.mockk.MockKAnnotations
import io.mockk.coVerify
import io.mockk.impl.annotations.MockK
import io.mockk.verify
import org.junit.Before
import org.junit.Test

class AppLifecycleObserverTest {

    @MockK(relaxed = true)
    private lateinit var sessionManager: SessionManager

    @MockK(relaxed = true)
    private lateinit var vaultSessionManager: VaultSessionManager

    @MockK
    private lateinit var lifecycleOwner: LifecycleOwner

    private lateinit var observer: AppLifecycleObserver

    @Before
    fun setUp() {
        MockKAnnotations.init(this, relaxUnitFun = true)
        observer = AppLifecycleObserver(sessionManager, vaultSessionManager)
    }

    @Test
    fun `onStop locks vaults immediately`() {
        observer.onStop(lifecycleOwner)

        verify { sessionManager.lockVault() }
        coVerify { vaultSessionManager.lockVault() }
    }

    @Test
    fun `onStart after long background duration triggers additional lock`() {
        observer.onStop(lifecycleOwner)

        val field = AppLifecycleObserver::class.java.getDeclaredField("backgroundTimestamp")
        field.isAccessible = true
        val pastTimestamp = System.currentTimeMillis() - (10 * 60 * 1000)
        field.setLong(observer, pastTimestamp)

        observer.onStart(lifecycleOwner)

        verify(exactly = 2) { sessionManager.lockVault() }
        coVerify(exactly = 2) { vaultSessionManager.lockVault() }
    }
}
