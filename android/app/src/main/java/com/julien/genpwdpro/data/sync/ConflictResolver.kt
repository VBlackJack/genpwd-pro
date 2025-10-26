package com.julien.genpwdpro.data.sync

import com.google.gson.Gson
import com.julien.genpwdpro.data.local.entity.VaultEntryEntity
import com.julien.genpwdpro.data.sync.models.VaultSyncData
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Résolveur de conflits de synchronisation
 *
 * Stratégies supportées:
 * 1. NEWEST_WINS: La version la plus récente (timestamp) gagne
 * 2. LOCAL_WINS: La version locale est conservée
 * 3. REMOTE_WINS: La version distante est conservée
 * 4. SMART_MERGE: Fusion intelligente des entrées
 */
@Singleton
class ConflictResolver @Inject constructor(
    private val gson: Gson
) {

    /**
     * Résout un conflit entre données locales et distantes
     *
     * @param local Données locales
     * @param remote Données distantes
     * @param strategy Stratégie de résolution
     * @return Données résultantes après résolution
     */
    fun resolve(
        local: VaultSyncData,
        remote: VaultSyncData,
        strategy: ConflictResolutionStrategy
    ): VaultSyncData {
        return when (strategy) {
            ConflictResolutionStrategy.LOCAL_WINS -> local
            ConflictResolutionStrategy.REMOTE_WINS -> remote
            ConflictResolutionStrategy.NEWEST_WINS -> resolveNewestWins(local, remote)
            ConflictResolutionStrategy.MERGE -> mergeSmart(local, remote)
            ConflictResolutionStrategy.MANUAL -> local // Par défaut, requiert intervention utilisateur
        }
    }

    /**
     * Stratégie: La version la plus récente gagne
     */
    private fun resolveNewestWins(local: VaultSyncData, remote: VaultSyncData): VaultSyncData {
        return if (remote.timestamp > local.timestamp) remote else local
    }

    /**
     * Stratégie: Fusion intelligente
     *
     * Fusionne les entrées de vault en conservant:
     * - Les entrées uniquement locales
     * - Les entrées uniquement distantes
     * - La version la plus récente pour les entrées communes
     */
    private fun mergeSmart(local: VaultSyncData, remote: VaultSyncData): VaultSyncData {
        return try {
            // Pour l'instant, on utilise NEWEST_WINS
            // Une vraie fusion nécessiterait de déchiffrer et comparer les entrées
            // Ce qui nécessite le master password que nous n'avons pas ici
            resolveNewestWins(local, remote)
        } catch (e: Exception) {
            // En cas d'erreur, conserver la version locale
            local
        }
    }

    /**
     * Détermine si deux versions sont en conflit
     */
    fun hasConflict(local: VaultSyncData, remote: VaultSyncData): Boolean {
        // Pas de conflit si les checksums sont identiques
        if (local.checksum == remote.checksum) return false

        // Pas de conflit si les timestamps sont très différents (> 1 minute)
        val timeDiff = kotlin.math.abs(local.timestamp - remote.timestamp)
        if (timeDiff > 60000) return false

        // Conflit si modifications simultanées sur différents appareils
        return local.deviceId != remote.deviceId
    }

    /**
     * Stratégie automatique basée sur l'analyse du conflit
     */
    fun suggestStrategy(local: VaultSyncData, remote: VaultSyncData): ConflictResolutionStrategy {
        return when {
            // Si même device, c'est une erreur, garder le plus récent
            local.deviceId == remote.deviceId -> ConflictResolutionStrategy.NEWEST_WINS

            // Si différence de temps > 1 heure, garder le plus récent
            kotlin.math.abs(local.timestamp - remote.timestamp) > 3600000 ->
                ConflictResolutionStrategy.NEWEST_WINS

            // Si modifications simultanées, demander à l'utilisateur
            else -> ConflictResolutionStrategy.MANUAL
        }
    }
}

/**
 * Résultats d'une opération de merge
 */
data class MergeResult(
    val merged: VaultSyncData,
    val conflicts: List<ConflictDetails>,
    val strategy: ConflictResolutionStrategy
)

/**
 * Détails d'un conflit détecté
 */
data class ConflictDetails(
    val entryId: String,
    val localValue: String,
    val remoteValue: String,
    val field: String
)
