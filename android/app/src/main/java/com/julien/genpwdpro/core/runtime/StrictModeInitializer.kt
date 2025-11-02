package com.julien.genpwdpro.core.runtime

import android.os.StrictMode
import com.julien.genpwdpro.BuildConfig

/**
 * Installs strict mode policies in debug builds so we can surface risky patterns early.
 */
object StrictModeInitializer {
    fun install() {
        if (!BuildConfig.DEBUG) {
            return
        }

        StrictMode.setThreadPolicy(
            StrictMode.ThreadPolicy.Builder()
                .detectAll()
                .penaltyLog()
                .build()
        )

        StrictMode.setVmPolicy(
            StrictMode.VmPolicy.Builder()
                .detectAll()
                .penaltyLog()
                .build()
        )

        // Expect to surface accidental disk/network calls on the main thread and leaked closables early.
    }
}
