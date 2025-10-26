package com.julien.genpwdpro.data.sync.providers

import com.julien.genpwdpro.data.sync.CloudProvider
import com.julien.genpwdpro.data.sync.models.CloudProviderType
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Factory pour créer des instances de CloudProvider
 *
 * Centralise la création de tous les providers cloud supportés.
 * Facilite l'ajout de nouveaux providers et la gestion de la configuration.
 */
@Singleton
class CloudProviderFactory @Inject constructor() {

    /**
     * Crée un provider basé sur le type
     *
     * @param type Type de provider à créer
     * @param config Configuration optionnelle (pour WebDAV par exemple)
     * @return Instance du provider ou null si non supporté
     */
    fun createProvider(
        type: CloudProviderType,
        config: ProviderConfig? = null
    ): CloudProvider? {
        return when (type) {
            CloudProviderType.GOOGLE_DRIVE -> {
                GoogleDriveProvider()
            }

            CloudProviderType.ONEDRIVE -> {
                OneDriveProvider()
            }

            CloudProviderType.PROTON_DRIVE -> {
                ProtonDriveProvider()
            }

            CloudProviderType.PCLOUD -> {
                PCloudProvider()
            }

            CloudProviderType.NONE -> null
        }
    }

    /**
     * Crée un provider WebDAV avec configuration personnalisée
     *
     * @param serverUrl URL du serveur WebDAV
     * @param username Nom d'utilisateur
     * @param password Mot de passe
     * @param validateSSL Valider les certificats SSL (recommandé: true)
     * @return Instance de WebDAVProvider
     */
    fun createWebDAVProvider(
        serverUrl: String,
        username: String,
        password: String,
        validateSSL: Boolean = true
    ): WebDAVProvider {
        return WebDAVProvider(
            serverUrl = serverUrl,
            username = username,
            password = password,
            validateSSL = validateSSL
        )
    }

    /**
     * Obtient les informations d'un provider
     *
     * @param type Type de provider
     * @return Informations du provider
     */
    fun getProviderInfo(type: CloudProviderType): ProviderInfo {
        return when (type) {
            CloudProviderType.GOOGLE_DRIVE -> ProviderInfo(
                type = type,
                name = "Google Drive",
                description = "Stockage cloud de Google avec 15 GB gratuits",
                icon = "📁",
                requiresOAuth = true,
                supportsQuota = true,
                implementationStatus = ImplementationStatus.PRODUCTION_READY,
                maxFileSize = 5_000_000_000L, // 5 GB
                freeStorage = 15_000_000_000L, // 15 GB
                website = "https://drive.google.com",
                privacyLevel = PrivacyLevel.STANDARD
            )

            CloudProviderType.ONEDRIVE -> ProviderInfo(
                type = type,
                name = "Microsoft OneDrive",
                description = "Stockage cloud Microsoft avec 5 GB gratuits",
                icon = "☁️",
                requiresOAuth = true,
                supportsQuota = true,
                implementationStatus = ImplementationStatus.TEMPLATE,
                maxFileSize = 100_000_000_000L, // 100 GB (avec app)
                freeStorage = 5_000_000_000L, // 5 GB
                website = "https://onedrive.live.com",
                privacyLevel = PrivacyLevel.STANDARD
            )

            CloudProviderType.PROTON_DRIVE -> ProviderInfo(
                type = type,
                name = "Proton Drive",
                description = "Stockage cloud sécurisé avec chiffrement end-to-end natif",
                icon = "🔐",
                requiresOAuth = true,
                supportsQuota = true,
                implementationStatus = ImplementationStatus.TEMPLATE,
                maxFileSize = Long.MAX_VALUE,
                freeStorage = 1_000_000_000L, // 1 GB (peut varier)
                website = "https://proton.me/drive",
                privacyLevel = PrivacyLevel.MAXIMUM
            )

            CloudProviderType.PCLOUD -> ProviderInfo(
                type = type,
                name = "pCloud",
                description = "Stockage cloud européen avec 10 GB gratuits",
                icon = "☁️",
                requiresOAuth = true,
                supportsQuota = true,
                implementationStatus = ImplementationStatus.TEMPLATE,
                maxFileSize = Long.MAX_VALUE,
                freeStorage = 10_000_000_000L, // 10 GB
                website = "https://www.pcloud.com",
                privacyLevel = PrivacyLevel.HIGH
            )

            CloudProviderType.NONE -> ProviderInfo(
                type = type,
                name = "Aucun",
                description = "Synchronisation désactivée",
                icon = "❌",
                requiresOAuth = false,
                supportsQuota = false,
                implementationStatus = ImplementationStatus.NOT_APPLICABLE,
                maxFileSize = 0L,
                freeStorage = 0L,
                website = "",
                privacyLevel = PrivacyLevel.NOT_APPLICABLE
            )
        }
    }

