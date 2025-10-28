package com.julien.genpwdpro.domain.session

import android.util.Log
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import io.mockk.coJustRun
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.unmockkAll
import org.junit.After
import org.junit.Before
import org.junit.Test

class AppLifecycleObserverTest {

    private lateinit var sessionManager: SessionManager
    private lateinit var vaultSessionManager: VaultSessionManager

    @Before
    fun setUp() {
        mockkStatic(Log::class)
        every { Log.d(any(), any()) } returns 0
        every { Log.e(any(), any(), any()) } returns 0

        sessionManager = mockk(relaxed = true)
        vaultSessionManager = mockk()
    }

    @After
    fun tearDown() {
        unmockkAll()
    }

    @Test
    fun `onStop locks vaults immediately`() {
        coJustRun { vaultSessionManager.lockVault() }
        val observer = AppLifecycleObserver(sessionManager, vaultSessionManager)
        val owner = mockk<LifecycleOwner>()

        observer.onStop(owner)

        io.mockk.verify { sessionManager.lockVault() }
        coVerify { vaultSessionManager.lockVault() }
    }

    @Test
    fun `lifecycle events trigger locks when owner stops`() {
        coJustRun { vaultSessionManager.lockVault() }
        val observer = AppLifecycleObserver(sessionManager, vaultSessionManager)
        val owner = TestLifecycleOwner()

        owner.lifecycle.addObserver(observer)
        owner.handleEvent(Lifecycle.Event.ON_CREATE)
        owner.handleEvent(Lifecycle.Event.ON_START)
        owner.handleEvent(Lifecycle.Event.ON_STOP)

        io.mockk.verify { sessionManager.lockVault() }
        coVerify { vaultSessionManager.lockVault() }
    }

    private class TestLifecycleOwner : LifecycleOwner {
        private val registry = LifecycleRegistry(this)

        override fun getLifecycle(): Lifecycle = registry

        fun handleEvent(event: Lifecycle.Event) {
            registry.handleLifecycleEvent(event)
        }
    }
}
