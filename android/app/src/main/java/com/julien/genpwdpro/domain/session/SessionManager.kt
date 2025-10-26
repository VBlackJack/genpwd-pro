package com.julien.genpwdpro.domain.session

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Gestionnaire de session pour tracker le vault actuellement déverrouillé
 */
@Singleton
class SessionManager @Inject constructor() {

    private val _currentVaultId = MutableStateFlow<String?>(null)
    val currentVaultId: StateFlow<String?> = _currentVaultId.asStateFlow()

    /**
     * Vérifie si un vault est actuellement déverrouillé
     */
    val isVaultUnlocked: Boolean
        get() = _currentVaultId.value != null

    /**
     * Déverrouille un vault (définit la session active)
     */
    fun unlockVault(vaultId: String) {
        _currentVaultId.value = vaultId
    }

    /**
     * Verrouille le vault actuel (termine la session)
     */
    fun lockVault() {
        _currentVaultId.value = null
    }

    /**
     * Récupère l'ID du vault actuellement déverrouillé
     */
    fun getCurrentVaultId(): String? {
        return _currentVaultId.value
    }
}
