package com.julien.genpwdpro.security

import android.os.Build
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlin.test.assertTrue
import org.junit.Assume
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class KeystoreConfigurationInstrumentedTest {

    @Test
    fun appLockKeyRequiresBiometricAndInvalidatesOnEnrollment() {
        Assume.assumeTrue(Build.VERSION.SDK_INT >= Build.VERSION_CODES.N)

        val keystoreManager = KeystoreManager()
        val key = keystoreManager.getAppLockKey()
        val factory = javax.crypto.SecretKeyFactory.getInstance(key.algorithm, "AndroidKeyStore")
        val keyInfo = factory.getKeySpec(key, android.security.keystore.KeyInfo::class.java) as android.security.keystore.KeyInfo

        assertTrue(
            keyInfo.isUserAuthenticationRequired,
            "App lock key must require user authentication"
        )
        assertTrue(
            keyInfo.isInvalidatedByBiometricEnrollment,
            "App lock key must invalidate when biometrics change"
        )
    }
}
