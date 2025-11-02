package com.julien.genpwdpro.data.models.vault

/**
 * Header du fichier .gpv
 * Taille fixe: 256 bytes
 *
 * Inspiré de KeePass KDBX: header non-chiffré avec métadonnées
 *
 * Version history:
 * - Version 1: Initial format with deterministic salt (deprecated for security)
 * - Version 2: Random kdfSalt for improved security (current)
 */
data class VaultFileHeader(
    val magicNumber: String = MAGIC_NUMBER,
    val version: Int = CURRENT_VERSION,
    val vaultId: String,
    val createdAt: Long,
    val modifiedAt: Long,
    val checksum: String, // SHA-256 du contenu déchiffré
    val keyFileHash: String? = null, // SHA-256 du key file (optionnel, KeePass-style)
    val kdfSalt: String? = null, // Salt hexadécimal utilisé pour Argon2id (required in v2+)
    val kdfAlgorithm: String = DEFAULT_KDF
) {
    companion object {
        const val MAGIC_NUMBER = "GPVAULT1"
        const val CURRENT_VERSION = 2  // Incremented for random kdfSalt security improvement
        const val DEFAULT_KDF = "argon2id"
        const val HEADER_SIZE = 512  // Increased from 256 to prevent truncation
    }

    /**
     * Valide le header
     */
    fun isValid(): Boolean {
        return magicNumber == MAGIC_NUMBER && version <= CURRENT_VERSION
    }

    /**
     * Vérifie si un key file est requis
     */
    fun requiresKeyFile(): Boolean {
        return keyFileHash != null
    }

    fun hasKdfSalt(): Boolean = !kdfSalt.isNullOrBlank()
}
