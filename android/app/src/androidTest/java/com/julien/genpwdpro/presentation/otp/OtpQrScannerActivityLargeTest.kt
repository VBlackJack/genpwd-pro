package com.julien.genpwdpro.presentation.otp

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import org.junit.Ignore
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumented sanity check for the OTP scanner activity.
 *
 * The test is marked as a large test and ignored by default because it
 * requires a device with camera hardware, ML Kit barcode models and
 * user interaction. It exists to document the expected instrumentation
 * entry point and can be enabled on dedicated hardware labs.
 */
@RunWith(AndroidJUnit4::class)
@LargeTest
@Ignore("Requires physical camera hardware and ML Kit models")
class OtpQrScannerActivityLargeTest {

    @Test
    fun launchScannerActivity() {
        // No-op placeholder for on-device validation.
    }
}
