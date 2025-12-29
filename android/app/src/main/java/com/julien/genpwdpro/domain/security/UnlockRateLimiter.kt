package com.julien.genpwdpro.domain.security

import com.julien.genpwdpro.core.log.SafeLog
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Rate limiter for vault unlock attempts
 *
 * SECURITY: Prevents brute-force attacks by limiting failed unlock attempts
 *
 * Features:
 * - Configurable max attempts before lockout
 * - Time-based lockout (exponential backoff optional)
 * - Thread-safe with Mutex
 * - Per-vault tracking
 * - Automatic lockout expiration
 */
@Singleton
class UnlockRateLimiter @Inject constructor() {

    companion object {
        private const val TAG = "UnlockRateLimiter"

        // Security parameters
        private const val MAX_ATTEMPTS = 5
        private const val LOCKOUT_DURATION_MS = 5 * 60 * 1000L  // 5 minutes
        private const val PROGRESSIVE_LOCKOUT = true  // Enable exponential backoff

        // Progressive lockout multipliers (attempt number -> lockout duration)
        private val LOCKOUT_MULTIPLIERS = mapOf(
            3 to 1,    // After 3 failures: 1x lockout (5 minutes)
            4 to 2,    // After 4 failures: 2x lockout (10 minutes)
            5 to 4,    // After 5 failures: 4x lockout (20 minutes)
            6 to 8,    // After 6+ failures: 8x lockout (40 minutes)
        )
    }

    // Thread-safe state
    private val mutex = Mutex()
    private val failedAttempts = mutableMapOf<String, Int>()
    private val lockoutUntil = mutableMapOf<String, Long>()

    /**
     * Check if unlock attempt is allowed and record it
     *
     * @param vaultId ID of vault being unlocked
     * @return Result indicating if attempt is allowed or locked out
     */
    suspend fun checkAndRecordAttempt(vaultId: String): RateLimitResult = mutex.withLock {
        val now = System.currentTimeMillis()

        // Check if currently locked out
        lockoutUntil[vaultId]?.let { until ->
            if (now < until) {
                val remainingSeconds = (until - now) / 1000
                SafeLog.w(TAG, "Vault ${SafeLog.redact(vaultId)} is locked out for $remainingSeconds more seconds")
                return RateLimitResult.LockedOut(remainingSeconds)
            } else {
                // Lockout expired - reset
                SafeLog.i(TAG, "Lockout expired for vault ${SafeLog.redact(vaultId)}")
                failedAttempts.remove(vaultId)
                lockoutUntil.remove(vaultId)
            }
        }

        val attempts = failedAttempts.getOrDefault(vaultId, 0)

        // Check if max attempts reached
        if (attempts >= MAX_ATTEMPTS) {
            // Calculate lockout duration (progressive or fixed)
            val lockoutDuration = if (PROGRESSIVE_LOCKOUT) {
                val multiplier = LOCKOUT_MULTIPLIERS.entries
                    .lastOrNull { attempts >= it.key }
                    ?.value ?: 1
                LOCKOUT_DURATION_MS * multiplier
            } else {
                LOCKOUT_DURATION_MS
            }

            // Lock out
            val lockoutEnd = now + lockoutDuration
            lockoutUntil[vaultId] = lockoutEnd
            val remainingSeconds = lockoutDuration / 1000

            SafeLog.w(TAG, "Vault ${SafeLog.redact(vaultId)} locked out after $attempts attempts for $remainingSeconds seconds")

            return RateLimitResult.LockedOut(remainingSeconds)
        }

        // Increment attempt counter
        failedAttempts[vaultId] = attempts + 1
        val attemptsRemaining = MAX_ATTEMPTS - attempts - 1

        SafeLog.d(TAG, "Failed attempt recorded for vault ${SafeLog.redact(vaultId)}. Attempts remaining: $attemptsRemaining")

        return RateLimitResult.Allowed(attemptsRemaining)
    }

    /**
     * Record a successful unlock (clears all failed attempts)
     *
     * @param vaultId ID of vault that was successfully unlocked
     */
    suspend fun recordSuccess(vaultId: String) = mutex.withLock {
        val attempts = failedAttempts[vaultId] ?: 0
        if (attempts > 0) {
            SafeLog.i(TAG, "Successful unlock for vault ${SafeLog.redact(vaultId)} after $attempts failed attempts")
        }

        failedAttempts.remove(vaultId)
        lockoutUntil.remove(vaultId)
    }

    /**
     * Get current lockout status for a vault
     *
     * @param vaultId ID of vault to check
     * @return Lockout status
     */
    suspend fun getLockoutStatus(vaultId: String): LockoutStatus = mutex.withLock {
        val now = System.currentTimeMillis()

        // Check for active lockout
        lockoutUntil[vaultId]?.let { until ->
            if (now < until) {
                val remainingSeconds = (until - now) / 1000
                return LockoutStatus.LockedOut(remainingSeconds)
            } else {
                // Expired lockout
                failedAttempts.remove(vaultId)
                lockoutUntil.remove(vaultId)
            }
        }

        // Get failed attempts count
        val attempts = failedAttempts[vaultId] ?: 0
        return if (attempts > 0) {
            LockoutStatus.HasFailedAttempts(attempts, MAX_ATTEMPTS - attempts)
        } else {
            LockoutStatus.Clean
        }
    }

    /**
     * Manually reset lockout for a vault (admin/debug use only)
     *
     * @param vaultId ID of vault to reset
     */
    suspend fun resetLockout(vaultId: String) = mutex.withLock {
        SafeLog.w(TAG, "Manually resetting lockout for vault ${SafeLog.redact(vaultId)}")
        failedAttempts.remove(vaultId)
        lockoutUntil.remove(vaultId)
    }

    /**
     * Clear all lockouts (app reset/logout)
     */
    suspend fun clearAll() = mutex.withLock {
        SafeLog.i(TAG, "Clearing all rate limiting data")
        failedAttempts.clear()
        lockoutUntil.clear()
    }
}

/**
 * Result of rate limit check
 */
sealed class RateLimitResult {
    /**
     * Attempt is allowed
     *
     * @param attemptsRemaining Number of attempts remaining before lockout
     */
    data class Allowed(val attemptsRemaining: Int) : RateLimitResult()

    /**
     * Vault is locked out due to too many failed attempts
     *
     * @param secondsRemaining Seconds until lockout expires
     */
    data class LockedOut(val secondsRemaining: Long) : RateLimitResult()
}

/**
 * Lockout status for a vault
 */
sealed class LockoutStatus {
    /**
     * No failed attempts, no lockout
     */
    object Clean : LockoutStatus()

    /**
     * Has failed attempts but not locked out yet
     *
     * @param failedAttempts Number of failed attempts
     * @param attemptsRemaining Number of attempts remaining before lockout
     */
    data class HasFailedAttempts(
        val failedAttempts: Int,
        val attemptsRemaining: Int
    ) : LockoutStatus()

    /**
     * Currently locked out
     *
     * @param secondsRemaining Seconds until lockout expires
     */
    data class LockedOut(val secondsRemaining: Long) : LockoutStatus()
}
