package com.julien.genpwdpro.data.sync.models

/**
 * État de synchronisation d'un vault
 */
enum class SyncStatus {
    NEVER_SYNCED, // Jamais synchronisé
    SYNCED, // Synchronisé, à jour
    SYNCING, // Synchronisation en cours
    PENDING, // Modifications en attente
    ERROR, // Erreur de sync
    CONFLICT // Conflit détecté
}

/**
 * Type de provider cloud
 */
enum class CloudProviderType {
    GOOGLE_DRIVE,
    ONEDRIVE,
    PROTON_DRIVE,
    PCLOUD,
    WEBDAV, // Serveur WebDAV personnalisé
    NONE
}

/**
 * Intervalle de synchronisation automatique
 */
enum class SyncInterval {
    MANUAL, // Synchronisation manuelle uniquement
    REALTIME, // Temps réel (après chaque modification)
    EVERY_15_MIN, // Toutes les 15 minutes
    EVERY_30_MIN, // Toutes les 30 minutes
    HOURLY, // Toutes les heures
    DAILY // Une fois par jour
}

/**
 * Configuration de synchronisation cloud
 */
data class SyncConfig(
    val enabled: Boolean = false,
    val providerType: CloudProviderType = CloudProviderType.NONE,
    val syncInterval: SyncInterval = SyncInterval.MANUAL,
    val autoSync: Boolean = false,
    val syncOnWifiOnly: Boolean = true,
    val deviceId: String = "",
    val deviceName: String = ""
)

/**
 * Données d'un vault à synchroniser (chiffrées)
 *
 * Sécurité:
 * - Toutes les données sont déjà chiffrées AVANT l'upload
 * - Le cloud ne voit QUE des données chiffrées
 * - Impossible de déchiffrer sans le master password
 */
data class VaultSyncData(
    val vaultId: String,
    val vaultName: String, // Nom en clair (pour l'utilisateur)
    val encryptedData: ByteArray, // Vault + entrées chiffrées
    val timestamp: Long, // Date de dernière modification
    val version: Int, // Version du format
    val deviceId: String, // ID de l'appareil ayant créé cette version
    val checksum: String // SHA-256 pour intégrité
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as VaultSyncData

        if (vaultId != other.vaultId) return false
        if (vaultName != other.vaultName) return false
        if (!encryptedData.contentEquals(other.encryptedData)) return false
        if (timestamp != other.timestamp) return false
        if (version != other.version) return false
        if (deviceId != other.deviceId) return false
        if (checksum != other.checksum) return false

        return true
    }

    override fun hashCode(): Int {
        var result = vaultId.hashCode()
        result = 31 * result + vaultName.hashCode()
        result = 31 * result + encryptedData.contentHashCode()
        result = 31 * result + timestamp.hashCode()
        result = 31 * result + version
        result = 31 * result + deviceId.hashCode()
        result = 31 * result + checksum.hashCode()
        return result
    }
}

/**
 * Métadonnées de synchronisation par vault
 */
data class SyncMetadata(
    val vaultId: String,
    val status: SyncStatus = SyncStatus.NEVER_SYNCED,
    val lastSyncTimestamp: Long = 0,
    val lastSuccessfulSync: Long = 0,
    val cloudFileId: String? = null, // ID du fichier sur le cloud
    val cloudModifiedTime: Long = 0,
    val localModifiedTime: Long = 0,
    val errorMessage: String? = null,
    val conflictDetected: Boolean = false,
    val pendingChanges: Boolean = false
)

/**
 * Informations sur un fichier cloud
 */
data class CloudFileMetadata(
    val fileId: String,
    val fileName: String,
    val size: Long,
    val modifiedTime: Long,
    val checksum: String?,
    val version: String?
)

/**
 * Quota de stockage cloud
 */
data class StorageQuota(
    val totalBytes: Long,
    val usedBytes: Long,
    val freeBytes: Long
) {
    val usagePercent: Float
        get() = if (totalBytes > 0) (usedBytes.toFloat() / totalBytes.toFloat()) * 100f else 0f
}

/**
 * Résultat d'une opération de synchronisation
 */
sealed class SyncResult {
    object Success : SyncResult()

    data class Conflict(
        val remoteVersion: VaultSyncData,
        val localVersion: VaultSyncData
    ) : SyncResult()

    data class Error(
        val message: String,
        val exception: Exception? = null
    ) : SyncResult()
}

/**
 * Stratégie de résolution de conflits
 */
enum class ConflictResolutionStrategy {
    LOCAL_WINS, // Garder la version locale
    REMOTE_WINS, // Garder la version cloud
    NEWEST_WINS, // Garder la plus récente (timestamp)
    SMART_MERGE, // Fusion intelligente (si possible)
    MANUAL // Demander à l'utilisateur
}
