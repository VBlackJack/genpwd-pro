package com.julien.genpwdpro.data.sync

import android.content.Context
import com.google.gson.Gson
import com.julien.genpwdpro.crypto.CryptoEngine
import com.julien.genpwdpro.data.encryption.EncryptionManager
import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.data.sync.models.CloudProviderType
import com.julien.genpwdpro.data.sync.models.SyncStatus
import kotlin.math.max
import dagger.hilt.android.qualifiers.ApplicationContext
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

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

    private val _syncStatus = MutableStateFlow<SyncStatus>(SyncStatus.PENDING)
    val syncStatus: Flow<SyncStatus> = _syncStatus.asStateFlow()

    private val _syncEvents = MutableStateFlow<SyncEvent>(SyncEvent.Completed)
    val syncEvents: Flow<SyncEvent> = _syncEvents.asStateFlow()

    // Moteur de chiffrement stocké en mémoire (rechargé à chaque lancement)
    private var cryptoEngine: CryptoEngine? = null

    companion object {
        private const val PREFS_NAME = "sync_prefs"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_LAST_SYNC = "last_sync_timestamp"
        private const val KEYSET_PREFS = "sync_encryption_keyset_store"
        private const val KEYSET_NAME = "sync_encryption_keyset"
    }

    /**
     * Initialise la synchronisation (génère ou charge la clé)
     */
    suspend fun initialize() {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        // Charger ou générer l'ID de l'appareil
        if (prefs.getString(KEY_DEVICE_ID, null) == null) {
            val newId = UUID.randomUUID().toString()
            prefs.edit().putString(KEY_DEVICE_ID, newId).apply()
        }

        // Charger ou générer la clé de chiffrement via Tink
        cryptoEngine = encryptionManager.obtainEngine(
            context,
            KEYSET_NAME,
            KEYSET_PREFS
        )
    }

    /**
     * Synchronise les paramètres
     */
    suspend fun syncSettings(settings: Settings): SyncResult {
        val engine = cryptoEngine ?: return SyncResult.Error("Clé de chiffrement non initialisée")

        _syncStatus.value = SyncStatus.SYNCING
        _syncEvents.value = SyncEvent.Started

        var syncData: SyncData? = null
        var payloadSize: Long? = null
        val operationStart = System.currentTimeMillis()

        return try {
            // Sérialiser en JSON
            val json = gson.toJson(settings)

            // Chiffrer
            val encryptedData = encryptionManager.encryptString(json, engine)
            payloadSize = encryptedData.ciphertext.size.toLong()

            // Créer SyncData
            syncData = SyncData(
                id = UUID.randomUUID().toString(),
                deviceId = getDeviceId(),
                timestamp = System.currentTimeMillis(),
                version = EncryptionManager.CRYPTO_VERSION,
                dataType = SyncDataType.SETTINGS,
                encryptedPayload = encryptedData.toBase64(),
                checksum = calculateChecksum(json)
            )

            // Upload
            val result = cloudRepository.upload(syncData!!)
            val providerType = cloudRepository.getActiveProviderType() ?: CloudProviderType.NONE
            val duration = System.currentTimeMillis() - operationStart

            when (result) {
                is SyncResult.Success -> {
                    _syncStatus.value = SyncStatus.SYNCED
                    _syncEvents.value = SyncEvent.Completed
                    updateLastSyncTimestamp()
                    cloudRepository.recordHistoryEntry(
                        SyncHistoryEntry(
                            id = syncData!!.id,
                            timestamp = System.currentTimeMillis(),
                            action = SyncHistoryAction.UPLOAD,
                            status = SyncHistoryStatus.SUCCESS,
                            providerType = providerType,
                            dataType = SyncDataType.SETTINGS,
                            durationMs = duration,
                            sizeBytes = payloadSize
                        )
                    )
                }

                is SyncResult.Error -> {
                    _syncStatus.value = SyncStatus.ERROR
                    _syncEvents.value = SyncEvent.Failed(result.message)
                    cloudRepository.recordHistoryEntry(
                        SyncHistoryEntry(
                            id = syncData!!.id,
                            timestamp = System.currentTimeMillis(),
                            action = SyncHistoryAction.UPLOAD,
                            status = SyncHistoryStatus.ERROR,
                            providerType = providerType,
                            dataType = SyncDataType.SETTINGS,
                            durationMs = duration,
                            sizeBytes = payloadSize,
                            message = result.message
                        )
                    )
                }

                is SyncResult.Conflict -> {
                    _syncStatus.value = SyncStatus.CONFLICT
                    _syncEvents.value = SyncEvent.ConflictDetected(SyncDataType.SETTINGS)
                    cloudRepository.recordHistoryEntry(
                        SyncHistoryEntry(
                            id = syncData!!.id,
                            timestamp = System.currentTimeMillis(),
                            action = SyncHistoryAction.CONFLICT,
                            status = SyncHistoryStatus.CONFLICT,
                            providerType = providerType,
                            dataType = SyncDataType.SETTINGS,
                            durationMs = duration,
                            sizeBytes = payloadSize
                        )
                    )
                }
            }

            result
        } catch (e: Exception) {
            _syncStatus.value = SyncStatus.ERROR
            _syncEvents.value = SyncEvent.Failed(e.message ?: "Erreur inconnue")
            val providerType = cloudRepository.getActiveProviderType() ?: CloudProviderType.NONE
            cloudRepository.recordHistoryEntry(
                SyncHistoryEntry(
                    id = syncData?.id ?: UUID.randomUUID().toString(),
                    timestamp = System.currentTimeMillis(),
                    action = SyncHistoryAction.UPLOAD,
                    status = SyncHistoryStatus.ERROR,
                    providerType = providerType,
                    dataType = SyncDataType.SETTINGS,
                    durationMs = System.currentTimeMillis() - operationStart,
                    sizeBytes = payloadSize,
                    message = e.message
                )
            )
            SyncResult.Error(e.message ?: "Erreur", e)
        }
    }

    /**
     * Télécharge et déchiffre les paramètres
     */
    suspend fun downloadSettings(): Settings? {
        val engine = cryptoEngine ?: return null

        return try {
            val data = cloudRepository.download(SyncDataType.SETTINGS).firstOrNull() ?: return null

            // Déchiffrer
            val encryptedData = data.encryptedPayload.toEncryptedData()
            if (data.version != EncryptionManager.CRYPTO_VERSION) {
                throw SecurityException("Unsupported crypto version ${data.version}")
            }

            val json = encryptionManager.decryptString(encryptedData, engine)

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
                val providerType = cloudRepository.getActiveProviderType() ?: CloudProviderType.NONE
                cloudRepository.recordHistoryEntry(
                    SyncHistoryEntry(
                        id = remoteData.id,
                        timestamp = System.currentTimeMillis(),
                        action = SyncHistoryAction.CONFLICT,
                        status = SyncHistoryStatus.CONFLICT,
                        providerType = providerType,
                        dataType = SyncDataType.SETTINGS,
                        message = "Remote data is newer than local state"
                    )
                )
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
        val hash = digest.digest(data.toByteArray(StandardCharsets.UTF_8))
        return hash.joinToString("") { "%02x".format(it) }
    }

    /**
     * Crée un SyncData depuis des données locales
     */
    private suspend fun createSyncData(settings: Settings, dataType: SyncDataType): SyncData {
        val engine = cryptoEngine ?: throw IllegalStateException("Clé non initialisée")
        val json = gson.toJson(settings)
        val encryptedData = encryptionManager.encryptString(json, engine)

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
     * Obtient les métadonnées de synchronisation locale
     */
    suspend fun getMetadata(): LocalSyncMetadata {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val lastSyncTimestamp = prefs.getLong(KEY_LAST_SYNC, 0)
        val lastSuccessfulSyncTimestamp = when (_syncStatus.value) {
            SyncStatus.SYNCED -> lastSyncTimestamp
            else -> 0
        }

        val repositoryMetadata = runCatching { cloudRepository.getMetadata() }
            .getOrDefault(LocalSyncMetadata())

        return repositoryMetadata.copy(
            lastSyncTimestamp = max(repositoryMetadata.lastSyncTimestamp, lastSyncTimestamp),
            lastSuccessfulSyncTimestamp = max(
                repositoryMetadata.lastSuccessfulSyncTimestamp,
                lastSuccessfulSyncTimestamp
            )
        )
    }

    /**
     * Réinitialise la synchronisation (efface la clé et les données)
     */
    suspend fun reset() {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().clear().apply()
        cryptoEngine = null
        _syncStatus.value = SyncStatus.PENDING
    }
}
