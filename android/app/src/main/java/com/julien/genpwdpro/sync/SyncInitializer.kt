package com.julien.genpwdpro.sync

import android.content.Context
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.data.local.preferences.SyncConfigDataStore
import com.julien.genpwdpro.data.sync.CloudProviderSyncRepository
import com.julien.genpwdpro.data.sync.SyncManager
import com.julien.genpwdpro.data.sync.models.CloudProviderType
import com.julien.genpwdpro.data.sync.providers.CloudProviderFactory
import com.julien.genpwdpro.workers.CloudSyncWorker
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * Initialise le système de synchronisation au démarrage de l'application
 *
 * Responsabilités:
 * 1. Initialise SyncManager (génère/charge la clé de chiffrement)
 * 2. Restaure le provider actif depuis les préférences
 * 3. Réactive l'auto-sync si il était activé
 * 4. Planifie les workers si nécessaire
 */
@Singleton
class SyncInitializer @Inject constructor(
    @ApplicationContext private val context: Context,
    private val syncManager: SyncManager,
    private val syncConfigDataStore: SyncConfigDataStore,
    private val providerFactory: CloudProviderFactory,
    private val cloudRepository: CloudProviderSyncRepository
) {

    companion object {
        private const val TAG = "SyncInitializer"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /**
     * Initialise le système de synchronisation
     * Doit être appelé dans Application.onCreate()
     */
    fun initialize() {
        SafeLog.d(TAG, "Initializing sync system...")

        scope.launch {
            try {
                // 1. Initialiser SyncManager (clé de chiffrement)
                syncManager.initialize()
                SafeLog.d(TAG, "SyncManager initialized")

                // 2. Charger la configuration sauvegardée
                val config = syncConfigDataStore.syncConfigFlow.first()
                SafeLog.d(
                    TAG,
                    "Loaded sync config: enabled=${config.enabled}, provider=${config.providerType}, autoSync=${config.autoSync}"
                )

                // 3. Si sync activée et provider configuré, restaurer le provider
                if (config.enabled && config.providerType != CloudProviderType.NONE) {
                    restoreProvider(config.providerType)
                }

                // 4. Si auto-sync activé, reprogrammer les workers
                if (config.autoSync && config.enabled) {
                    CloudSyncWorker.schedule(
                        context = context,
                        intervalMillis = config.syncInterval,
                        wifiOnly = config.syncOnWifiOnly
                    )
                    SafeLog.d(TAG, "Auto-sync scheduled: interval=${config.syncInterval}ms")
                }

                SafeLog.i(TAG, "Sync system initialized successfully")
            } catch (e: Exception) {
                SafeLog.e(TAG, "Failed to initialize sync system", e)
            }
        }
    }

    /**
     * Restaure le provider actif depuis les credentials sauvegardés
     */
    private suspend fun restoreProvider(providerType: CloudProviderType) {
        try {
            SafeLog.d(TAG, "Restoring provider: $providerType")

            // Les credentials sont déjà chargés par les providers via ProviderCredentialManager
            // On doit juste créer l'instance du provider qui chargera automatiquement ses credentials

            val provider = when (providerType) {
                CloudProviderType.GOOGLE_DRIVE -> {
                    providerFactory.createProvider(CloudProviderType.GOOGLE_DRIVE)
                }
                CloudProviderType.ONEDRIVE -> {
                    // OneDrive nécessite un clientId - on le récupère des credentials ou config
                    // Pour l'instant on skip car on n'a pas sauvegardé le clientId
                    SafeLog.w(TAG, "OneDrive provider restoration not yet implemented (needs clientId)")
                    null
                }
                CloudProviderType.PCLOUD -> {
                    // pCloud nécessite appKey et appSecret - on skip pour l'instant
                    SafeLog.w(
                        TAG,
                        "pCloud provider restoration not yet implemented (needs appKey/appSecret)"
                    )
                    null
                }
                CloudProviderType.PROTON_DRIVE -> {
                    // ProtonDrive nécessite clientId et clientSecret - on skip pour l'instant
                    SafeLog.w(
                        TAG,
                        "ProtonDrive provider restoration not yet implemented (needs clientId/clientSecret)"
                    )
                    null
                }
                CloudProviderType.WEBDAV -> {
                    // WebDAV nécessite URL, username, password - on skip pour l'instant
                    SafeLog.w(
                        TAG,
                        "WebDAV provider restoration not yet implemented (needs credentials)"
                    )
                    null
                }
                else -> {
                    SafeLog.w(TAG, "Unknown provider type: $providerType")
                    null
                }
            }

            if (provider != null) {
                // Les tokens OAuth2 sont automatiquement chargés via ProviderCredentialManager
                // On définit juste le provider comme actif
                cloudRepository.setActiveProvider(providerType, provider)
                SafeLog.i(TAG, "Provider restored successfully: $providerType")
            } else {
                SafeLog.w(TAG, "Could not restore provider: $providerType (not yet implemented)")
            }
        } catch (e: Exception) {
            SafeLog.e(TAG, "Failed to restore provider: $providerType", e)
        }
    }
}
