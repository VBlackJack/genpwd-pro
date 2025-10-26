package com.julien.genpwdpro.data.sync.models

/**
 * Statut de la synchronisation
 */
enum class SyncStatus {
    /** Jamais synchronisé */
    NEVER_SYNCED,

    /** Synchronisé et à jour */
    SYNCED,

    /** Synchronisation en cours */
    SYNCING,

    /** Changements locaux non synchronisés */
    PENDING,

    /** Erreur de synchronisation */
    ERROR,

    /** Conflit détecté */
    CONFLICT
}

/**
 * Provider cloud supporté
 */
enum class CloudProviderType {
    GOOGLE_DRIVE,
    ONEDRIVE,
    PROTON_DRIVE,
    PCLOUD,
    NONE
}

/**
 * Configuration de la synchronisation
 */
data class SyncConfig(
    val providerType: CloudProviderType,
    val autoSyncEnabled: Boolean = false,
    val syncInterval: SyncInterval = SyncInterval.MANUAL,
    val lastSyncTimestamp: Long = 0,
    val encryptionEnabled: Boolean = true,
    val deviceId: String = ""
)

/**
 * Intervalle de synchronisation
 */
enum class SyncInterval(val minutes: Int) {
    MANUAL(0),
    REALTIME(0),  // Sync immédiat après chaque modification
    EVERY_15_MIN(15),
    EVERY_30_MIN(30),
    HOURLY(60),
    DAILY(1440)
}

/**
 * Résultat d'une opération de synchronisation
 */
sealed class SyncResult {
    object Success : SyncResult()
    data class Conflict(val remoteVersion: VaultSyncData, val localVersion: VaultSyncData) : SyncResult()
    data class Error(val message: String, val exception: Throwable? = null) : SyncResult()
}

/**
 * Données de synchronisation d'un vault
 */
data class VaultSyncData(
    val vaultId: String,
    val encryptedData: ByteArray,
    val timestamp: Long,
    val deviceId: String,
    val checksum: String,
    val version: Int = 1
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as VaultSyncData

        if (vaultId != other.vaultId) return false
        if (!encryptedData.contentEquals(other.encryptedData)) return false
        if (timestamp != other.timestamp) return false
        if (deviceId != other.deviceId) return false
        if (checksum != other.checksum) return false
        if (version != other.version) return false

        return true
    }

    override fun hashCode(): Int {
        var result = vaultId.hashCode()
        result = 31 * result + encryptedData.contentHashCode()
        result = 31 * result + timestamp.hashCode()
        result = 31 * result + deviceId.hashCode()
        result = 31 * result + checksum.hashCode()
        result = 31 * result + version
        return result
    }
}

/**
 * Métadonnées de synchronisation
 */
data class SyncMetadata(
    val vaultId: String,
    val status: SyncStatus,
    val lastSyncTime: Long,
    val lastError: String? = null,
    val pendingChanges: Int = 0,
    val cloudFileId: String? = null
)
