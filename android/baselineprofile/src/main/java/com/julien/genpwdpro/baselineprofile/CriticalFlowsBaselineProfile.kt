package com.julien.genpwdpro.baselineprofile

import android.content.Intent
import androidx.benchmark.macro.junit4.BaselineProfileRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.uiautomator.By
import androidx.test.uiautomator.BySelector
import androidx.test.uiautomator.Until
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CriticalFlowsBaselineProfile {

    @get:Rule
    val baselineProfileRule = BaselineProfileRule()

    @Test
    fun unlockVaultAndOpenList() = baselineProfileRule.collectBaselineProfile(
        packageName = PACKAGE_NAME
    ) {
        launchMainScreen()
        device.wait(Until.hasObject(By.pkg(PACKAGE_NAME).depth(0)), DEFAULT_TIMEOUT)
        maybeClick(By.textContains("Coffre"))
        maybeClick(By.textContains("Déverrouiller"))
        device.waitForIdle()
    }

    @Test
    fun generateAndCopySecret() = baselineProfileRule.collectBaselineProfile(
        packageName = PACKAGE_NAME
    ) {
        launchMainScreen()
        maybeClick(By.textContains("Générer"))
        device.waitForIdle()
        maybeClick(By.descContains("Copier"))
        device.waitForIdle()
    }

    @Test
    fun launchOtpScanner() = baselineProfileRule.collectBaselineProfile(
        packageName = PACKAGE_NAME
    ) {
        // Start the dedicated OTP scanner activity directly to capture camera initialisation.
        val scannerIntent = Intent().apply {
            setClassName(PACKAGE_NAME, "com.julien.genpwdpro.presentation.otp.OtpQrScannerActivity")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivityAndWait(scannerIntent)
        device.wait(Until.hasObject(By.pkg(PACKAGE_NAME)), DEFAULT_TIMEOUT)
        // Close any dialogs that might appear.
        maybeClick(By.textContains("Annuler"))
    }

    private fun androidx.benchmark.macro.MacrobenchmarkScope.launchMainScreen() {
        pressHome()
        val intent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_LAUNCHER)
            setPackage(PACKAGE_NAME)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivityAndWait(intent)
    }

    private fun androidx.benchmark.macro.MacrobenchmarkScope.maybeClick(selector: BySelector) {
        runCatching {
            val obj = device.wait(Until.findObject(selector), DEFAULT_TIMEOUT)
            obj?.click()
        }
    }

    companion object {
        private const val PACKAGE_NAME = "com.julien.genpwdpro"
        private const val DEFAULT_TIMEOUT = 5_000L
    }
}
