package com.julien.genpwdpro.domain.model

import com.julien.genpwdpro.data.local.entity.EntryType
import com.julien.genpwdpro.data.repository.VaultRepository
import java.util.UUID

/**
 * Modèle pour les notes sécurisées
 *
 * Une note sécurisée est un type d'entrée de vault optimisé pour stocker
 * du texte chiffré (notes, informations sensibles, etc.)
 */
data class SecureNote(
    val id: String = UUID.randomUUID().toString(),
    val vaultId: String,
    val folderId: String? = null,

    /** Titre de la note */
    val title: String,

    /** Contenu de la note (chiffré) */
    val content: String,

    /** Favori */
    val isFavorite: Boolean = false,

    /** Tags associés */
    val tags: List<String> = emptyList(),

    /** Icône personnalisée (emoji ou nom d'icône) */
    val icon: String? = "📝",

    /** Couleur personnalisée (hex string) */
    val color: String? = null,

    /** Date de création */
    val createdAt: Long = System.currentTimeMillis(),

    /** Date de dernière modification */
    val modifiedAt: Long = System.currentTimeMillis(),

    /** Date de dernier accès */
    val lastAccessedAt: Long = System.currentTimeMillis(),

    /** Nombre de fois que la note a été consultée */
    val viewCount: Int = 0
) {
    /**
     * Convertit une note sécurisée en DecryptedEntry pour le repository
     */
    fun toDecryptedEntry(): VaultRepository.DecryptedEntry {
        return VaultRepository.DecryptedEntry(
            id = id,
            vaultId = vaultId,
            folderId = folderId,
            title = title,
            username = "",  // Pas utilisé pour les notes
            password = "",  // Pas utilisé pour les notes
            url = "",       // Pas utilisé pour les notes
            notes = content, // Le contenu est stocké dans le champ notes
            customFields = "",
            entryType = EntryType.NOTE,
            isFavorite = isFavorite,
            passwordStrength = 0,
            passwordEntropy = 0.0,
            generationMode = null,
            createdAt = createdAt,
            modifiedAt = modifiedAt,
            lastAccessedAt = lastAccessedAt,
            passwordExpiresAt = 0,
            requiresPasswordChange = false,
            usageCount = viewCount,
            icon = icon,
            color = color,
            hasTOTP = false,
            totpSecret = "",
            totpPeriod = 30,
            totpDigits = 6,
            totpAlgorithm = "SHA1",
            totpIssuer = "",
            hasPasskey = false,
            passkeyData = "",
            passkeyRpId = "",
            passkeyRpName = "",
            passkeyUserHandle = "",
            passkeyCreatedAt = 0,
            passkeyLastUsedAt = 0
        )
    }

    companion object {
        /**
         * Crée une SecureNote depuis un DecryptedEntry
         */
        fun fromDecryptedEntry(entry: VaultRepository.DecryptedEntry): SecureNote? {
            if (entry.entryType != EntryType.NOTE) return null

            return SecureNote(
                id = entry.id,
                vaultId = entry.vaultId,
                folderId = entry.folderId,
                title = entry.title,
                content = entry.notes,
                isFavorite = entry.isFavorite,
                icon = entry.icon,
                color = entry.color,
                createdAt = entry.createdAt,
                modifiedAt = entry.modifiedAt,
                lastAccessedAt = entry.lastAccessedAt,
                viewCount = entry.usageCount
            )
        }
    }
}

/**
 * Modèle pour les informations d'identité sécurisées
 */
data class SecureIdentity(
    val id: String = UUID.randomUUID().toString(),
    val vaultId: String,
    val folderId: String? = null,

    /** Nom complet */
    val fullName: String,

    /** Informations d'identité au format JSON ou texte structuré */
    val identityData: String,

    /** Type d'identité (PASSPORT, DRIVER_LICENSE, ID_CARD, etc.) */
    val identityType: String = "GENERAL",

    val isFavorite: Boolean = false,
    val icon: String? = "🪪",
    val color: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val modifiedAt: Long = System.currentTimeMillis()
) {
    fun toDecryptedEntry(): VaultRepository.DecryptedEntry {
        return VaultRepository.DecryptedEntry(
            id = id,
            vaultId = vaultId,
            folderId = folderId,
            title = fullName,
            username = identityType,
            password = "",
            url = "",
            notes = identityData,
            customFields = "",
            entryType = EntryType.IDENTITY,
            isFavorite = isFavorite,
            passwordStrength = 0,
            passwordEntropy = 0.0,
            generationMode = null,
            createdAt = createdAt,
            modifiedAt = modifiedAt,
            lastAccessedAt = createdAt,
            passwordExpiresAt = 0,
            requiresPasswordChange = false,
            usageCount = 0,
            icon = icon,
            color = color,
            hasTOTP = false,
            totpSecret = "",
            totpPeriod = 30,
            totpDigits = 6,
            totpAlgorithm = "SHA1",
            totpIssuer = "",
            hasPasskey = false,
            passkeyData = "",
            passkeyRpId = "",
            passkeyRpName = "",
            passkeyUserHandle = "",
            passkeyCreatedAt = 0,
            passkeyLastUsedAt = 0
        )
    }
}

/**
 * Modèle pour les cartes bancaires sécurisées
 */
data class SecureCard(
    val id: String = UUID.randomUUID().toString(),
    val vaultId: String,
    val folderId: String? = null,

    /** Nom sur la carte */
    val cardholderName: String,

    /** Numéro de carte (sera chiffré) */
    val cardNumber: String,

    /** Date d'expiration (MM/YY) */
    val expiryDate: String,

    /** CVV/CVC (sera chiffré) */
    val cvv: String,

    /** PIN (optionnel, sera chiffré) */
    val pin: String = "",

    /** Type de carte (VISA, MASTERCARD, AMEX, etc.) */
    val cardType: String = "CARD",

    /** Notes additionnelles */
    val notes: String = "",

    val isFavorite: Boolean = false,
    val icon: String? = "💳",
    val color: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val modifiedAt: Long = System.currentTimeMillis()
) {
    fun toDecryptedEntry(): VaultRepository.DecryptedEntry {
        // Stocker les données de carte dans customFields en JSON
        val cardData = """
            {
                "cardNumber": "$cardNumber",
                "expiryDate": "$expiryDate",
                "cvv": "$cvv",
                "pin": "$pin",
                "cardType": "$cardType"
            }
        """.trimIndent()

        return VaultRepository.DecryptedEntry(
            id = id,
            vaultId = vaultId,
            folderId = folderId,
            title = "$cardType - ${cardNumber.takeLast(4)}",
            username = cardholderName,
            password = cvv,
            url = "",
            notes = notes,
            customFields = cardData,
            entryType = EntryType.CARD,
            isFavorite = isFavorite,
            passwordStrength = 0,
            passwordEntropy = 0.0,
            generationMode = null,
            createdAt = createdAt,
            modifiedAt = modifiedAt,
            lastAccessedAt = createdAt,
            passwordExpiresAt = 0,
            requiresPasswordChange = false,
            usageCount = 0,
            icon = icon,
            color = color,
            hasTOTP = false,
            totpSecret = "",
            totpPeriod = 30,
            totpDigits = 6,
            totpAlgorithm = "SHA1",
            totpIssuer = "",
            hasPasskey = false,
            passkeyData = "",
            passkeyRpId = "",
            passkeyRpName = "",
            passkeyUserHandle = "",
            passkeyCreatedAt = 0,
            passkeyLastUsedAt = 0
        )
    }
}
