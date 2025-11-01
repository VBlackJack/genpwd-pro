package com.julien.genpwdpro.data.models.vault

import java.util.UUID

/**
 * Data classes pour le système de vault file-based (.gpv)
 *
 * NOTE: Ces classes sont utilisées pour sérialiser/désérialiser les fichiers .gpv
 * Elles ne sont PAS des entités Room - le système Room legacy a été supprimé.
 *
 * Architecture:
 * - Fichiers .gpv (chiffrés) contiennent ces structures
 * - VaultSessionManager les charge en mémoire après déverrouillage
 * - Modifications sauvegardées automatiquement dans le fichier
 */

/**
 * Représente une entrée (mot de passe, note, carte, etc.) dans un vault
 *
 * IMPORTANT: Cette classe stocke les données DÉCHIFFRÉES en mémoire après déverrouillage.
 * - Sur disque (.gpv) : les données sont chiffrées par VaultCryptoManager
 * - En mémoire (après unlock) : les données sont déchiffrées et accessibles en clair
 * - Au verrouillage : les instances sont nettoyées de la mémoire
 */
data class VaultEntryEntity(
    val id: String = UUID.randomUUID().toString(),

    /** ID du vault parent */
    val vaultId: String,

    /** ID du dossier (nullable) */
    val folderId: String? = null,

    /** Titre de l'entrée */
    val title: String,

    /** Nom d'utilisateur / email */
    val username: String? = null,

    /** Mot de passe */
    val password: String? = null,

    /** URL du site */
    val url: String? = null,

    /** Notes */
    val notes: String? = null,

    /** Champs personnalisés au format JSON */
    val customFields: String? = null,

    /** Type d'entrée (LOGIN, CARD, NOTE, IDENTITY, WIFI) */
    val entryType: String = "LOGIN",

    /** Favori */
    val isFavorite: Boolean = false,

    /** Force du mot de passe (0-100) - stocké en clair pour le tri */
    val passwordStrength: Int = 0,

    /** Entropie du mot de passe - stocké en clair pour le tri */
    val passwordEntropy: Double = 0.0,

    /** Mode de génération utilisé (si généré) */
    val generationMode: String? = null,

    /** Date de création (timestamp) */
    val createdAt: Long = System.currentTimeMillis(),

    /** Date de dernière modification (timestamp) */
    val modifiedAt: Long = System.currentTimeMillis(),

    /** Date de dernier accès (timestamp) */
    val lastAccessedAt: Long = System.currentTimeMillis(),

    /** Date d'expiration du mot de passe (timestamp, 0 = jamais) */
    val passwordExpiresAt: Long = 0,

    /** Nécessite un changement de mot de passe */
    val requiresPasswordChange: Boolean = false,

    /** Nombre d'utilisations (pour statistiques) */
    val usageCount: Int = 0,

    /** Icône personnalisée (emoji ou nom d'icône) */
    val icon: String? = null,

    /** Couleur personnalisée (hex string) */
    val color: String? = null,

    // ========== TOTP/OTP Support ==========

    /** Active le TOTP pour cette entrée */
    val hasTOTP: Boolean = false,

    /** Secret TOTP (base32) */
    val totpSecret: String? = null,

    /** Période TOTP en secondes (défaut: 30) */
    val totpPeriod: Int = 30,

    /** Nombre de digits du code TOTP (défaut: 6) */
    val totpDigits: Int = 6,

    /** Algorithme de hash TOTP (SHA1, SHA256, SHA512) */
    val totpAlgorithm: String = "SHA1",

    /** Émetteur TOTP (ex: "Google", "GitHub") */
    val totpIssuer: String = "",

    // ========== Passkey Support (FIDO2/WebAuthn) ==========

    /** Active les passkeys pour cette entrée */
    val hasPasskey: Boolean = false,

    /** Données du passkey (credential) au format JSON */
    val passkeyData: String? = null,

    /** Relying Party ID (domaine, ex: "example.com") */
    val passkeyRpId: String = "",

    /** Relying Party Name (nom du site) */
    val passkeyRpName: String = "",

    /** User Handle (identifiant unique de l'utilisateur) */
    val passkeyUserHandle: String = "",

    /** Date de création du passkey (timestamp) */
    val passkeyCreatedAt: Long = 0,

    /** Dernière utilisation du passkey (timestamp) */
    val passkeyLastUsedAt: Long = 0
) {
    /**
     * Vérifie si l'entrée a TOTP configuré
     */
    fun hasTOTP(): Boolean = hasTOTP && !totpSecret.isNullOrEmpty()
}

/**
 * Types d'entrées supportés
 */
enum class EntryType {
    LOGIN,      // Identifiant + mot de passe
    WIFI,       // Réseau WiFi (SSID + mot de passe + sécurité)
    NOTE,       // Note sécurisée
    CARD,       // Carte bancaire
    IDENTITY    // Informations d'identité
}

/**
 * Extension pour convertir String → EntryType
 */
