package com.julien.genpwdpro.domain.session

/**
 * Events related to biometric key rotation.
 *
 * These events are emitted by [VaultSessionManager] and collected by the UI
 * to prompt the user for Master Password confirmation when key rotation is needed.
 *
 * Flow:
 * 1. [BiometricMaintenanceWorker] detects key needs rotation (age > 90 days)
 * 2. Worker emits [RotationNeeded] event via [VaultSessionManager]
 * 3. UI observes the event and shows rotation prompt dialog
 * 4. User enters Master Password
 * 5. [VaultSessionManager.rotateBiometricKey()] performs actual rotation
 * 6. [RotationCompleted] or [RotationFailed] event emitted
 *
 * Usage in ViewModel:
 * ```kotlin
 * vaultSessionManager.biometricRotationEvents.collect { event ->
 *     when (event) {
 *         is BiometricRotationEvent.RotationNeeded -> showRotationDialog(event.vaultId)
 *         is BiometricRotationEvent.RotationCompleted -> showSuccessMessage()
 *         is BiometricRotationEvent.RotationFailed -> showErrorMessage(event.error)
 *     }
 * }
 * ```
 */
sealed class BiometricRotationEvent {

    /**
     * Biometric key rotation is needed for the specified vault.
     *
     * UI should prompt the user to enter their Master Password to complete the rotation.
     *
     * @param vaultId ID of the vault that needs key rotation
     * @param reason Human-readable reason for the rotation (e.g., "Key is older than 90 days")
     */
    data class RotationNeeded(
        val vaultId: String,
        val reason: String
    ) : BiometricRotationEvent()

    /**
     * Biometric key rotation completed successfully.
     *
     * @param vaultId ID of the vault whose key was rotated
     * @param newKeyVersion The new key version after rotation
     */
    data class RotationCompleted(
        val vaultId: String,
        val newKeyVersion: Int
    ) : BiometricRotationEvent()

    /**
     * Biometric key rotation failed.
     *
     * @param vaultId ID of the vault where rotation failed
     * @param error Human-readable error message
     * @param exception Original exception (for logging)
     */
    data class RotationFailed(
        val vaultId: String,
        val error: String,
        val exception: Throwable? = null
    ) : BiometricRotationEvent()

    /**
     * User dismissed the rotation prompt without completing rotation.
     *
     * The maintenance worker will prompt again on the next check.
     *
     * @param vaultId ID of the vault where rotation was dismissed
     */
    data class RotationDismissed(
        val vaultId: String
    ) : BiometricRotationEvent()
}
