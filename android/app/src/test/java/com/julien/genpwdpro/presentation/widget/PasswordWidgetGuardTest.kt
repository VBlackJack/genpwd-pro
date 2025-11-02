package com.julien.genpwdpro.presentation.widget

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import androidx.core.content.IntentCompat
import com.julien.genpwdpro.core.log.SafeLog
import io.mockk.Runs
import io.mockk.any
import io.mockk.every
import io.mockk.just
import io.mockk.match
import io.mockk.mockk
import io.mockk.mockkObject
import io.mockk.mockkStatic
import io.mockk.spyk
import io.mockk.unmockkAll
import io.mockk.verify
import org.junit.After
import org.junit.Before
import org.junit.Test

class PasswordWidgetGuardTest {

    private val context = mockk<Context>(relaxed = true)

    @Before
    fun setUp() {
        every { context.packageName } returns TEST_PACKAGE
        mockkObject(PasswordWidgetGuards)
        mockkObject(SafeLog)
        mockkStatic(IntentCompat::class)
        every { SafeLog.w(any(), any(), any()) } just Runs
        every { SafeLog.w(any(), any()) } just Runs
        every { IntentCompat.getSenderPackage(any()) } returns TEST_PACKAGE
    }

    @After
    fun tearDown() {
        unmockkAll()
    }

    @Test
    fun `rejects broadcasts that are not from the system uid on modern api`() {
        val widget = spyk(PasswordWidget(), recordPrivateCalls = true)
        val intent = Intent(context, PasswordWidget::class.java).apply {
            action = PasswordWidget.ACTION_GENERATE
        }

        every { PasswordWidgetGuards.currentSdkInt() } returns Build.VERSION_CODES.Q
        every { PasswordWidgetGuards.callingUid() } returns Process.SYSTEM_UID + 1
        every { widget["generatePassword"](any<Context>()) } just Runs

        widget.onReceive(context, intent)

        verify(exactly = 0) { widget["generatePassword"](context) }
        verify { SafeLog.w("PasswordWidget", match { it.contains("UID") }, any()) }
    }

    @Test
    fun `allows broadcasts from the system uid`() {
        val widget = spyk(PasswordWidget(), recordPrivateCalls = true)
        val intent = Intent(context, PasswordWidget::class.java).apply {
            action = PasswordWidget.ACTION_GENERATE
        }

        every { PasswordWidgetGuards.currentSdkInt() } returns Build.VERSION_CODES.Q
        every { PasswordWidgetGuards.callingUid() } returns Process.SYSTEM_UID
        every { widget["generatePassword"](any<Context>()) } just Runs

        widget.onReceive(context, intent)

        verify(exactly = 1) { widget["generatePassword"](context) }
        verify(exactly = 0) { SafeLog.w("PasswordWidget", any(), any()) }
    }

    @Test
    fun `falls back to package checks on legacy api levels`() {
        val widget = spyk(PasswordWidget(), recordPrivateCalls = true)
        val intent = Intent(context, PasswordWidget::class.java).apply {
            action = PasswordWidget.ACTION_GENERATE
        }

        every { PasswordWidgetGuards.currentSdkInt() } returns Build.VERSION_CODES.P
        every { PasswordWidgetGuards.callingUid() } returns Process.SYSTEM_UID
        every { IntentCompat.getSenderPackage(any()) } returns MALICIOUS_PACKAGE
        every { widget["generatePassword"](any<Context>()) } just Runs

        widget.onReceive(context, intent)

        verify(exactly = 0) { widget["generatePassword"](context) }
        verify { SafeLog.w("PasswordWidget", match { it.contains("unexpected sender") }, any()) }
    }

    companion object {
        private const val TEST_PACKAGE = "com.julien.genpwdpro"
        private const val MALICIOUS_PACKAGE = "com.attacker.malware"
    }
}
