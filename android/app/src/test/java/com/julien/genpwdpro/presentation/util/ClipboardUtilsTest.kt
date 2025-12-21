package com.julien.genpwdpro.presentation.util

import android.content.Context
import com.julien.genpwdpro.core.clipboard.ClipboardSanitizer
import com.julien.genpwdpro.data.secure.SensitiveActionPreferences
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkObject
import io.mockk.unmockkAll
import io.mockk.verify
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ClipboardUtilsTest {

    private lateinit var context: Context

    @Before
    fun setUp() {
        context = mockk(relaxed = true)
        mockkObject(ClipboardSanitizer)
        every { ClipboardSanitizer.sanitizeLabel(any()) } answers { callOriginal() }
        every { ClipboardSanitizer.sanitize(any<String>()) } answers { callOriginal() }
        every { ClipboardSanitizer.sanitize(any<CharArray>()) } answers { callOriginal() }
    }

    @After
    fun tearDown() {
        unmockkAll()
    }

    @Test
    fun `copySensitive sanitizes payload and schedules clear`() {
        val delegate = RecordingDelegate()
        val scheduler = RecordingScheduler()
        val rawLabel = "  pass\u200Bword  "
        val rawValue = "sec\u200Bret\u202E".toCharArray()

        ClipboardUtils.copySensitive(
            context = context,
            label = rawLabel,
            value = rawValue,
            delegate = delegate,
            scheduler = scheduler
        )

        verify { ClipboardSanitizer.sanitizeLabel(rawLabel) }
        // Note: We verify sanitize was called but can't match exact content
        // because the CharArray is wiped after the call (SecretUtils.wipe)
        verify { ClipboardSanitizer.sanitize(any<CharArray>()) }

        val expectedLabel = ClipboardSanitizer.sanitizeLabel(rawLabel)
        val expectedValue = ClipboardSanitizer.sanitize("sec\u200Bret\u202E")

        assertEquals(expectedLabel, delegate.publishedLabel)
        assertEquals(expectedValue, delegate.publishedValue)
        assertEquals(
            SensitiveActionPreferences.DEFAULT_CLIPBOARD_TTL_MS,
            scheduler.delayMs.get()
        )
        assertTrue("Clipboard clear callback should run", delegate.cleared.get())
        assertTrue(rawValue.all { it == '\u0000' })
    }

    private class RecordingDelegate : ClipboardUtils.ClipboardDelegate {
        var publishedLabel: String? = null
        var publishedValue: String? = null
        val cleared = AtomicBoolean(false)
        private val hasClip = AtomicBoolean(false)

        override fun setPrimaryClip(label: CharSequence, text: CharSequence) {
            publishedLabel = label.toString()
            publishedValue = text.toString()
            hasClip.set(true)
        }

        override fun hasPrimaryClip(): Boolean = hasClip.get()

        override fun clearPrimaryClip() {
            hasClip.set(false)
            cleared.set(true)
        }
    }

    private class RecordingScheduler : ClipboardUtils.ClearScheduler {
        val delayMs = AtomicLong(0)

        override fun schedule(delayMs: Long, block: () -> Unit) {
            this.delayMs.set(delayMs)
            block()
        }
    }
}
