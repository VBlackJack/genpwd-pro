package com.julien.genpwdpro.data.sync

import android.app.Activity
import com.julien.genpwdpro.data.sync.models.VaultSyncData

/**
 * Interface pour les providers de stockage cloud
 *
 * SÉCURITÉ: Tous les providers ne stockent QUE des données chiffrées.
 * Le chiffrement/déchiffrement se fait AVANT l'upload et APRÈS le download.
 */
interface CloudProvider {

    /**
     * Type de provider
     */
    val providerType: String

    /**
     * Vérifie si le provider est connecté et authentifié
     */
    suspend fun isAuthenticated(): Boolean

    /**
     * Initie le processus d'authentification OAuth2
     *
     * @param activity Activité pour lancer l'intent OAuth
     * @return true si authentification réussie
     */
    suspend fun authenticate(activity: Activity): Boolean

    /**
     * Déconnecte le provider
     */
    suspend fun disconnect()

    /**
     * Upload des données de vault chiffrées vers le cloud
     *
     * @param vaultId ID du vault
     * @param syncData Données chiffrées du vault
     * @return ID du fichier cloud si succès, null si échec
     */
    suspend fun uploadVault(vaultId: String, syncData: VaultSyncData): String?

    /**
     * Download des données de vault chiffrées depuis le cloud
     *
     * @param vaultId ID du vault
     * @return Données chiffrées du vault, null si non trouvé
     */
    suspend fun downloadVault(vaultId: String): VaultSyncData?

    /**
     * Vérifie si une version plus récente existe sur le cloud
     *
     * @param vaultId ID du vault
     * @param localTimestamp Timestamp de la version locale
     * @return true si version cloud plus récente
     */
    suspend fun hasNewerVersion(vaultId: String, localTimestamp: Long): Boolean

    /**
     * Récupère les métadonnées du fichier cloud
     *
     * @param vaultId ID du vault
     * @return Métadonnées (timestamp, taille, etc.) ou null
     */
    suspend fun getCloudMetadata(vaultId: String): CloudFileMetadata?

    /**
     * Supprime le vault du cloud
     *
     * @param vaultId ID du vault
     * @return true si suppression réussie
     */
    suspend fun deleteVault(vaultId: String): Boolean

    /**
     * Liste tous les vaults disponibles sur le cloud
     *
     * @return Liste des IDs de vaults
     */
    suspend fun listVaults(): List<String>

    /**
     * Récupère l'espace de stockage disponible
     *
     * @return Quota (utilisé, total) en bytes, null si non disponible
     */
    suspend fun getStorageQuota(): StorageQuota?
}

/**
 * Métadonnées d'un fichier cloud
 */
data class CloudFileMetadata(
    val fileId: String,
    val name: String,
    val size: Long,
    val modifiedTime: Long,
    val checksum: String?
)

/**
 * Quota de stockage
 */
data class StorageQuota(
    val usedBytes: Long,
    val totalBytes: Long
) {
    val usedPercentage: Float
        get() = if (totalBytes > 0) (usedBytes.toFloat() / totalBytes) * 100 else 0f

    val availableBytes: Long
        get() = totalBytes - usedBytes
}
