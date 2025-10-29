package com.julien.genpwdpro.baselineprofile

import android.content.Intent
import androidx.benchmark.macro.junit4.BaselineProfileRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Until
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class StartupBaselineProfile {

    @get:Rule
    val baselineProfileRule = BaselineProfileRule()

    @Test
    fun startup() = baselineProfileRule.collectBaselineProfile(
        packageName = "com.julien.genpwdpro"
    ) {
        pressHome()

        val intent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_LAUNCHER)
            setPackage(packageName)
        }

        startActivityAndWait(intent)

        device.wait(Until.hasObject(By.pkg(packageName).depth(0)), 5_000)
    }
}
