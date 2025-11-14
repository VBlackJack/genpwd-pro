package com.julien.genpwdpro.data.db.database

import com.julien.genpwdpro.core.log.SafeLog
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import net.sqlcipher.database.SQLiteDatabase
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages automatic SQLCipher passphrase rotation.
 *
 * SECURITY ENHANCEMENT: Automatically rotates the database encryption passphrase
 * every 90 days to limit the window of compromise if the passphrase is exposed.
 *
 * This class provides:
 * - Automatic rotation check on app startup
 * - Safe rotation with proper error handling
 * - Logging and monitoring of rotation status
 *
 * USAGE:
 * Call checkAndRotateIfNeeded() after database initialization in your
 * Application class or main activity.
 */
@Singleton
class DatabasePassphraseRotationManager @Inject constructor(
    private val passphraseProvider: SqlCipherPassphraseProvider
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    companion object {
        private const val TAG = "PassphraseRotation"
    }

    /**
     * Check if rotation is needed and perform it if necessary.
     * This method is safe to call multiple times.
     *
     * @param getDatabaseCallback Callback to get the opened SQLiteDatabase
     *        This callback will only be invoked if rotation is needed
     */
    fun checkAndRotateIfNeeded(getDatabaseCallback: () -> SQLiteDatabase) {
        scope.launch {
            try {
                if (!passphraseProvider.needsRotation()) {
                    val daysSince = passphraseProvider.daysSinceLastRotation()
                    SafeLog.d(TAG, "Passphrase rotation not needed (last rotated $daysSince days ago)")
                    return@launch
                }

                val daysSince = passphraseProvider.daysSinceLastRotation()
                SafeLog.w(TAG, "Passphrase rotation needed (last rotated $daysSince days ago)")

                // Get database instance
                val database = try {
                    getDatabaseCallback()
                } catch (e: Exception) {
                    SafeLog.e(TAG, "Failed to get database for rotation", e)
                    return@launch
                }

                // Perform rotation
                val success = passphraseProvider.rotatePassphrase(database)

                if (success) {
                    SafeLog.i(TAG, "Passphrase rotation completed successfully")
                } else {
                    SafeLog.e(TAG, "Passphrase rotation failed")
                }

            } catch (e: Exception) {
                SafeLog.e(TAG, "Unexpected error during rotation check", e)
            }
        }
    }

    /**
     * Force an immediate passphrase rotation regardless of the schedule.
     * Use this for manual rotation or security incident response.
     *
     * @param database The open SQLiteDatabase instance
     * @return true if rotation succeeded, false otherwise
     */
    fun forceRotation(database: SQLiteDatabase): Boolean {
        SafeLog.w(TAG, "Forcing immediate passphrase rotation")
        return passphraseProvider.rotatePassphrase(database)
    }

    /**
     * Get the status of passphrase rotation.
     *
     * @return RotationStatus containing current rotation state
     */
    fun getRotationStatus(): RotationStatus {
        val daysSince = passphraseProvider.daysSinceLastRotation()
        val needsRotation = passphraseProvider.needsRotation()

        return RotationStatus(
            daysSinceLastRotation = daysSince,
            needsRotation = needsRotation,
            isFirstRun = daysSince == -1
        )
    }

    /**
     * Status information about passphrase rotation.
     *
     * @property daysSinceLastRotation Number of days since last rotation (-1 if first run)
     * @property needsRotation Whether rotation is currently needed
     * @property isFirstRun Whether this is the first run (no rotation recorded)
     */
    data class RotationStatus(
        val daysSinceLastRotation: Int,
        val needsRotation: Boolean,
        val isFirstRun: Boolean
    ) {
        val daysUntilRotation: Int
            get() = if (isFirstRun) 90 else maxOf(0, 90 - daysSinceLastRotation)

        fun toLogString(): String {
            return if (isFirstRun) {
                "First run - rotation baseline set"
            } else if (needsRotation) {
                "ROTATION NEEDED - $daysSinceLastRotation days since last rotation"
            } else {
                "OK - $daysSinceLastRotation days since last rotation ($daysUntilRotation days until next)"
            }
        }
    }
}
