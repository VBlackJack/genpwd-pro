package com.julien.genpwdpro.data.db.entity

import androidx.room.Embedded
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import com.julien.genpwdpro.data.models.vault.StorageStrategy
import com.julien.genpwdpro.data.models.vault.VaultStatistics

/**
 * Entrée du registre des vaults
 * Stocke les métadonnées et l'emplacement des fichiers .gpv
 *
 * IMPORTANT:
 * - Indices MUST be declared here to match migration CREATE INDEX statements
 * - Field order MUST match migration SQL column order
 */
@Entity(
    tableName = "vault_registry",
    indices = [
        Index(value = ["isDefault"]),
        Index(value = ["isLoaded"]),
        Index(value = ["storageStrategy"]),
        Index(value = ["biometricUnlockEnabled"])
    ]
)
data class VaultRegistryEntry(
    @PrimaryKey
    val id: String,

    /** Nom du vault */
    val name: String,

    /** Chemin absolu vers le fichier .gpv ou URI SAF */
    val filePath: String,

    /** Stratégie de stockage utilisée */
    val storageStrategy: StorageStrategy,

    /** Taille du fichier en bytes */
    val fileSize: Long,

    /** Timestamp de dernière modification du fichier */
    val lastModified: Long,

    /** Timestamp de dernier accès (déverrouillage) */
    val lastAccessed: Long? = null,

    /** Vault par défaut */
    val isDefault: Boolean = false,

    /** Vault actuellement chargé en mémoire */
    val isLoaded: Boolean = false,

    /** Statistiques du vault */
    @Embedded
    val statistics: VaultStatistics,

    /** Description optionnelle */
    val description: String? = null,

    /** Date de création */
    val createdAt: Long,

    // ========== Biometric Fields ==========

    /** Déverrouillage biométrique activé pour ce vault */
    val biometricUnlockEnabled: Boolean = false,

    /** Master password chiffré avec Android Keystore (pour biométrie) */
    val encryptedMasterPassword: ByteArray? = null,

    /** IV (Initialization Vector) pour déchiffrer le master password */
    val masterPasswordIv: ByteArray? = null
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as VaultRegistryEntry

        if (id != other.id) return false
        if (name != other.name) return false
        if (filePath != other.filePath) return false
        if (storageStrategy != other.storageStrategy) return false
        if (fileSize != other.fileSize) return false
        if (lastModified != other.lastModified) return false
        if (lastAccessed != other.lastAccessed) return false
        if (isDefault != other.isDefault) return false
        if (isLoaded != other.isLoaded) return false
        if (statistics != other.statistics) return false
        if (description != other.description) return false
        if (createdAt != other.createdAt) return false
        if (biometricUnlockEnabled != other.biometricUnlockEnabled) return false
        if (encryptedMasterPassword != null) {
            if (other.encryptedMasterPassword == null) return false
            if (!encryptedMasterPassword.contentEquals(other.encryptedMasterPassword)) return false
        } else if (other.encryptedMasterPassword != null) return false
        if (masterPasswordIv != null) {
            if (other.masterPasswordIv == null) return false
            if (!masterPasswordIv.contentEquals(other.masterPasswordIv)) return false
        } else if (other.masterPasswordIv != null) return false

        return true
    }

    override fun hashCode(): Int {
        var result = id.hashCode()
        result = 31 * result + name.hashCode()
        result = 31 * result + filePath.hashCode()
        result = 31 * result + storageStrategy.hashCode()
        result = 31 * result + fileSize.hashCode()
        result = 31 * result + lastModified.hashCode()
        result = 31 * result + (lastAccessed?.hashCode() ?: 0)
        result = 31 * result + isDefault.hashCode()
        result = 31 * result + isLoaded.hashCode()
        result = 31 * result + statistics.hashCode()
        result = 31 * result + (description?.hashCode() ?: 0)
        result = 31 * result + createdAt.hashCode()
        result = 31 * result + biometricUnlockEnabled.hashCode()
        result = 31 * result + (encryptedMasterPassword?.contentHashCode() ?: 0)
        result = 31 * result + (masterPasswordIv?.contentHashCode() ?: 0)
        return result
    }
}

