package com.julien.genpwdpro.data.local.entity

import androidx.room.Embedded
import androidx.room.Entity
import androidx.room.PrimaryKey
import com.julien.genpwdpro.data.models.vault.StorageStrategy
import com.julien.genpwdpro.data.models.vault.VaultStatistics

/**
 * Entrée du registre des vaults
 * Stocke les métadonnées et l'emplacement des fichiers .gpv
 */
@Entity(tableName = "vault_registry")
data class VaultRegistryEntry(
    @PrimaryKey
    val id: String,

    /** Nom du vault */
    val name: String,

    /** Chemin absolu vers le fichier .gpv */
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
    val createdAt: Long
)
