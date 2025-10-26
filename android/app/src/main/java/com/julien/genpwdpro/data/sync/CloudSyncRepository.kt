package com.julien.genpwdpro.data.sync

import kotlinx.coroutines.flow.Flow

/**
 * Interface cloud-agnostique pour la synchronisation
 *
 * Peut être implémentée pour:
 * - Firebase Realtime Database
 * - Firebase Firestore
 * - AWS S3 + DynamoDB
 * - Backend REST personnalisé
 * - Google Drive
 * - Dropbox
 * - WebDAV
 *
 * Toutes les données sont chiffrées côté client avec AES-256-GCM
 * Le cloud ne stocke que des données chiffrées
 */
interface CloudSyncRepository {

    /**
     * Upload des données chiffrées vers le cloud
     *
     * @param data Données chiffrées à synchroniser
     * @return SyncResult indiquant le succès ou l'échec
     */
    suspend fun upload(data: SyncData): SyncResult

    /**
     * Télécharge les données depuis le cloud
     *
     * @param dataType Type de données à télécharger
     * @param deviceId ID de l'appareil (pour filtrage multi-appareils)
     * @return Liste des données chiffrées
     */
    suspend fun download(dataType: SyncDataType, deviceId: String? = null): List<SyncData>

    /**
     * Télécharge une donnée spécifique
     *
     * @param id Identifiant unique de la donnée
     * @return Données chiffrées ou null si introuvable
     */
    suspend fun downloadById(id: String): SyncData?

    /**
     * Supprime des données du cloud
     *
     * @param id Identifiant de la donnée à supprimer
     */
    suspend fun delete(id: String): SyncResult

    /**
     * Vérifie si des données plus récentes existent dans le cloud
     *
     * @param dataType Type de données
     * @param localTimestamp Timestamp local
     * @return true si des données plus récentes existent
     */
    suspend fun hasNewerData(dataType: SyncDataType, localTimestamp: Long): Boolean

    /**
     * Observe les changements en temps réel (si supporté par le backend)
     *
     * @param dataType Type de données à observer
     * @return Flow d'événements de synchronisation
     */
    fun observeChanges(dataType: SyncDataType): Flow<SyncEvent>

    /**
     * Résout un conflit de synchronisation
     *
     * @param conflict Conflit à résoudre
     * @param strategy Stratégie de résolution
     * @return Données résolues
     */
    suspend fun resolveConflict(
        conflict: SyncResult.Conflict,
        strategy: ConflictResolutionStrategy
    ): SyncData

    /**
     * Obtient les métadonnées de synchronisation
     */
    suspend fun getMetadata(): LocalSyncMetadata

    /**
     * Teste la connexion au cloud
     */
    suspend fun testConnection(): Boolean

    /**
     * Nettoie les anciennes données (> 30 jours par exemple)
     */
    suspend fun cleanup(olderThan: Long)
}

/**
 * Implémentation NoOp pour désactivation de la sync
 */
class NoOpCloudSyncRepository : CloudSyncRepository {
    override suspend fun upload(data: SyncData): SyncResult =
        SyncResult.Error("Sync désactivée")

    override suspend fun download(dataType: SyncDataType, deviceId: String?): List<SyncData> =
        emptyList()

    override suspend fun downloadById(id: String): SyncData? = null

    override suspend fun delete(id: String): SyncResult =
        SyncResult.Error("Sync désactivée")

    override suspend fun hasNewerData(dataType: SyncDataType, localTimestamp: Long): Boolean =
        false

    override fun observeChanges(dataType: SyncDataType): Flow<SyncEvent> =
        kotlinx.coroutines.flow.flowOf()

    override suspend fun resolveConflict(
        conflict: SyncResult.Conflict,
        strategy: ConflictResolutionStrategy
    ): SyncData = conflict.localData

    override suspend fun getMetadata(): LocalSyncMetadata = LocalSyncMetadata()

    override suspend fun testConnection(): Boolean = false

    override suspend fun cleanup(olderThan: Long) {}
}
