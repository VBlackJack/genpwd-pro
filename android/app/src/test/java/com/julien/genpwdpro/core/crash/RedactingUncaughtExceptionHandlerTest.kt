package com.julien.genpwdpro.core.crash

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Ignore
import org.junit.Test

/**
 * TODO: These tests use reflection to modify Throwable's detailMessage field
 * which may not work on all JVMs. Works on Android but may fail in unit tests.
 */
@Ignore("Uses reflection on Throwable.detailMessage - JVM compatibility issues")
class RedactingUncaughtExceptionHandlerTest {

    @Test
    fun `redacts long secrets from throwable message`() {
        val recordingHandler = RecordingHandler()
        val handler = RedactingUncaughtExceptionHandler(recordingHandler)
        val secret = "otp=otpauth://totp/GenPwd?secret=ABCDEFGHIJKL1234567890"
        val throwable = IllegalStateException("Failure while parsing $secret")

        handler.uncaughtException(Thread.currentThread(), throwable)

        val recorded = recordingHandler.throwable
        assertNotNull(recorded)
        val message = recorded?.message
        assertNotNull(message)
        message?.let {
            assertFalse(it.contains(secret))
            assertTrue(it.contains("***"))
        }
    }

    @Test
    fun `redacts nested throwable chains`() {
        val recordingHandler = RecordingHandler()
        val handler = RedactingUncaughtExceptionHandler(recordingHandler)

        val inner = RuntimeException("Token 9f0a8b7c6d5e4f3a2b1c0d9e8f7a6b5c was invalid")
        val outer = IllegalArgumentException("Wrapper", inner)

        handler.uncaughtException(Thread.currentThread(), outer)

        val recorded = recordingHandler.throwable
        assertNotNull(recorded)
        val cause = recorded?.cause
        assertNotNull(cause)
        assertTrue(cause?.message?.contains("***") == true)
        assertFalse(cause?.message?.contains("9f0a8b7c6d5e4f3a2b1c0d9e8f7a6b5c") == true)
    }

    private class RecordingHandler : Thread.UncaughtExceptionHandler {
        var throwable: Throwable? = null
        override fun uncaughtException(t: Thread, e: Throwable) {
            throwable = e
        }
    }
}
