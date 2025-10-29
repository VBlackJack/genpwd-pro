package com.julien.genpwdpro.data.secure

import io.mockk.Runs
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.verify
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class SensitiveActionPreferencesTest {

    private lateinit var securePrefs: SecurePrefs

    @Before
    fun setUp() {
        securePrefs = mockk(relaxed = true)
        every { securePrefs.getBoolean(SensitiveActionPreferences.KEY_REQUIRE_BIOMETRIC, false) } returns false
        every { securePrefs.getLong(SensitiveActionPreferences.KEY_CLIPBOARD_TTL_MS, SensitiveActionPreferences.DEFAULT_CLIPBOARD_TTL_MS) } returns SensitiveActionPreferences.DEFAULT_CLIPBOARD_TTL_MS
    }

    @Test
    fun `defaults use expected clipboard ttl`() {
        every { securePrefs.isUnlocked() } returns false

        val prefs = SensitiveActionPreferences(securePrefs)

        assertEquals(SensitiveActionPreferences.DEFAULT_CLIPBOARD_TTL_MS, prefs.currentClipboardTtlMs())
    }

    @Test
    fun `setClipboardTtlMs persists when storage unlocked`() {
        every { securePrefs.isUnlocked() } returns true
        every { securePrefs.putLong(SensitiveActionPreferences.KEY_CLIPBOARD_TTL_MS, 5_000L) } just Runs

        val prefs = SensitiveActionPreferences(securePrefs)

        val updated = prefs.setClipboardTtlMs(5_000L)

        assertTrue(updated)
        assertEquals(5_000L, prefs.currentClipboardTtlMs())
        verify { securePrefs.putLong(SensitiveActionPreferences.KEY_CLIPBOARD_TTL_MS, 5_000L) }
    }

    @Test
    fun `setClipboardTtlMs fails closed when storage locked`() {
        every { securePrefs.isUnlocked() } returns false

        val prefs = SensitiveActionPreferences(securePrefs)

        assertFalse(prefs.setClipboardTtlMs(2_000L))
        assertEquals(SensitiveActionPreferences.DEFAULT_CLIPBOARD_TTL_MS, prefs.currentClipboardTtlMs())
        verify(exactly = 0) { securePrefs.putLong(any(), any()) }
    }
}