    /**
     * Obtient les informations pour WebDAV
     */
    fun getWebDAVInfo(): ProviderInfo {
        return ProviderInfo(
            type = CloudProviderType.NONE, // Pas dans l'enum
            name = "WebDAV",
            description = "Serveur WebDAV personnalisé (Nextcloud, ownCloud, etc.)",
            icon = "🌐",
            requiresOAuth = false,
            supportsQuota = false, // Dépend du serveur
            implementationStatus = ImplementationStatus.TEMPLATE,
            maxFileSize = Long.MAX_VALUE,
            freeStorage = 0L, // Dépend du serveur
            website = "",
            privacyLevel = PrivacyLevel.CONFIGURABLE
        )
    }

    /**
     * Liste tous les providers disponibles
     */
    fun getAllProviders(): List<ProviderInfo> {
        return CloudProviderType.values()
            .filter { it != CloudProviderType.NONE }
            .map { getProviderInfo(it) }
    }

    /**
     * Liste les providers production-ready
     */
    fun getProductionReadyProviders(): List<ProviderInfo> {
        return getAllProviders()
            .filter { it.implementationStatus == ImplementationStatus.PRODUCTION_READY }
    }

    /**
     * Vérifie si un provider est disponible
     */
    fun isProviderAvailable(type: CloudProviderType): Boolean {
        val info = getProviderInfo(type)
        return info.implementationStatus != ImplementationStatus.NOT_APPLICABLE
    }
}

/**
 * Configuration pour créer un provider
 */
data class ProviderConfig(
    val serverUrl: String? = null,
    val username: String? = null,
    val password: String? = null,
    val customSettings: Map<String, String> = emptyMap()
)

/**
 * Informations sur un provider cloud
 */
data class ProviderInfo(
    val type: CloudProviderType,
    val name: String,
    val description: String,
    val icon: String,
    val requiresOAuth: Boolean,
    val supportsQuota: Boolean,
    val implementationStatus: ImplementationStatus,
    val maxFileSize: Long,
    val freeStorage: Long,
    val website: String,
    val privacyLevel: PrivacyLevel
)

/**
 * Statut d'implémentation d'un provider
 */
enum class ImplementationStatus {
    PRODUCTION_READY,   // Prêt pour la production
    TEMPLATE,           // Template/placeholder (nécessite configuration)
    IN_DEVELOPMENT,     // En développement
    NOT_APPLICABLE      // Non applicable (ex: NONE)
}

/**
 * Niveau de confidentialité du provider
 */
enum class PrivacyLevel {
    MAXIMUM,            // Privacy maximale (ex: Proton Drive)
    HIGH,               // Privacy élevée (ex: pCloud)
    STANDARD,           // Privacy standard (ex: Google Drive, OneDrive)
    CONFIGURABLE,       // Dépend de la configuration (ex: WebDAV auto-hébergé)
    NOT_APPLICABLE      // Non applicable
}