fun String.toEntryType(): EntryType {
    return try {
        EntryType.valueOf(this)
    } catch (e: IllegalArgumentException) {
        EntryType.LOGIN
    }
}

/**
 * Représente un dossier pour organiser les entrées
 * Support de la hiérarchie (dossiers parent/enfant)
 */
data class FolderEntity(
    val id: String = UUID.randomUUID().toString(),

    /** ID du vault parent */
    val vaultId: String,

    /** ID du dossier parent (null si racine) */
    val parentFolderId: String? = null,

    /** Nom du dossier */
    val name: String,

    /** Icône du dossier (emoji ou nom d'icône) */
    val icon: String = "📁",

    /** Couleur du dossier (hex string) */
    val color: String? = null,

    /** Ordre d'affichage */
    val sortOrder: Int = 0,

    /** Date de création (timestamp) */
    val createdAt: Long = System.currentTimeMillis(),

    /** Date de dernière modification (timestamp) */
    val modifiedAt: Long = System.currentTimeMillis()
)

/**
 * Représente un tag pour catégoriser les entrées
 */
data class TagEntity(
    val id: String = UUID.randomUUID().toString(),

    /** ID du vault parent */
    val vaultId: String,

    /** Nom du tag (unique par vault) */
    val name: String,

    /** Couleur du tag (hex string) */
    val color: String,

    /** Date de création (timestamp) */
    val createdAt: Long = System.currentTimeMillis()
)

/**
 * Relation many-to-many entre entries et tags
 */
data class EntryTagCrossRef(
    val entryId: String,
    val tagId: String
)

// DecryptedPreset sera défini dans un fichier séparé pour éviter les dépendances circulaires

/**
 * Représente un preset de génération de mot de passe
 * Stocké dans un vault spécifique
 *
 * Note: Les données sont déchiffrées en mémoire après déverrouillage du vault
 */
data class PresetEntity(
    val id: String = UUID.randomUUID().toString(),

    /** ID du vault auquel appartient ce preset */
    val vaultId: String,

    /** Nom du preset */
    val name: String,

    /** Icône emoji */
    val icon: String = "🔐",

    /** Mode de génération (SYLLABLES ou PASSPHRASE uniquement) */
    val generationMode: String, // GenerationMode.name

    /** Paramètres de génération (JSON de Settings) */
    val settings: String,

    /** Preset par défaut (un seul par vault) */
    val isDefault: Boolean = false,

    /** Preset système non modifiable */
    val isSystemPreset: Boolean = false,

    /** Date de création (timestamp) */
    val createdAt: Long = System.currentTimeMillis(),

    /** Date de dernière modification (timestamp) */
    val modifiedAt: Long = System.currentTimeMillis(),

    /** Date de dernière utilisation (timestamp) */
    val lastUsedAt: Long? = null,

    /** Nombre d'utilisations */
    val usageCount: Int = 0
)

/**
 * Version déchiffrée d'une entrée vault pour manipulation en mémoire
 * Utilisée par les ViewModels et l'UI après déverrouillage
 *
 * Note: Les données sensibles sont en clair - cette classe ne doit être utilisée
 * qu'après déverrouillage du vault et nettoyée au verrouillage
 */
data class DecryptedVaultEntry(
    val id: String,
    val vaultId: String,
    val folderId: String? = null,

    /** Titre déchiffré */
    val title: String,

    /** Nom d'utilisateur / email déchiffré */
    val username: String? = null,

    /** Mot de passe déchiffré */
    val password: String? = null,

    /** URL déchiffrée */
    val url: String? = null,

    /** Notes déchiffrées */
    val notes: String? = null,

    /** Champs personnalisés déchiffrés (JSON) */
    val customFields: String? = null,

    val entryType: EntryType = EntryType.LOGIN,
    val isFavorite: Boolean = false,
    val passwordStrength: Int = 0,
    val passwordEntropy: Double = 0.0,
    val generationMode: String? = null,
    val createdAt: Long,
    val modifiedAt: Long,
    val lastAccessedAt: Long,
    val passwordExpiresAt: Long = 0,
    val requiresPasswordChange: Boolean = false,
    val usageCount: Int = 0,
    val icon: String? = null,
    val color: String? = null,

    // TOTP
    val hasTOTP: Boolean = false,
    val totpSecret: String? = null,
    val totpPeriod: Int = 30,
    val totpDigits: Int = 6,
    val totpAlgorithm: String = "SHA1",
    val totpIssuer: String = "",

    // Passkey
    val hasPasskey: Boolean = false,
    val passkeyData: String? = null,
    val passkeyRpId: String = "",
    val passkeyRpName: String = "",
    val passkeyUserHandle: String = "",
    val passkeyCreatedAt: Long = 0,
    val passkeyLastUsedAt: Long = 0
) {
    /**
     * Vérifie si l'entrée a TOTP configuré
     */
    fun hasTOTP(): Boolean = hasTOTP && !totpSecret.isNullOrEmpty()
}
