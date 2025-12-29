package com.julien.genpwdpro.data.crypto

import android.app.ActivityManager
import android.content.Context
import com.julien.genpwdpro.core.log.SafeLog
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Calculator for optimal Argon2 parameters based on device capabilities
 *
 * SECURITY & PERFORMANCE: Balances security (higher iterations/memory)
 * with UX (target unlock time of 500ms-1s)
 *
 * Adapts to:
 * - Available RAM
 * - CPU cores
 * - Device performance class
 *
 * Reference: https://datatracker.ietf.org/doc/html/rfc9106
 */
@Singleton
class Argon2ParamsCalculator @Inject constructor() {

    companion object {
        private const val TAG = "Argon2ParamsCalculator"

        // Target unlock time (milliseconds)
        private const val TARGET_UNLOCK_TIME_MS = 750L  // 750ms sweet spot

        // Min/max bounds for safety
        private const val MIN_ITERATIONS = 2
        private const val MAX_ITERATIONS = 10
        private const val MIN_MEMORY_KB = 32768   // 32 MB
        private const val MAX_MEMORY_KB = 524288  // 512 MB
        private const val MIN_PARALLELISM = 1
        private const val MAX_PARALLELISM = 8
    }

    /**
     * Argon2 parameters configuration
     */
    data class Argon2Params(
        val iterations: Int,     // Time cost (iterations)
        val memory: Int,         // Memory cost (in KB)
        val parallelism: Int,    // Number of parallel threads
        val deviceClass: DeviceClass
    ) {
        override fun toString(): String {
            return "Argon2Params(iterations=$iterations, memory=${memory}KB, parallelism=$parallelism, class=$deviceClass)"
        }
    }

    /**
     * Device performance classification
     */
    enum class DeviceClass {
        LOW_END,      // <2GB RAM, old CPUs
        MID_RANGE,    // 2-4GB RAM, modern CPUs
        HIGH_END,     // 4-8GB RAM, flagship CPUs
        PREMIUM       // >8GB RAM, latest flagship
    }

    /**
     * Calculate optimal Argon2 parameters for current device
     *
     * @param context Application context
     * @return Recommended Argon2 parameters
     */
    fun calculateOptimalParams(context: Context): Argon2Params {
        val deviceClass = classifyDevice(context)
        val cpuCores = Runtime.getRuntime().availableProcessors()

        SafeLog.i(TAG, "Device classification: $deviceClass, CPU cores: $cpuCores")

        // Calculate parameters based on device class
        val params = when (deviceClass) {
            DeviceClass.LOW_END -> {
                // Low-end: Prioritize UX (faster unlock)
                Argon2Params(
                    iterations = 2,
                    memory = 32768,  // 32 MB
                    parallelism = minOf(cpuCores, 2),
                    deviceClass = deviceClass
                )
            }

            DeviceClass.MID_RANGE -> {
                // Mid-range: Balanced security/performance
                Argon2Params(
                    iterations = 3,
                    memory = 65536,  // 64 MB
                    parallelism = minOf(cpuCores, 4),
                    deviceClass = deviceClass
                )
            }

            DeviceClass.HIGH_END -> {
                // High-end: More security
                Argon2Params(
                    iterations = 4,
                    memory = 131072,  // 128 MB
                    parallelism = minOf(cpuCores, 4),
                    deviceClass = deviceClass
                )
            }

            DeviceClass.PREMIUM -> {
                // Premium: Maximum security (within reason)
                Argon2Params(
                    iterations = 5,
                    memory = 262144,  // 256 MB
                    parallelism = minOf(cpuCores, 6),
                    deviceClass = deviceClass
                )
            }
        }

        SafeLog.i(TAG, "Calculated params: $params")
        return params
    }

    /**
     * Classify device based on available resources
     *
     * @param context Application context
     * @return Device performance class
     */
    private fun classifyDevice(context: Context): DeviceClass {
        val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
            ?: return DeviceClass.LOW_END

        val memInfo = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memInfo)

        val totalRamMB = memInfo.totalMem / (1024 * 1024)
        val cpuCores = Runtime.getRuntime().availableProcessors()

        SafeLog.d(TAG, "Device specs: RAM=${totalRamMB}MB, CPU cores=$cpuCores")

        // Classify based on RAM (primary) and CPU cores (secondary)
        return when {
            totalRamMB >= 8192 -> DeviceClass.PREMIUM      // 8GB+ RAM
            totalRamMB >= 4096 -> DeviceClass.HIGH_END     // 4-8GB RAM
            totalRamMB >= 2048 -> DeviceClass.MID_RANGE    // 2-4GB RAM
            else -> DeviceClass.LOW_END                     // <2GB RAM
        }.also { deviceClass ->
            // Downgrade if CPU is weak (< 4 cores on mid/high-end device)
            if (deviceClass >= DeviceClass.MID_RANGE && cpuCores < 4) {
                SafeLog.w(TAG, "Downgrading device class due to low CPU core count")
                return DeviceClass.LOW_END
            }
        }
    }

    /**
     * Get conservative "safe" parameters for unknown devices
     *
     * Use this as fallback if classification fails
     *
     * @return Safe default parameters
     */
    fun getSafeDefaults(): Argon2Params {
        return Argon2Params(
            iterations = 3,
            memory = 65536,  // 64 MB
            parallelism = 2,
            deviceClass = DeviceClass.MID_RANGE
        )
    }

    /**
     * Validate parameters are within safe bounds
     *
     * @param params Parameters to validate
     * @return Validated (clamped) parameters
     */
    fun validateParams(params: Argon2Params): Argon2Params {
        return params.copy(
            iterations = params.iterations.coerceIn(MIN_ITERATIONS, MAX_ITERATIONS),
            memory = params.memory.coerceIn(MIN_MEMORY_KB, MAX_MEMORY_KB),
            parallelism = params.parallelism.coerceIn(MIN_PARALLELISM, MAX_PARALLELISM)
        )
    }

    /**
     * Get parameters for testing/benchmarking
     *
     * Very fast parameters for development/testing ONLY
     * DO NOT use in production
     *
     * @return Fast (insecure) parameters for testing
     */
    fun getTestParams(): Argon2Params {
        SafeLog.w(TAG, "Using INSECURE test parameters! FOR TESTING ONLY!")
        return Argon2Params(
            iterations = 1,
            memory = 8192,  // 8 MB
            parallelism = 1,
            deviceClass = DeviceClass.LOW_END
        )
    }
}
