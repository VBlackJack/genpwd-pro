package com.julien.genpwdpro.data.sync

import android.util.Log
import com.julien.genpwdpro.data.sync.models.ConflictResolutionStrategy
import com.julien.genpwdpro.data.sync.models.VaultSyncData
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Résolveur de conflits pour la synchronisation
 *
 * Stratégies de résolution:
 * - LOCAL_WINS: Garder la version locale
 * - REMOTE_WINS: Garder la version cloud
 * - NEWEST_WINS: Garder la plus récente (timestamp)
 * - SMART_MERGE: Fusion intelligente (placeholder pour implémentation future)
 * - MANUAL: Demander à l'utilisateur
 *
 * Détection de conflits:
 * - Versions modifiées simultanément sur différents appareils
 * - Checksums différents
 * - Timestamps conflictuels
 */
@Singleton
class ConflictResolver @Inject constructor() {

    companion object {
        private const val TAG = "ConflictResolver"
        private const val CONFLICT_THRESHOLD_MS = 5000L // 5 secondes
    }

    /**
     * Résout un conflit entre version locale et distante
     *
     * @param local Version locale
     * @param remote Version distante
     * @param strategy Stratégie de résolution
     * @return Version à conserver
     */
    fun resolve(
        local: VaultSyncData,
        remote: VaultSyncData,
        strategy: ConflictResolutionStrategy
    ): VaultSyncData {
        Log.d(TAG, "Resolving conflict with strategy: $strategy")
        Log.d(TAG, "Local timestamp: ${local.timestamp}, Remote timestamp: ${remote.timestamp}")

        return when (strategy) {
            ConflictResolutionStrategy.LOCAL_WINS -> {
                Log.d(TAG, "Keeping local version")
                local
            }

            ConflictResolutionStrategy.REMOTE_WINS -> {
                Log.d(TAG, "Keeping remote version")
                remote
            }

            ConflictResolutionStrategy.NEWEST_WINS -> {
                if (remote.timestamp > local.timestamp) {
                    Log.d(TAG, "Remote is newer, keeping remote")
                    remote
                } else {
                    Log.d(TAG, "Local is newer or equal, keeping local")
                    local
                }
            }

            ConflictResolutionStrategy.SMART_MERGE -> {
                // TODO: Implémenter la fusion intelligente
                // Pour l'instant, utiliser NEWEST_WINS
                Log.w(TAG, "SMART_MERGE not implemented yet, falling back to NEWEST_WINS")
                if (remote.timestamp > local.timestamp) remote else local
            }

            ConflictResolutionStrategy.MANUAL -> {
                // Retourner la version locale par défaut
                // L'UI devra demander à l'utilisateur
                Log.d(TAG, "MANUAL resolution required, returning local for now")
                local
            }
        }
    }

    /**
     * Détecte s'il y a un conflit réel entre deux versions
     *
     * @param local Version locale
     * @param remote Version distante
     * @return true si conflit détecté
     */
    fun hasConflict(local: VaultSyncData, remote: VaultSyncData): Boolean {
        // Pas de conflit si les checksums sont identiques
        if (local.checksum == remote.checksum) {
            Log.d(TAG, "No conflict: checksums match")
            return false
        }

        // Pas de conflit si c'est le même appareil
        if (local.deviceId == remote.deviceId) {
            Log.d(TAG, "No conflict: same device")
            return false
        }

        // Conflit si les timestamps sont très proches (modifications simultanées)
        val timeDiff = kotlin.math.abs(local.timestamp - remote.timestamp)
        if (timeDiff < CONFLICT_THRESHOLD_MS) {
            Log.d(TAG, "Conflict detected: simultaneous modifications (diff: ${timeDiff}ms)")
            return true
        }

        // Pas de conflit si l'un est clairement plus récent
        if (kotlin.math.abs(local.timestamp - remote.timestamp) > CONFLICT_THRESHOLD_MS) {
            Log.d(TAG, "No conflict: clear time difference")
            return false
        }

        // Par défaut, considérer comme conflit si les checksums diffèrent
        Log.d(TAG, "Conflict detected: different checksums")
        return true
    }

    /**
     * Suggère la meilleure stratégie de résolution
     *
     * @param local Version locale
     * @param remote Version distante
     * @return Stratégie suggérée
     */
    fun suggestStrategy(
        local: VaultSyncData,
        remote: VaultSyncData
    ): ConflictResolutionStrategy {
        // Si c'est le même appareil, garder local
        if (local.deviceId == remote.deviceId) {
            return ConflictResolutionStrategy.LOCAL_WINS
        }

        // Si les modifications sont très proches dans le temps, demander à l'utilisateur
        val timeDiff = kotlin.math.abs(local.timestamp - remote.timestamp)
        if (timeDiff < CONFLICT_THRESHOLD_MS) {
            return ConflictResolutionStrategy.MANUAL
        }

        // Si l'un est clairement plus récent, utiliser NEWEST_WINS
        if (timeDiff > CONFLICT_THRESHOLD_MS) {
            return ConflictResolutionStrategy.NEWEST_WINS
        }

        // Par défaut, demander à l'utilisateur
        return ConflictResolutionStrategy.MANUAL
    }

    /**
     * Détermine quelle version est la plus récente
     *
     * @param local Version locale
     * @param remote Version distante
     * @return true si remote est plus récent
     */
    fun isRemoteNewer(local: VaultSyncData, remote: VaultSyncData): Boolean {
        return remote.timestamp > local.timestamp
    }

    /**
     * Calcule le score de priorité pour une version
     * Score plus élevé = version plus importante
     *
     * @param data Version à évaluer
     * @param isLocal true si c'est la version locale
     * @return Score de priorité
     */
    private fun calculatePriorityScore(data: VaultSyncData, isLocal: Boolean): Int {
        var score = 0

        // Version plus récente = score plus élevé
        score += (data.timestamp / 1000).toInt()

        // Version locale a un bonus (préférence pour local)
        if (isLocal) {
            score += 1000
        }

        // Version avec checksum valide
        if (data.checksum.isNotBlank()) {
            score += 100
        }

        return score
    }

    /**
     * Compare les priorités entre local et remote
     *
     * @param local Version locale
     * @param remote Version distante
     * @return > 0 si local prioritaire, < 0 si remote prioritaire, 0 si égal
     */
    fun comparePriority(local: VaultSyncData, remote: VaultSyncData): Int {
        val localScore = calculatePriorityScore(local, true)
        val remoteScore = calculatePriorityScore(remote, false)
        return localScore - remoteScore
    }
}
