package com.julien.genpwdpro.data.sync

import android.app.Activity
import com.julien.genpwdpro.data.sync.models.CloudFileMetadata
import com.julien.genpwdpro.data.sync.models.StorageQuota
import com.julien.genpwdpro.data.sync.models.VaultSyncData

/**
 * Interface commune pour tous les providers cloud
 *
 * Implémentations:
 * - GoogleDriveProvider: Google Drive
 * - OneDriveProvider: Microsoft OneDrive (à venir)
 * - ProtonDriveProvider: Proton Drive (à venir)
 * - PCloudProvider: pCloud (à venir)
 *
 * Sécurité:
 * - Tous les providers manipulent UNIQUEMENT des données chiffrées
 * - Le chiffrement/déchiffrement se fait AVANT/APRÈS l'upload/download
 * - Les providers ne voient jamais les données en clair
 */
interface CloudProvider {

    /**
     * Vérifie si l'utilisateur est authentifié
     */
    suspend fun isAuthenticated(): Boolean

    /**
     * Authentifie l'utilisateur (OAuth2)
     *
     * @param activity Activity pour le flow OAuth
     * @return true si l'authentification a réussi
     */
    suspend fun authenticate(activity: Activity): Boolean

    /**
     * Déconnecte l'utilisateur
     */
    suspend fun disconnect()

    /**
     * Upload un vault chiffré vers le cloud
     *
     * @param vaultId ID du vault
     * @param syncData Données chiffrées à synchroniser
     * @return ID du fichier cloud, ou null en cas d'erreur
     */
    suspend fun uploadVault(vaultId: String, syncData: VaultSyncData): String?

    /**
     * Télécharge un vault depuis le cloud
     *
     * @param vaultId ID du vault
     * @return Données chiffrées, ou null si le vault n'existe pas
     */
    suspend fun downloadVault(vaultId: String): VaultSyncData?

    /**
     * Vérifie si une version plus récente existe sur le cloud
     *
     * @param vaultId ID du vault
     * @param localTimestamp Timestamp local
     * @return true si la version cloud est plus récente
     */
    suspend fun hasNewerVersion(vaultId: String, localTimestamp: Long): Boolean

    /**
     * Supprime un vault du cloud
     *
     * @param vaultId ID du vault
     * @return true si la suppression a réussi
     */
    suspend fun deleteVault(vaultId: String): Boolean

    /**
     * Récupère les métadonnées d'un fichier cloud
     *
     * @param vaultId ID du vault
     * @return Métadonnées, ou null si le fichier n'existe pas
     */
    suspend fun getCloudMetadata(vaultId: String): CloudFileMetadata?

    /**
     * Liste tous les vaults synchronisés
     *
     * @return Liste des métadonnées de fichiers cloud
     */
    suspend fun listVaults(): List<CloudFileMetadata>

    /**
     * Récupère le quota de stockage
     *
     * @return Informations sur le stockage, ou null en cas d'erreur
     */
    suspend fun getStorageQuota(): StorageQuota?
}
