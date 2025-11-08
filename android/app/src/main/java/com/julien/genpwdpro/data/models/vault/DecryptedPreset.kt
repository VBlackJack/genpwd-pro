package com.julien.genpwdpro.data.models.vault

import com.google.gson.Gson
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.data.models.GenerationMode
import com.julien.genpwdpro.data.models.Settings

/**
 * Version déchiffrée d'un preset pour manipulation dans l'UI
 * Wrap PresetEntity avec des types strongly-typed (GenerationMode, Settings)
 */
data class DecryptedPreset(
    val id: String,
    val vaultId: String,
    val name: String,
    val icon: String,
    val generationMode: GenerationMode,
    val settings: Settings,
    val isDefault: Boolean,
    val isSystemPreset: Boolean,
    val createdAt: Long,
    val modifiedAt: Long,
    val lastUsedAt: Long?,
    val usageCount: Int
)

/**
 * Extensions pour convertir entre PresetEntity (storage) et DecryptedPreset (UI)
 */
private val gson = Gson()

fun PresetEntity.toDecrypted(): DecryptedPreset {
    val parsedGenerationMode = try {
        GenerationMode.valueOf(generationMode)
    } catch (e: Exception) {
        SafeLog.w(
            "DecryptedPreset",
            "Failed to parse generationMode '${SafeLog.redact(generationMode)}' for preset ${SafeLog.redact(id)}, using SYLLABLES. Error: ${e.message}"
        )
        GenerationMode.SYLLABLES
    }

    val parsedSettings = try {
        gson.fromJson(settings, Settings::class.java)
    } catch (e: Exception) {
        SafeLog.e(
            "DecryptedPreset",
            "Failed to deserialize Settings for preset ${SafeLog.redact(id)} (${SafeLog.redact(name)}). " +
                "JSON length: ${settings.length}, Error: ${e.message}",
            e
        )
        Settings() // Default settings
    }

    return DecryptedPreset(
        id = id,
        vaultId = vaultId,
        name = name,
        icon = icon,
        generationMode = parsedGenerationMode,
        settings = parsedSettings,
        isDefault = isDefault,
        isSystemPreset = isSystemPreset,
        createdAt = createdAt,
        modifiedAt = modifiedAt,
        lastUsedAt = lastUsedAt,
        usageCount = usageCount
    )
}

fun DecryptedPreset.toEntity(): PresetEntity {
    return PresetEntity(
        id = id,
        vaultId = vaultId,
        name = name,
        icon = icon,
        generationMode = generationMode.name,
        settings = gson.toJson(settings),
        isDefault = isDefault,
        isSystemPreset = isSystemPreset,
        createdAt = createdAt,
        modifiedAt = modifiedAt,
        lastUsedAt = lastUsedAt,
        usageCount = usageCount
    )
}

fun List<PresetEntity>.toDecrypted(): List<DecryptedPreset> = map { it.toDecrypted() }
