package com.julien.genpwdpro.data.models.vault

/**
 * Storage strategy for vault files
 */
enum class StorageStrategy {
    /** Internal app storage (default) */
    INTERNAL,

    /** External storage (SD card) */
    EXTERNAL,

    /** Custom user-defined location */
    CUSTOM
}

/**
 * Statistics about vault contents and usage
 * Used as @Embedded in VaultRegistryEntry
 */
data class VaultStatistics(
    /** Number of entries in the vault */
    val entryCount: Int = 0,

    /** Number of folders in the vault */
    val folderCount: Int = 0,

    /** Number of presets in the vault */
    val presetCount: Int = 0,

    /** Number of tags in the vault */
    val tagCount: Int = 0,

    /** Total size in bytes (Long to support large vaults) */
    val totalSize: Long = 0
)

/**
 * Metadata for a vault file (.gpv)
 * This is a domain model (not a Room entity)
 */
data class VaultMetadata(
    val id: String,
    val name: String,
    val filePath: String,
    val storageStrategy: StorageStrategy,
    val fileSize: Long,
    val lastModified: Long,
    val lastAccessed: Long?,
    val statistics: VaultStatistics,
    val description: String?,
    val createdAt: Long,
    val isDefault: Boolean = false,
    val isLoaded: Boolean = false
)
