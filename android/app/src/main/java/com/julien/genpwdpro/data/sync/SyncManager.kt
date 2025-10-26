package com.julien.genpwd-pro.data.sync

import android.content.Context
import com.google.gson.Gson
import com.julien.genpwd-pro.data.encryption.EncryptionManager
import com.julien.genpwd-pro.data.models.Settings
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.security.MessageDigest
import java.util.UUID
import javax.crypto.SecretKey
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Gestionnaire de synchronisation cloud avec chiffrement E2E
 *
 * Workflow:
 * 1. Données locales → JSON
 * 2. JSON → Chiffré avec AES-256-GCM
 * 3. Upload vers cloud (données chiffrées uniquement)
 * 4. Download depuis cloud
 * 5. Déchiffrement AES-256-GCM → JSON
 * 6. JSON → Données locales
 *
 * Sécurité:
 * - Toutes les données sensibles sont chiffrées côté client
 * - La clé de chiffrement ne quitte JAMAIS l'appareil
 * - Le cloud ne stocke que des données chiffrées
 * - Authentification par tag GCM (anti-tampering)
 */
@Singleton
class SyncManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val encryptionManager: EncryptionManager,
    private val cloudRepository: CloudSyncRepository,
    private val gson: Gson
) {

    private val _syncStatus = MutableStateFlow<SyncStatus>(SyncStatus.IDLE)
    val syncStatus: Flow<SyncStatus> = _syncStatus.asStateFlow()

    private val _syncEvents = MutableStateFlow<SyncEvent>(SyncEvent.Completed)
    val syncEvents: Flow<SyncEvent> = _syncEvents.asStateFlow()

    // Clé de chiffrement stockée en mémoire (rechargée à chaque lancement)
    private var encryptionKey: SecretKey? = null

    companion object {
        private const val PREFS_NAME = "sync_prefs"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_ENCRYPTION_KEY = "encryption_key"
        private const val KEY_LAST_SYNC = "last_sync_timestamp"
    }

    /**
     * Initialise la synchronisation (génère ou charge la clé)
     */
    suspend fun initialize() {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        // Charger ou générer l'ID de l'appareil
        val deviceId = prefs.getString(KEY_DEVICE_ID, null) ?: run {
            val newId = UUID.randomUUID().toString()
            prefs.edit().putString(KEY_DEVICE_ID, newId).apply()
            newId
        }

        // Charger ou générer la clé de chiffrement
        encryptionKey = prefs.getString(KEY_ENCRYPTION_KEY, null)?.let {
            encryptionManager.decodeKey(it)
        } ?: run {
            val newKey = encryptionManager.generateKey()
            val encodedKey = encryptionManager.encodeKey(newKey)
            prefs.edit().putString(KEY_ENCRYPTION_KEY, encodedKey).apply()
            newKey
        }
    }

    /**
     * Synchronise les paramètres
     */
    suspend fun syncSettings(settings: Settings): SyncResult {
        val key = encryptionKey ?: return SyncResult.Error("Clé de chiffrement non initialisée")

        _syncStatus.value = SyncStatus.SYNCING
        _syncEvents.value = SyncEvent.Started

        return try {
            // Sérialiser en JSON
            val json = gson.toJson(settings)

            // Chiffrer
            val encryptedData = encryptionManager.encryptString(json, key)

            // Créer SyncData
            val syncData = SyncData(
                id = UUID.randomUUID().toString(),
                deviceId = getDeviceId(),
                timestamp = System.currentTimeMillis(),
                version = 1,
                dataType = SyncDataType.SETTINGS,
                encryptedPayload = encryptedData.toBase64(),
                checksum = calculateChecksum(json)
            )

            // Upload
            val result = cloudRepository.upload(syncData)

            when (result) {
                is SyncResult.Success -> {
                    _syncStatus.value = SyncStatus.SUCCESS
                    _syncEvents.value = SyncEvent.Completed
                    updateLastSyncTimestamp()
                }
                is SyncResult.Error -> {
                    _syncStatus.value = SyncStatus.ERROR
                    _syncEvents.value = SyncEvent.Failed(result.message)
                }
                is SyncResult.Conflict -> {
                    _syncStatus.value = SyncStatus.CONFLICT
                    _syncEvents.value = SyncEvent.ConflictDetected(SyncDataType.SETTINGS)
                }
            }

            result
        } catch (e: Exception) {
            _syncStatus.value = SyncStatus.ERROR
            _syncEvents.value = SyncEvent.Failed(e.message ?: "Erreur inconnue")
            SyncResult.Error(e.message ?: "Erreur", e)
        }
    }

    /**
     * Télécharge et déchiffre les paramètres
     */
    suspend fun downloadSettings(): Settings? {
        val key = encryptionKey ?: return null

        return try {
            val data = cloudRepository.download(SyncDataType.SETTINGS).firstOrNull() ?: return null

            // Déchiffrer
            val encryptedData = data.encryptedPayload.toEncryptedData()
            val json = encryptionManager.decryptString(encryptedData, key)

            // Vérifier l'intégrité
            if (calculateChecksum(json) != data.checksum) {
                throw SecurityException("Checksum invalide - données corrompues")
            }

            // Désérialiser
            gson.fromJson(json, Settings::class.java)
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Synchronisation bidirectionnelle complète
     */
    suspend fun performFullSync(settings: Settings): SyncResult {
        _syncStatus.value = SyncStatus.SYNCING
        _syncEvents.value = SyncEvent.Started

        // 1. Télécharger les données distantes
        val remoteSettings = downloadSettings()

        // 2. Comparer avec les données locales
        return if (remoteSettings == null) {
            // Pas de données distantes → Upload
            syncSettings(settings)
        } else {
            // Données distantes existantes → Vérifier les conflits
            val localTimestamp = getLastSyncTimestamp()
            val remoteData = cloudRepository.download(SyncDataType.SETTINGS).firstOrNull()

            if (remoteData != null && remoteData.timestamp > localTimestamp) {
                // Conflit détecté
                SyncResult.Conflict(
                    localData = createSyncData(settings, SyncDataType.SETTINGS),
                    remoteData = remoteData
                )
            } else {
                // Pas de conflit → Upload
                syncSettings(settings)
            }
        }
    }

    /**
     * Résout un conflit avec une stratégie donnée
     */
    suspend fun resolveConflict(
        conflict: SyncResult.Conflict,
        strategy: ConflictResolutionStrategy
    ): SyncData {
        return cloudRepository.resolveConflict(conflict, strategy)
    }

    /**
     * Teste la connexion cloud
     */
    suspend fun testConnection(): Boolean {
        return cloudRepository.testConnection()
    }

    /**
     * Obtient l'ID de l'appareil
     */
    private fun getDeviceId(): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_DEVICE_ID, null) ?: ""
    }

    /**
     * Met à jour le timestamp de la dernière synchronisation
     */
    private fun updateLastSyncTimestamp() {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putLong(KEY_LAST_SYNC, System.currentTimeMillis()).apply()
    }

    /**
     * Obtient le timestamp de la dernière synchronisation
     */
    private fun getLastSyncTimestamp(): Long {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getLong(KEY_LAST_SYNC, 0)
    }

    /**
     * Calcule le checksum SHA-256 d'une chaîne
     */
    private fun calculateChecksum(data: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(data.toByteArray())
        return hash.joinToString("") { "%02x".format(it) }
    }

    /**
     * Crée un SyncData depuis des données locales
     */
    private suspend fun createSyncData(settings: Settings, dataType: SyncDataType): SyncData {
        val key = encryptionKey ?: throw IllegalStateException("Clé non initialisée")
        val json = gson.toJson(settings)
        val encryptedData = encryptionManager.encryptString(json, key)

        return SyncData(
            id = UUID.randomUUID().toString(),
            deviceId = getDeviceId(),
            timestamp = System.currentTimeMillis(),
            version = 1,
            dataType = dataType,
            encryptedPayload = encryptedData.toBase64(),
            checksum = calculateChecksum(json)
        )
    }

    /**
     * Obtient les métadonnées de synchronisation
     */
    suspend fun getMetadata(): LocalSyncMetadata {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return LocalSyncMetadata(
            lastSyncTimestamp = prefs.getLong(KEY_LAST_SYNC, 0),
            lastSuccessfulSyncTimestamp = prefs.getLong(KEY_LAST_SYNC, 0),
            pendingChanges = 0, // TODO: Track pending changes
            conflictCount = 0,  // TODO: Track conflicts
            syncErrors = emptyList() // TODO: Track errors
        )
    }

    /**
     * Réinitialise la synchronisation (efface la clé et les données)
     */
    suspend fun reset() {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().clear().apply()
        encryptionKey = null
        _syncStatus.value = SyncStatus.IDLE
    }
}
