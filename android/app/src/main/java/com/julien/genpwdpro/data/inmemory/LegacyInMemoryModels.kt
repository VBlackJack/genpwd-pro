package com.julien.genpwdpro.data.inmemory

import com.google.gson.annotations.SerializedName
import com.julien.genpwdpro.data.db.entity.EntryTagCrossRef
import com.julien.genpwdpro.data.db.entity.FolderEntity
import com.julien.genpwdpro.data.db.entity.PresetEntity
import com.julien.genpwdpro.data.db.entity.TagEntity
import com.julien.genpwdpro.data.db.entity.VaultEntity
import com.julien.genpwdpro.data.db.entity.VaultEntryEntity
import com.julien.genpwdpro.data.models.vault.VaultMetadata
import java.io.File

/**
 * Legacy JSON payload describing the decrypted in-memory representation of a vault.
 * The payload mirrors the data bundled inside the legacy `.gpv` files and cached JSON
 * snapshots that were produced prior to the SQLCipher migration.
 */
data class LegacyInMemoryVaultContainer(
    @SerializedName("vault") val vault: VaultEntity? = null,
    @SerializedName("vault_id") val legacyVaultId: String? = null,
    @SerializedName("metadata") val metadata: VaultMetadata? = null,
    @SerializedName("entries") val entries: List<VaultEntryEntity> = emptyList(),
    @SerializedName("folders") val folders: List<FolderEntity> = emptyList(),
    @SerializedName("tags") val tags: List<TagEntity> = emptyList(),
    @SerializedName("presets") val presets: List<PresetEntity> = emptyList(),
    @SerializedName("entry_tags") val entryTags: List<EntryTagCrossRef> = emptyList()
)

/**
 * Snapshot produced after parsing a legacy cache file. It contains enough information
 * to rebuild the Room entities for a vault in the new SQLCipher database.
 */
data class LegacyVaultSnapshot(
    val vaultId: String,
    val vault: VaultEntity?,
    val metadata: VaultMetadata?,
    val entries: List<VaultEntryEntity>,
    val folders: List<FolderEntity>,
    val tags: List<TagEntity>,
    val presets: List<PresetEntity>,
    val entryTags: List<EntryTagCrossRef>,
    val sourceFile: File
)
