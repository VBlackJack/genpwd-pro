package com.julien.genpwd-pro.data.sync

import com.julien.genpwdpro.data.encryption.EncryptedDataEncoded

/**
 * État de synchronisation
 */
enum class SyncStatus {
    IDLE,           // Aucune sync en cours
    SYNCING,        // Synchronisation en cours
    SUCCESS,        // Dernière sync réussie
    ERROR,          // Erreur lors de la sync
    CONFLICT        // Conflit détecté
}

/**
 * Configuration de synchronisation
 */
data class SyncConfig(
    val enabled: Boolean = false,
    val autoSync: Boolean = true,
    val syncInterval: Long = 3600000, // 1 heure en millisecondes
    val lastSyncTimestamp: Long = 0,
    val deviceId: String = "",
    val encryptionKeyId: String = ""
)

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
    SETTINGS,           // Paramètres de l'application
    HISTORY,            // Historique des mots de passe générés
    CUSTOM_WORDS,       // Listes de mots personnalisés
    FAVORITES           // Mots de passe favoris (si fonctionnalité ajoutée)
}

/**
 * Résultat d'une opération de synchronisation
 */
sealed class SyncResult {
    object Success : SyncResult()
    data class Error(val message: String, val exception: Exception? = null) : SyncResult()
    data class Conflict(val localData: SyncData, val remoteData: SyncData) : SyncResult()
}

/**
 * Stratégie de résolution de conflits
 */
enum class ConflictResolutionStrategy {
    LOCAL_WINS,         // Garder les données locales
    REMOTE_WINS,        // Garder les données distantes
    NEWEST_WINS,        // Garder la version la plus récente (timestamp)
    MERGE,              // Fusionner (si possible)
    MANUAL              // Demander à l'utilisateur
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
