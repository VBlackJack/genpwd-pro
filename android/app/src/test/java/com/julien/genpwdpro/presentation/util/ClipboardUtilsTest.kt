package com.julien.genpwdpro.presentation.util

import android.content.Context
import com.julien.genpwdpro.presentation.util.ClipboardUtils.ClearScheduler
import com.julien.genpwdpro.presentation.util.ClipboardUtils.ClipboardDelegate
import io.mockk.mockk
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class ClipboardUtilsTest {

    private lateinit var fakeDelegate: RecordingClipboardDelegate
    private lateinit var fakeScheduler: RecordingScheduler
    private lateinit var originalDelegateFactory: (Context) -> ClipboardDelegate
    private lateinit var originalSchedulerFactory: () -> ClearScheduler
    private val context: Context = mockk(relaxed = true)

    @Before
    fun setUp() {
        originalDelegateFactory = ClipboardUtils.delegateFactory
        originalSchedulerFactory = ClipboardUtils.schedulerFactory
        fakeDelegate = RecordingClipboardDelegate()
        fakeScheduler = RecordingScheduler()
        ClipboardUtils.delegateFactory = { fakeDelegate }
        ClipboardUtils.schedulerFactory = { fakeScheduler }
    }

    @After
    fun tearDown() {
        ClipboardUtils.delegateFactory = originalDelegateFactory
        ClipboardUtils.schedulerFactory = originalSchedulerFactory
    }

    @Test
    fun `copySensitive sanitizes payload and clears buffers`() {
        val original = charArrayOf('a', '\u200B', 'b', '\u202E', 'c')

        ClipboardUtils.copySensitive(
            context = context,
            label = "  password\n",
            value = original,
            ttlMs = 0L
        )

        assertEquals("password", fakeDelegate.lastLabel)
        assertEquals("abc", fakeDelegate.lastText)
        assertArrayEquals(charArrayOf('\u0000', '\u0000', '\u0000', '\u0000', '\u0000'), original)
    }

    @Test
    fun `copySensitive schedules clipboard clearing`() {
        val original = charArrayOf('1', '2', '3', '4', '5', '6')

        ClipboardUtils.copySensitive(
            context = context,
            label = "otp",
            value = original,
            ttlMs = 1_000L
        )

        assertEquals(1, fakeScheduler.scheduledCallbacks.size)
        fakeScheduler.scheduledCallbacks.first().invoke()
        assertEquals(true, fakeDelegate.cleared)
    }

    private class RecordingClipboardDelegate : ClipboardDelegate {
        var lastLabel: String? = null
        var lastText: String? = null
        var cleared: Boolean = false

        override fun setPrimaryClip(label: CharSequence, text: CharSequence) {
            lastLabel = label.toString()
            lastText = text.toString()
            cleared = false
        }

        override fun hasPrimaryClip(): Boolean = !cleared && lastText != null

        override fun clearPrimaryClip() {
            cleared = true
        }
    }

    private class RecordingScheduler : ClearScheduler {
        val scheduledCallbacks = mutableListOf<() -> Unit>()

        override fun schedule(delayMs: Long, block: () -> Unit) {
            scheduledCallbacks += block
        }
    }

}
