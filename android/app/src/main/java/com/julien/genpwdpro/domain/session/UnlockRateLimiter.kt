package com.julien.genpwdpro.domain.session

import com.julien.genpwdpro.core.log.SafeLog
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Rate limiter pour les tentatives de déverrouillage de vault
 *
 * Empêche les attaques par brute force en limitant le nombre de tentatives
 * de déverrouillage échouées et en imposant un verrouillage temporaire.
 *
 * Fonctionnalités:
 * - Compteur de tentatives échouées par vault
 * - Verrouillage automatique après MAX_ATTEMPTS tentatives
 * - Durée de verrouillage configurable (par défaut 5 minutes)
 * - Réinitialisation automatique après expiration du verrouillage
 * - Thread-safe avec Mutex
 *
 * Sécurité:
 * - Protection contre brute force attacks
 * - Limite à 5 tentatives par défaut (configurable)
 * - Lockout de 5 minutes (300 secondes)
 * - Logs sécurisés (vaultId redacted)
 */
@Singleton
class UnlockRateLimiter @Inject constructor() {

    companion object {
        private const val TAG = "UnlockRateLimiter"

        /**
         * Nombre maximal de tentatives échouées avant verrouillage
         */
        private const val MAX_ATTEMPTS = 5

        /**
         * Durée du verrouillage en millisecondes (5 minutes)
         */
        private const val LOCKOUT_DURATION_MS = 5 * 60 * 1000L // 5 minutes
    }

    /**
     * Résultat d'une vérification de rate limiting
     */
    sealed class RateLimitResult {
        /**
         * Tentative autorisée
         * @property attemptsRemaining Nombre de tentatives restantes avant lockout
         */
        data class Allowed(val attemptsRemaining: Int) : RateLimitResult()

        /**
         * Verrouillé en raison de trop de tentatives échouées
         * @property secondsRemaining Nombre de secondes avant déblocage
         */
        data class LockedOut(val secondsRemaining: Long) : RateLimitResult()
    }

    // Map: vaultId → nombre de tentatives échouées
    private val failedAttempts = mutableMapOf<String, Int>()

    // Map: vaultId → timestamp de fin de verrouillage
    private val lockoutUntil = mutableMapOf<String, Long>()

    // Mutex pour garantir thread-safety
    private val mutex = Mutex()

    /**
     * Vérifie si une tentative de déverrouillage est autorisée et incrémente le compteur
     *
     * Cette méthode DOIT être appelée AVANT chaque tentative de déverrouillage.
     *
     * @param vaultId ID du vault
     * @return RateLimitResult.Allowed si autorisé, RateLimitResult.LockedOut sinon
     */
    suspend fun checkAndRecordAttempt(vaultId: String): RateLimitResult {
        return mutex.withLock {
            val now = System.currentTimeMillis()

            // 1. Vérifier si actuellement verrouillé
            lockoutUntil[vaultId]?.let { until ->
                if (now < until) {
                    val remainingSeconds = (until - now) / 1000
                    SafeLog.w(
                        TAG,
                        "Vault locked out: vaultId=${SafeLog.redact(vaultId)}, " +
                        "remaining=${remainingSeconds}s"
                    )
                    return@withLock RateLimitResult.LockedOut(remainingSeconds)
                } else {
                    // Verrouillage expiré, réinitialiser
                    SafeLog.i(
                        TAG,
                        "Lockout expired for vault: vaultId=${SafeLog.redact(vaultId)}"
                    )
                    failedAttempts.remove(vaultId)
                    lockoutUntil.remove(vaultId)
                }
            }

            // 2. Vérifier le nombre de tentatives
            val attempts = failedAttempts.getOrDefault(vaultId, 0)
            if (attempts >= MAX_ATTEMPTS) {
                // Atteint la limite, verrouiller
                val lockoutEndTime = now + LOCKOUT_DURATION_MS
                lockoutUntil[vaultId] = lockoutEndTime

                SafeLog.w(
                    TAG,
                    "Max attempts reached for vault: vaultId=${SafeLog.redact(vaultId)}, " +
                    "locking for ${LOCKOUT_DURATION_MS / 1000}s"
                )

                return@withLock RateLimitResult.LockedOut(LOCKOUT_DURATION_MS / 1000)
            }

            // 3. Incrémenter le compteur de tentatives
            val newAttempts = attempts + 1
            failedAttempts[vaultId] = newAttempts

            val remaining = MAX_ATTEMPTS - newAttempts
            SafeLog.d(
                TAG,
                "Unlock attempt recorded: vaultId=${SafeLog.redact(vaultId)}, " +
                "attemptsRemaining=$remaining"
            )

            RateLimitResult.Allowed(remaining)
        }
    }

    /**
     * Enregistre une tentative de déverrouillage réussie et réinitialise les compteurs
     *
     * Cette méthode DOIT être appelée après un déverrouillage réussi.
     *
     * @param vaultId ID du vault
     */
    suspend fun recordSuccess(vaultId: String) {
        mutex.withLock {
            val hadFailures = failedAttempts.containsKey(vaultId)
            failedAttempts.remove(vaultId)
            lockoutUntil.remove(vaultId)

            if (hadFailures) {
                SafeLog.i(
                    TAG,
                    "Unlock successful, counters reset: vaultId=${SafeLog.redact(vaultId)}"
                )
            }
        }
    }

    /**
     * Réinitialise manuellement les compteurs pour un vault
     *
     * Utilisation typique: après une réinitialisation manuelle par l'administrateur
     *
     * @param vaultId ID du vault
     */
    suspend fun reset(vaultId: String) {
        mutex.withLock {
            failedAttempts.remove(vaultId)
            lockoutUntil.remove(vaultId)
            SafeLog.i(
                TAG,
                "Rate limiter reset for vault: vaultId=${SafeLog.redact(vaultId)}"
            )
        }
    }

    /**
     * Réinitialise tous les compteurs (tous les vaults)
     *
     * Utilisation typique: tests ou réinitialisation globale
     */
    suspend fun resetAll() {
        mutex.withLock {
            failedAttempts.clear()
            lockoutUntil.clear()
            SafeLog.i(TAG, "All rate limiters reset")
        }
    }

    /**
     * Obtient le statut actuel pour un vault
     *
     * @param vaultId ID du vault
     * @return Nombre de tentatives échouées et temps de verrouillage restant (si applicable)
     */
    suspend fun getStatus(vaultId: String): Pair<Int, Long?> {
        return mutex.withLock {
            val attempts = failedAttempts.getOrDefault(vaultId, 0)
            val lockoutEnd = lockoutUntil[vaultId]
            val remainingSeconds = lockoutEnd?.let { end ->
                val now = System.currentTimeMillis()
                if (now < end) (end - now) / 1000 else null
            }
            attempts to remainingSeconds
        }
    }
}
