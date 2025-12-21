package com.julien.genpwdpro.presentation.widget

import android.os.Build
import android.os.Process
import org.junit.Assert.*
import org.junit.Test

/**
 * Tests for PasswordWidget security guard functions
 * Tests the isTrustedSender logic directly
 */
class PasswordWidgetGuardTest {

    companion object {
        private const val TEST_PACKAGE = "com.julien.genpwdpro"
        private const val MALICIOUS_PACKAGE = "com.attacker.malware"
    }

    @Test
    fun `isTrustedSender rejects non-system UID on modern API`() {
        // On API Q+, only SYSTEM_UID is trusted
        val result = PasswordWidget.isTrustedSender(
            sdkInt = Build.VERSION_CODES.Q,
            callingUid = Process.SYSTEM_UID + 1, // Non-system UID
            senderPackage = TEST_PACKAGE,
            appPackage = TEST_PACKAGE
        )

        assertFalse("Should reject non-system UID on Q+", result)
    }

    @Test
    fun `isTrustedSender allows system UID on modern API`() {
        val result = PasswordWidget.isTrustedSender(
            sdkInt = Build.VERSION_CODES.Q,
            callingUid = Process.SYSTEM_UID,
            senderPackage = TEST_PACKAGE,
            appPackage = TEST_PACKAGE
        )

        assertTrue("Should allow system UID on Q+", result)
    }

    @Test
    fun `isTrustedSender checks package on legacy API`() {
        // On pre-Q, fall back to package checks
        val resultMalicious = PasswordWidget.isTrustedSender(
            sdkInt = Build.VERSION_CODES.P,
            callingUid = Process.SYSTEM_UID,
            senderPackage = MALICIOUS_PACKAGE,
            appPackage = TEST_PACKAGE
        )

        assertFalse("Should reject mismatched package on P", resultMalicious)
    }

    @Test
    fun `isTrustedSender allows null sender package on legacy API`() {
        // Null sender package is allowed (system broadcasts may not set it)
        val result = PasswordWidget.isTrustedSender(
            sdkInt = Build.VERSION_CODES.P,
            callingUid = Process.SYSTEM_UID,
            senderPackage = null,
            appPackage = TEST_PACKAGE
        )

        assertTrue("Should allow null sender package on P", result)
    }

    @Test
    fun `isTrustedSender allows same package on legacy API`() {
        val result = PasswordWidget.isTrustedSender(
            sdkInt = Build.VERSION_CODES.P,
            callingUid = Process.SYSTEM_UID,
            senderPackage = TEST_PACKAGE,
            appPackage = TEST_PACKAGE
        )

        assertTrue("Should allow same package on P", result)
    }

    @Test
    fun `isTrustedSender handles edge case of UID 0`() {
        // UID 0 is root, not SYSTEM_UID (which is 1000)
        val result = PasswordWidget.isTrustedSender(
            sdkInt = Build.VERSION_CODES.Q,
            callingUid = 0, // root
            senderPackage = TEST_PACKAGE,
            appPackage = TEST_PACKAGE
        )

        assertFalse("Should reject root UID (not SYSTEM_UID)", result)
    }

    @Test
    fun `isTrustedSender handles latest SDK version`() {
        val result = PasswordWidget.isTrustedSender(
            sdkInt = 34, // Android 14
            callingUid = Process.SYSTEM_UID,
            senderPackage = TEST_PACKAGE,
            appPackage = TEST_PACKAGE
        )

        assertTrue("Should allow system UID on latest SDK", result)
    }
}
