package com.julien.genpwdpro.autofill.security

import android.app.KeyguardManager
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build
import android.os.SystemClock
import androidx.annotation.VisibleForTesting

/**
 * Evaluates whether an autofill request should be processed based on device state and caller metadata.
 */
class AutofillRequestGuard(
    private val keyguardChecker: KeyguardChecker,
    private val packageValidator: PackageValidator,
    private val clock: Clock = SystemClockClock(),
    private val throttleWindowMs: Long = DEFAULT_THROTTLE_WINDOW_MS,
    private val maxTrackedPackages: Int = DEFAULT_MAX_TRACKED_PACKAGES
) {

    private val recentCalls = object : LinkedHashMap<String, Long>(maxTrackedPackages, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Long>): Boolean {
            return size > maxTrackedPackages
        }
    }

    fun evaluate(callingPackage: String?): GuardDecision {
        if (!keyguardChecker.isDeviceUnlocked()) {
            return GuardDecision.DeviceLocked
        }

        val verifiedPackage = packageValidator.validate(callingPackage) ?: return GuardDecision.UntrustedCaller

        synchronized(recentCalls) {
            val now = clock.elapsedRealtime()
            val last = recentCalls[verifiedPackage]
            if (last != null && now - last < throttleWindowMs) {
                return GuardDecision.Throttled
            }
            recentCalls[verifiedPackage] = now
        }
        return GuardDecision.Allowed(verifiedPackage)
    }

    @VisibleForTesting
    internal fun getTrackedPackages(): Set<String> = synchronized(recentCalls) { recentCalls.keys.toSet() }

    companion object {
        private const val DEFAULT_THROTTLE_WINDOW_MS = 1500L
        private const val DEFAULT_MAX_TRACKED_PACKAGES = 32

        fun create(keyguardManager: KeyguardManager?, packageManager: PackageManager): AutofillRequestGuard {
            return AutofillRequestGuard(
                keyguardChecker = SystemKeyguardChecker(keyguardManager),
                packageValidator = PackageManagerValidator(packageManager)
            )
        }
    }
}

sealed class GuardDecision {
    data class Allowed(val packageName: String) : GuardDecision()
    object DeviceLocked : GuardDecision()
    object UntrustedCaller : GuardDecision()
    object Throttled : GuardDecision()
}

interface KeyguardChecker {
    fun isDeviceUnlocked(): Boolean
}

interface PackageValidator {
    fun validate(packageName: String?): String?
}

interface Clock {
    fun elapsedRealtime(): Long
}

private class SystemClockClock : Clock {
    override fun elapsedRealtime(): Long = SystemClock.elapsedRealtime()
}

class SystemKeyguardChecker(
    private val keyguardManager: KeyguardManager?
) : KeyguardChecker {
    override fun isDeviceUnlocked(): Boolean {
        val km = keyguardManager ?: return true
        return when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M -> !km.isDeviceLocked
            else -> !km.isKeyguardLocked
        }
    }
}

class PackageManagerValidator(
    private val packageManager: PackageManager
) : PackageValidator {
    override fun validate(packageName: String?): String? {
        if (packageName.isNullOrBlank()) return null
        return try {
            val info: ApplicationInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                packageManager.getApplicationInfo(packageName, PackageManager.ApplicationInfoFlags.of(0))
            } else {
                @Suppress("DEPRECATION")
                packageManager.getApplicationInfo(packageName, 0)
            }
            info.packageName
        } catch (_: PackageManager.NameNotFoundException) {
            null
        } catch (_: SecurityException) {
            null
        }
    }
}
