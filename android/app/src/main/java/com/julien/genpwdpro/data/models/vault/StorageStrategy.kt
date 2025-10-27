package com.julien.genpwdpro.data.models.vault

/**
 * Stratégies de stockage pour les fichiers vault
 */
enum class StorageStrategy {
    /**
     * Stockage interne sécurisé
     * /data/data/com.julien.genpwdpro/vaults/
     * Supprimé à la désinstallation
     */
    INTERNAL,

    /**
     * Stockage dans l'espace app (recommandé)
     * /Android/data/com.julien.genpwdpro/files/vaults/
     * Survit à la désinstallation si données conservées
     */
    APP_STORAGE,

    /**
     * Documents publics
     * /Documents/GenPwdPro/
     * Facile à sauvegarder, moins sécurisé
     */
    PUBLIC_DOCUMENTS,

    /**
     * Chemin personnalisé
     * Choisi par l'utilisateur via SAF
     */
    CUSTOM
}
