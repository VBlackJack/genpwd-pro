package com.julien.genpwdpro.presentation.vault

import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.data.db.dao.VaultRegistryDao
import com.julien.genpwdpro.data.db.entity.VaultRegistryEntry
import com.julien.genpwdpro.data.repository.FileVaultRepository
import com.julien.genpwdpro.data.webauthn.PasskeyAuthenticationResult
import com.julien.genpwdpro.data.webauthn.PasskeyManager
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * ViewModel pour l'écran de déverrouillage d'un vault
 *
 * Responsabilités :
 * - Charger les métadonnées du vault depuis vault_registry
 * - Déverrouiller avec mot de passe via FileVaultRepository
 * - Déverrouiller avec biométrie via FileVaultRepository
 * - Déverrouiller avec passkey (WebAuthn) via PasskeyManager
 * - Gérer l'état UI (loading, error, success)
 */
@HiltViewModel
class UnlockVaultViewModel @Inject constructor(
    private val fileVaultRepository: FileVaultRepository,
    private val vaultRegistryDao: VaultRegistryDao,
    private val passkeyManager: PasskeyManager
) : ViewModel() {

    companion object {
        private const val TAG = "UnlockVaultViewModel"
    }

    private val _uiState = MutableStateFlow<UnlockVaultUiState>(UnlockVaultUiState.Loading)
    val uiState: StateFlow<UnlockVaultUiState> = _uiState.asStateFlow()

    private val _vaultRegistry = MutableStateFlow<VaultRegistryEntry?>(null)
    val vaultRegistry: StateFlow<VaultRegistryEntry?> = _vaultRegistry.asStateFlow()

    /**
     * Charge les métadonnées du vault
     */
    fun loadVault(vaultId: String) {
        viewModelScope.launch {
            try {
                SafeLog.d(TAG, "Loading vault metadata for $vaultId")
                _uiState.value = UnlockVaultUiState.Loading
                val registry = vaultRegistryDao.getById(vaultId)

                if (registry == null) {
                    SafeLog.w(TAG, "Vault not found: $vaultId")
                    _vaultRegistry.value = null
                    _uiState.value = UnlockVaultUiState.Error("Vault introuvable")
                } else {
                    _vaultRegistry.value = registry
                    _uiState.value = UnlockVaultUiState.Ready
                    SafeLog.d(TAG, "Vault metadata loaded: ${registry.name}")
                }
            } catch (e: Exception) {
                SafeLog.e(TAG, "Error loading vault: $vaultId", e)
                _uiState.value = UnlockVaultUiState.Error(
                    e.message ?: "Erreur lors du chargement du vault"
                )
            }
        }
    }

    /**
     * Déverrouille le vault avec un mot de passe
     */
    fun unlockWithPassword(vaultId: String, masterPassword: String) {
        viewModelScope.launch {
            try {
                SafeLog.d(TAG, "🔓 Attempting unlock for vault: $vaultId")
                SafeLog.d(
                    TAG,
                    "📏 Master password received for unlock: ${SafeLog.redact(masterPassword)}"
                )
                SafeLog.d(TAG, "📊 Current UI state: ${_uiState.value::class.simpleName}")

                _uiState.value = UnlockVaultUiState.Unlocking

                val result = fileVaultRepository.unlockVault(vaultId, masterPassword)

                SafeLog.d(TAG, "✅ Unlock result: ${if (result.isSuccess) "SUCCESS" else "FAILURE"}")

                result.fold(
                    onSuccess = {
                        SafeLog.i(TAG, "✅ Vault unlocked successfully: $vaultId")
                        // Vérifier que la session est bien créée
                        val currentVaultId = fileVaultRepository.getCurrentVaultId()
                        SafeLog.d(TAG, "Current vault ID after unlock: $currentVaultId")
                        if (currentVaultId == vaultId) {
                            SafeLog.i(TAG, "✅ Session correctly set to vault: $vaultId")
                        } else {
                            SafeLog.w(
                                TAG,
                                "⚠️ Session mismatch! Expected: $vaultId, Got: $currentVaultId"
                            )
                        }
                        _uiState.value = UnlockVaultUiState.Unlocked(vaultId)
                    },
                    onFailure = { error ->
                        SafeLog.e(TAG, "❌ Unlock failed for vault $vaultId", error)
                        SafeLog.e(TAG, "❌ Error type: ${error::class.simpleName}")
                        SafeLog.e(TAG, "❌ Error message: ${error.message}")
                        _uiState.value = UnlockVaultUiState.Error(
                            error.message ?: "Mot de passe incorrect"
                        )
                    }
                )
            } catch (e: Exception) {
                SafeLog.e(TAG, "💥 Exception during unlock attempt", e)
                SafeLog.e(TAG, "💥 Exception type: ${e::class.simpleName}")
                _uiState.value = UnlockVaultUiState.Error(
                    e.message ?: "Erreur lors du déverrouillage"
                )
            }
        }
    }

    /**
     * Déverrouille le vault avec biométrie
     */
    fun unlockWithBiometric(activity: FragmentActivity, vaultId: String) {
        viewModelScope.launch {
            try {
                _uiState.value = UnlockVaultUiState.Unlocking

                val result = fileVaultRepository.unlockVaultWithBiometric(activity, vaultId)

                result.fold(
                    onSuccess = {
                        _uiState.value = UnlockVaultUiState.Unlocked(vaultId)
                    },
                    onFailure = { error ->
                        val message = error.message ?: "Authentification biométrique échouée"

                        if (message.contains("cancel", ignoreCase = true) ||
                            message.contains("annul", ignoreCase = true)
                        ) {
                            _uiState.value = UnlockVaultUiState.Ready
                        } else {
                            _uiState.value = UnlockVaultUiState.Error(message)
                        }
                    }
                )
            } catch (e: Exception) {
                _uiState.value = UnlockVaultUiState.Error(
                    e.message ?: "Erreur lors de l'authentification biométrique"
                )
            }
        }
    }

    /**
     * Vérifie si la biométrie est disponible sur l'appareil
     */
    fun isBiometricAvailable(): Boolean {
        return fileVaultRepository.isBiometricAvailable()
    }

    /**
     * Active le déverrouillage biométrique pour un vault
     * Nécessite que l'utilisateur ait saisi son master password
     */
    fun enableBiometric(
        activity: androidx.fragment.app.FragmentActivity,
        vaultId: String,
        masterPassword: String
    ) {
        viewModelScope.launch {
            try {
                val result = fileVaultRepository.enableBiometric(activity, vaultId, masterPassword)

                result.fold(
                    onSuccess = {
                        // Recharger le vault pour mettre à jour biometricUnlockEnabled
                        loadVault(vaultId)
                    },
                    onFailure = { error ->
                        _uiState.value = UnlockVaultUiState.Error(
                            "Erreur lors de l'activation: ${error.message}"
                        )
                    }
                )
            } catch (e: Exception) {
                _uiState.value = UnlockVaultUiState.Error(
                    e.message ?: "Erreur lors de l'activation de la biométrie"
                )
            }
        }
    }

    /**
     * Réinitialise l'état UI à Ready (pour effacer les erreurs)
     */
    fun resetToReady() {
        _uiState.value = UnlockVaultUiState.Ready
    }

    // ==================== Passkey (WebAuthn) ====================

    /**
     * Déverrouille le vault avec une passkey (WebAuthn)
     *
     * Passkey fournit uniquement l'authentification (signature), pas de clé de chiffrement.
     * Après authentification réussie, on utilise la clé stockée dans Android Keystore
     * (même mécanisme que biométrie) pour déchiffrer le master password.
     *
     * Prérequis: biometricUnlockEnabled doit être true (pour avoir encryptedMasterPassword)
     */
    fun unlockWithPasskey(activity: FragmentActivity, vaultId: String) {
        viewModelScope.launch {
            try {
                val registry = _vaultRegistry.value
                if (registry == null) {
                    _uiState.value = UnlockVaultUiState.Error("Vault non chargé")
                    return@launch
                }

                // Vérifier que le Quick Unlock (keystore-backed) est configuré
                if (!registry.biometricUnlockEnabled || registry.encryptedMasterPassword == null) {
                    _uiState.value = UnlockVaultUiState.Error(
                        "Veuillez d'abord activer le déverrouillage biométrique"
                    )
                    return@launch
                }

                _uiState.value = UnlockVaultUiState.Unlocking
                SafeLog.d(TAG, "Starting passkey authentication for vault: $vaultId")

                // Authentifier avec passkey
                val result = passkeyManager.authenticateWithPasskey(
                    relyingPartyId = "genpwdpro.app"
                )

                when (result) {
                    is PasskeyAuthenticationResult.Success -> {
                        SafeLog.d(TAG, "Passkey authentication successful, unlocking vault...")

                        // Passkey réussie, utiliser la biométrie pour déchiffrer le master password
                        // (la clé est protégée par Android Keystore qui demande l'auth biométrique)
                        val unlockResult = fileVaultRepository.unlockVaultWithBiometric(activity, vaultId)

                        unlockResult.fold(
                            onSuccess = {
                                SafeLog.i(TAG, "Vault unlocked via passkey: $vaultId")
                                _uiState.value = UnlockVaultUiState.Unlocked(vaultId)
                            },
                            onFailure = { error ->
                                SafeLog.e(TAG, "Passkey auth succeeded but vault unlock failed", error)
                                _uiState.value = UnlockVaultUiState.Error(
                                    error.message ?: "Erreur de déverrouillage"
                                )
                            }
                        )
                    }

                    is PasskeyAuthenticationResult.Cancelled -> {
                        SafeLog.d(TAG, "Passkey authentication cancelled")
                        _uiState.value = UnlockVaultUiState.Ready
                    }

                    is PasskeyAuthenticationResult.NoCredentials -> {
                        SafeLog.w(TAG, "No passkey credentials found")
                        _uiState.value = UnlockVaultUiState.Error(
                            "Aucune passkey enregistrée pour ce vault"
                        )
                    }
                }
            } catch (e: Exception) {
                SafeLog.e(TAG, "Passkey authentication error", e)
                _uiState.value = UnlockVaultUiState.Error(
                    e.message ?: "Erreur d'authentification passkey"
                )
            }
        }
    }

    /**
     * Vérifie si le passkey unlock est disponible pour ce vault
     *
     * Passkey est disponible si:
     * 1. Le vault a biometricUnlockEnabled (= encryptedMasterPassword stocké)
     * 2. L'API Credential Manager est disponible (Android 9+)
     */
    fun isPasskeyAvailable(): Boolean {
        val registry = _vaultRegistry.value ?: return false
        // Passkey utilise le même encryptedMasterPassword que biométrie
        return registry.biometricUnlockEnabled && registry.encryptedMasterPassword != null
    }
}

/**
 * États de l'UI de déverrouillage
 */
sealed class UnlockVaultUiState {
    /** Chargement des métadonnées du vault */
    object Loading : UnlockVaultUiState()

    /** Vault chargé, prêt pour déverrouillage */
    object Ready : UnlockVaultUiState()

    /** En cours de déverrouillage */
    object Unlocking : UnlockVaultUiState()

    /** Vault déverrouillé avec succès */
    data class Unlocked(val vaultId: String) : UnlockVaultUiState()

    /** Erreur lors du déverrouillage */
    data class Error(val message: String) : UnlockVaultUiState()
}
