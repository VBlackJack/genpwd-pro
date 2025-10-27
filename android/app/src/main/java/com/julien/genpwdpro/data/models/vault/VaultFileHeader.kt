package com.julien.genpwdpro.data.models.vault

/**
 * Header du fichier .gpv
 * Taille fixe: 256 bytes
 */
data class VaultFileHeader(
    val magicNumber: String = MAGIC_NUMBER,
    val version: Int = CURRENT_VERSION,
    val vaultId: String,
    val createdAt: Long,
    val modifiedAt: Long,
    val checksum: String  // SHA-256 du contenu
) {
    companion object {
        const val MAGIC_NUMBER = "GPVAULT1"
        const val CURRENT_VERSION = 1
        const val HEADER_SIZE = 256
    }

    /**
     * Valide le header
     */
    fun isValid(): Boolean {
        return magicNumber == MAGIC_NUMBER && version <= CURRENT_VERSION
    }
}
