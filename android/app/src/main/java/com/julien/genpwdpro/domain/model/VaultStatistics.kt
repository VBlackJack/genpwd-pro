package com.julien.genpwdpro.domain.model

/**
 * Statistiques d'un vault (nouveau système file-based)
 *
 * Cette classe représente les statistiques calculées depuis VaultSessionManager
 * pour affichage dans l'UI.
 */
data class VaultStatistics(
    /** Nombre total d'entrées */
    val entryCount: Int = 0,

    /** Nombre de dossiers */
    val folderCount: Int = 0,

    /** Nombre de tags */
    val tagCount: Int = 0,

    /** Nombre de presets */
    val presetCount: Int = 0,

    /** Nombre d'entrées de type LOGIN */
    val loginCount: Int = 0,

    /** Nombre d'entrées de type NOTE */
    val noteCount: Int = 0,

    /** Nombre d'entrées de type WIFI */
    val wifiCount: Int = 0,

    /** Nombre d'entrées de type CARD */
    val cardCount: Int = 0,

    /** Nombre d'entrées de type IDENTITY */
    val identityCount: Int = 0,

    /** Nombre d'entrées favorites */
    val favoritesCount: Int = 0,

    /** Nombre d'entrées avec TOTP */
    val totpCount: Int = 0,

    /** Nombre de mots de passe faibles (longueur < 8 ou pas de variation) */
    val weakPasswordCount: Int = 0,

    /** Taille du vault en octets */
    val sizeInBytes: Long = 0
)
