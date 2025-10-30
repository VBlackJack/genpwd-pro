package com.julien.genpwdpro.data.sync

import com.julien.genpwdpro.data.encryption.EncryptedDataEncoded

// NOTE: ConflictResolutionStrategy is also defined in models/SyncStatus.kt
// But we keep a local copy for CloudSyncRepository to use with SyncData
// VaultSyncManager uses the one from models/ with VaultSyncData

/**
 * Données synchronisées (chiffrées)
 *
 * Structure:
 * - Toutes les données sensibles sont chiffrées avec AES-256-GCM
 * - Chaque appareil a sa propre clé de chiffrement
 * - Les métadonnées (timestamps, deviceId) ne sont PAS chiffrées
 */
data class SyncData(
    val id: String,
    val deviceId: String,
    val timestamp: Long,
    val version: Int,
    val dataType: SyncDataType,
    val encryptedPayload: EncryptedDataEncoded,
    val checksum: String // SHA-256 du payload non chiffré (pour détection de conflits)
)

/**
 * Types de données synchronisables
 */
enum class SyncDataType {
    SETTINGS, // Paramètres de l'application
    HISTORY, // Historique des mots de passe générés
    CUSTOM_WORDS, // Listes de mots personnalisés
    FAVORITES // Mots de passe favoris (si fonctionnalité ajoutée)
}

/**
 * Résultat d'une opération de synchronisation (uses VaultSyncData from models package)
 */
sealed class SyncResult {
    object Success : SyncResult()
    data class Error(val message: String, val exception: Exception? = null) : SyncResult()
    data class Conflict(val localData: SyncData, val remoteData: SyncData) : SyncResult()
}

/**
 * Stratégie de résolution de conflits (sync package version - for CloudSyncRepository)
 * NOTE: VaultSyncManager uses the version from models/SyncStatus.kt
 */
enum class ConflictResolutionStrategy {
    LOCAL_WINS, // Garder les données locales
    REMOTE_WINS, // Garder les données distantes
    NEWEST_WINS, // Garder la version la plus récente (timestamp)
    MERGE, // Fusionner (si possible)
    MANUAL // Demander à l'utilisateur
}

/**
 * Événement de synchronisation
 */
sealed class SyncEvent {
    object Started : SyncEvent()
    data class Progress(val current: Int, val total: Int) : SyncEvent()
    data class ItemSynced(val dataType: SyncDataType) : SyncEvent()
    object Completed : SyncEvent()
    data class Failed(val error: String) : SyncEvent()
    data class ConflictDetected(val dataType: SyncDataType) : SyncEvent()
}

/**
 * Métadonnées de synchronisation locale
 */
data class LocalSyncMetadata(
    val lastSyncTimestamp: Long = 0,
    val lastSuccessfulSyncTimestamp: Long = 0,
    val pendingChanges: Int = 0,
    val conflictCount: Int = 0,
    val syncErrors: List<String> = emptyList()
)
