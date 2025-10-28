package com.julien.genpwdpro.domain.session

import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Gestionnaire de session pour tracker le vault actuellement déverrouillé
 *
 * Améliorations:
 * - Gestion de timeout des sessions
 * - Nettoyage automatique des sessions expirées
 * - Support pour auto-lock sur mise en arrière-plan
 */
@Singleton
class SessionManager @Inject constructor() {

    companion object {
        private const val TAG = "SessionManager"
        private const val DEFAULT_SESSION_TIMEOUT_HOURS = 24L
    }

    data class SessionInfo(
        val vaultId: String,
        val unlockTimestamp: Long,
        val lastAccessTimestamp: Long = unlockTimestamp
    )

    private val _currentSession = MutableStateFlow<SessionInfo?>(null)
    val currentSession: StateFlow<SessionInfo?> = _currentSession.asStateFlow()

    private val _currentVaultId = MutableStateFlow<String?>(null)
    val currentVaultId: StateFlow<String?> = _currentVaultId.asStateFlow()

    /**
     * Vérifie si un vault est actuellement déverrouillé
     */
    val isVaultUnlocked: Boolean
        get() = _currentVaultId.value != null && !isSessionExpired()

    /**
     * Déverrouille un vault (définit la session active)
     */
    fun unlockVault(vaultId: String) {
        val now = System.currentTimeMillis()
        val sessionInfo = SessionInfo(
            vaultId = vaultId,
            unlockTimestamp = now,
            lastAccessTimestamp = now
        )
        _currentSession.value = sessionInfo
        _currentVaultId.value = vaultId
        Log.d(TAG, "Vault unlocked: $vaultId at $now")
    }

    /**
     * Verrouille le vault actuel (termine la session)
     */
    fun lockVault() {
        val vaultId = _currentVaultId.value
        _currentSession.value = null
        _currentVaultId.value = null
        Log.d(TAG, "Vault locked: $vaultId")
    }

    /**
     * Récupère l'ID du vault actuellement déverrouillé
     */
    fun getCurrentVaultId(): String? {
        return if (isSessionExpired()) {
            lockVault()
            null
        } else {
            _currentVaultId.value
        }
    }

    /**
     * Met à jour le timestamp du dernier accès
     */
    fun updateLastAccess() {
        _currentSession.value?.let { session ->
            _currentSession.value = session.copy(
                lastAccessTimestamp = System.currentTimeMillis()
            )
        }
    }

    /**
     * Vérifie si la session actuelle est expirée
     *
     * @param timeoutHours Durée d'expiration en heures (défaut: 24h)
     * @return true si la session est expirée ou inexistante
     */
    fun isSessionExpired(timeoutHours: Long = DEFAULT_SESSION_TIMEOUT_HOURS): Boolean {
        val session = _currentSession.value ?: return true
        val now = System.currentTimeMillis()
        val timeoutMillis = timeoutHours * 60 * 60 * 1000
        val isExpired = (now - session.lastAccessTimestamp) > timeoutMillis

        if (isExpired) {
            Log.d(TAG, "Session expired for vault: ${session.vaultId}")
        }

        return isExpired
    }

    /**
     * Nettoie les sessions expirées
     *
     * @param timeoutHours Durée d'expiration en heures
     * @return true si des sessions ont été nettoyées
     */
    suspend fun clearExpiredSessions(timeoutHours: Long = DEFAULT_SESSION_TIMEOUT_HOURS): Boolean {
        return if (isSessionExpired(timeoutHours)) {
            Log.d(TAG, "Clearing expired session")
            lockVault()
            true
        } else {
            Log.d(TAG, "No expired sessions to clear")
            false
        }
    }

    /**
     * Récupère les informations de la session actuelle
     */
    fun getSessionInfo(): SessionInfo? {
        return if (isSessionExpired()) {
            lockVault()
            null
        } else {
            _currentSession.value
        }
    }

    /**
     * Récupère la durée depuis le déverrouillage (en millisecondes)
     */
    fun getSessionDuration(): Long? {
        val session = _currentSession.value ?: return null
        return System.currentTimeMillis() - session.unlockTimestamp
    }

    /**
     * Récupère le temps restant avant expiration (en millisecondes)
     */
    fun getTimeUntilExpiration(timeoutHours: Long = DEFAULT_SESSION_TIMEOUT_HOURS): Long? {
        val session = _currentSession.value ?: return null
        val now = System.currentTimeMillis()
        val timeoutMillis = timeoutHours * 60 * 60 * 1000
        val elapsed = now - session.lastAccessTimestamp
        return (timeoutMillis - elapsed).coerceAtLeast(0)
    }
}
