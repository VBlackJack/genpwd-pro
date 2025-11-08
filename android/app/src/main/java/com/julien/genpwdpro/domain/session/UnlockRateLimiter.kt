package com.julien.genpwdpro.domain.session

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.julien.genpwdpro.core.log.SafeLog
import dagger.hilt.android.qualifiers.ApplicationContext
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
 * - PERSISTENCE: État sauvegardé dans EncryptedSharedPreferences (survit au restart)
 *
 * Sécurité:
 * - Protection contre brute force attacks
 * - Limite à 5 tentatives par défaut (configurable)
 * - Lockout de 5 minutes (300 secondes)
 * - Logs sécurisés (vaultId redacted)
 * - État persisté de manière chiffrée (EncryptedSharedPreferences)
 * - ANTI-BYPASS: Attaquant ne peut pas bypass en force-kill + restart
 */
@Singleton
class UnlockRateLimiter @Inject constructor(
    @ApplicationContext private val context: Context
) {

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

        /**
         * Nom du fichier EncryptedSharedPreferences
         */
        private const val PREFS_NAME = "rate_limiter_secure"

        /**
         * Clé de préfixe pour les tentatives échouées
         */
        private const val KEY_PREFIX_ATTEMPTS = "attempts_"

        /**
         * Clé de préfixe pour les timestamps de lockout
         */
        private const val KEY_PREFIX_LOCKOUT = "lockout_"
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

    // PERSISTENCE: EncryptedSharedPreferences pour survie au restart
    private val encryptedPrefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    // Map: vaultId → nombre de tentatives échouées (in-memory cache)
    private val failedAttempts = mutableMapOf<String, Int>()

    // Map: vaultId → timestamp de fin de verrouillage (in-memory cache)
    private val lockoutUntil = mutableMapOf<String, Long>()

    // Mutex pour garantir thread-safety
    private val mutex = Mutex()

    init {
        // Restore state from encrypted storage on startup
        restoreStateFromStorage()
        SafeLog.i(TAG, "UnlockRateLimiter initialized with persisted state")
    }

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

                // PERSIST lockout state to survive restart
                persistState(vaultId)

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

            // PERSIST state to survive restart
            persistState(vaultId)

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

            // PERSIST success (removes from storage)
            persistState(vaultId)

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

            // PERSIST reset
            persistState(vaultId)

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
            encryptedPrefs.edit().clear().apply()
            SafeLog.i(TAG, "All rate limiters reset")
        }
    }

    /**
     * Persists current state to EncryptedSharedPreferences
     *
     * SECURITY: All data is encrypted at rest to prevent tampering
     */
    private fun persistState(vaultId: String) {
        try {
            val editor = encryptedPrefs.edit()

            // Persist failed attempts
            val attempts = failedAttempts[vaultId]
            if (attempts != null) {
                editor.putInt(KEY_PREFIX_ATTEMPTS + vaultId, attempts)
            } else {
                editor.remove(KEY_PREFIX_ATTEMPTS + vaultId)
            }

            // Persist lockout timestamp
            val lockout = lockoutUntil[vaultId]
            if (lockout != null) {
                editor.putLong(KEY_PREFIX_LOCKOUT + vaultId, lockout)
            } else {
                editor.remove(KEY_PREFIX_LOCKOUT + vaultId)
            }

            editor.apply()
            SafeLog.d(TAG, "State persisted for vault: ${SafeLog.redact(vaultId)}")
        } catch (e: Exception) {
            SafeLog.e(TAG, "Failed to persist rate limiter state", e)
            // Non-fatal - continue with in-memory state
        }
    }

    /**
     * Restores state from EncryptedSharedPreferences on startup
     *
     * ANTI-BYPASS: Attackers cannot bypass rate limiting by force-killing app
     */
    private fun restoreStateFromStorage() {
        try {
            val all = encryptedPrefs.all
            val now = System.currentTimeMillis()

            all.forEach { (key, value) ->
                when {
                    key.startsWith(KEY_PREFIX_ATTEMPTS) -> {
                        val vaultId = key.removePrefix(KEY_PREFIX_ATTEMPTS)
                        val attempts = value as? Int ?: 0
                        if (attempts > 0) {
                            failedAttempts[vaultId] = attempts
                            SafeLog.d(TAG, "Restored ${attempts} failed attempts for vault: ${SafeLog.redact(vaultId)}")
                        }
                    }
                    key.startsWith(KEY_PREFIX_LOCKOUT) -> {
                        val vaultId = key.removePrefix(KEY_PREFIX_LOCKOUT)
                        val lockoutEnd = value as? Long ?: 0L
                        // Only restore if lockout hasn't expired
                        if (lockoutEnd > now) {
                            lockoutUntil[vaultId] = lockoutEnd
                            val remainingSeconds = (lockoutEnd - now) / 1000
                            SafeLog.w(TAG, "Restored lockout for vault: ${SafeLog.redact(vaultId)}, remaining=${remainingSeconds}s")
                        } else {
                            // Lockout expired, clean up
                            encryptedPrefs.edit()
                                .remove(KEY_PREFIX_LOCKOUT + vaultId)
                                .remove(KEY_PREFIX_ATTEMPTS + vaultId)
                                .apply()
                        }
                    }
                }
            }

            SafeLog.i(TAG, "State restored from encrypted storage: ${failedAttempts.size} vaults tracked")
        } catch (e: Exception) {
            SafeLog.e(TAG, "Failed to restore rate limiter state", e)
            // Non-fatal - start with clean state
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
