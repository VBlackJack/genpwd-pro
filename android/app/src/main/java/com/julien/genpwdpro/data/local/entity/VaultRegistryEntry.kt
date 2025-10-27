package com.julien.genpwdpro.data.local.entity

import androidx.room.Embedded
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import com.julien.genpwdpro.data.models.vault.StorageStrategy
import com.julien.genpwdpro.data.models.vault.VaultStatistics

/**
 * Room entity for vault registry
 * Tracks vault files (.gpv) on the filesystem
 *
 * This table maintains a registry of all vault files, their locations,
 * and statistics about their contents.
 *
 * IMPORTANT:
 * - Field order in this entity MUST match the column order in MIGRATION SQL
 * - Indices MUST be declared here to match migration CREATE INDEX statements
 */
@Entity(
    tableName = "vault_registry",
    indices = [
        Index(value = ["name"]),
        Index(value = ["filePath"]),
        Index(value = ["isDefault"]),
        Index(value = ["lastAccessed"]),
        Index(value = ["storageStrategy"])
    ]
)
data class VaultRegistryEntry(
    /** Unique identifier (UUID) */
    @PrimaryKey
    val id: String,

    /** Vault name (user-facing) */
    val name: String,

    /** Full file path to .gpv file */
    val filePath: String,

    /** Storage strategy (INTERNAL, EXTERNAL, CUSTOM) */
    val storageStrategy: String, // Stored as TEXT, maps to StorageStrategy enum

    /** File size in bytes */
    val fileSize: Long,

    /** Last modification timestamp (file modified) */
    val lastModified: Long,

    /** Last access timestamp (nullable - may never be accessed) */
    val lastAccessed: Long? = null,

    /** Whether this is the default vault */
    val isDefault: Boolean = false,

    /** Whether the vault is currently loaded in memory */
    val isLoaded: Boolean = false,

    /** Embedded statistics about vault contents */
    @Embedded
    val statistics: VaultStatistics = VaultStatistics(),

    /** Optional description */
    val description: String? = null,

    /** Creation timestamp */
    val createdAt: Long = System.currentTimeMillis()
) {
    /**
     * Helper to get StorageStrategy enum from string
     */
    fun getStorageStrategyEnum(): StorageStrategy {
        return try {
            StorageStrategy.valueOf(storageStrategy)
        } catch (e: IllegalArgumentException) {
            StorageStrategy.INTERNAL // Default fallback
        }
    }

    companion object {
        /**
         * Helper to create storage strategy string from enum
         */
        fun storageStrategyToString(strategy: StorageStrategy): String {
            return strategy.name
        }
    }
}
