package com.julien.genpwdpro.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import java.util.UUID

/**
 * Entité représentant une entrée (mot de passe) dans un vault
 * Toutes les données sensibles sont chiffrées avec AES-256-GCM
 */
@Entity(
    tableName = "vault_entries",
    foreignKeys = [
        ForeignKey(
            entity = VaultEntity::class,
            parentColumns = ["id"],
            childColumns = ["vaultId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = FolderEntity::class,
            parentColumns = ["id"],
            childColumns = ["folderId"],
            onDelete = ForeignKey.SET_NULL
        )
    ],
    indices = [
        Index(value = ["vaultId"]),
        Index(value = ["folderId"]),
        Index(value = ["isFavorite"]),
        Index(value = ["createdAt"]),
        Index(value = ["modifiedAt"])
    ]
)
data class VaultEntryEntity(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),

    /** ID du vault parent */
    val vaultId: String,

    /** ID du dossier (nullable) */
    val folderId: String? = null,

    /** Titre de l'entrée (chiffré) */
    val encryptedTitle: String,

    /** IV pour le titre */
    val titleIv: String,

    /** Nom d'utilisateur / email (chiffré) */
    val encryptedUsername: String = "",

    /** IV pour le username */
    val usernameIv: String = "",

    /** Mot de passe (chiffré) */
    val encryptedPassword: String,

    /** IV pour le password */
    val passwordIv: String,

    /** URL du site (chiffré) */
    val encryptedUrl: String = "",

    /** IV pour l'URL */
    val urlIv: String = "",

    /** Notes (chiffré) */
    val encryptedNotes: String = "",

    /** IV pour les notes */
    val notesIv: String = "",

    /** Champs personnalisés au format JSON chiffré */
    val encryptedCustomFields: String = "",

    /** IV pour les champs personnalisés */
    val customFieldsIv: String = "",

    /** Type d'entrée (LOGIN, CARD, NOTE, IDENTITY) */
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

    /** Secret TOTP (chiffré, base32) */
    val encryptedTotpSecret: String = "",

    /** IV pour le secret TOTP */
    val totpSecretIv: String = "",

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

    /** Données du passkey (credential) chiffrées au format JSON */
    val encryptedPasskeyData: String = "",

    /** IV pour les données passkey */
    val passkeyDataIv: String = "",

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
)

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
