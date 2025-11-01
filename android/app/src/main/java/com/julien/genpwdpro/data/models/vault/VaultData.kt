package com.julien.genpwdpro.data.models.vault

// Toutes les entités sont maintenant définies dans ce package (VaultEntities.kt)
// Plus besoin d'importer depuis data.db.entity (supprimé)

/**
 * Metadata du vault (stocké dans le fichier .gpv)
 */
data class VaultMetadata(
    val vaultId: String,
    val name: String,
    val description: String?,
    val isDefault: Boolean,
    val createdAt: Long,
    val modifiedAt: Long,
    val statistics: VaultStatistics
)

/**
 * Statistiques du vault
 */
data class VaultStatistics(
    val entryCount: Int = 0,
    val folderCount: Int = 0,
    val presetCount: Int = 0,
    val tagCount: Int = 0,
    val totalSize: Long = 0
)

/**
 * Données complètes du vault
 * Tout ce qui est stocké dans le fichier .gpv
 */
data class VaultData(
    val metadata: VaultMetadata,
    val entries: List<VaultEntryEntity>,
    val folders: List<FolderEntity>,
    val tags: List<TagEntity>,
    val presets: List<PresetEntity>,
    val entryTags: List<EntryTagCrossRef>
)

/**
 * Fichier vault complet
 */
data class VaultFile(
    val header: VaultFileHeader,
    val data: VaultData
)
