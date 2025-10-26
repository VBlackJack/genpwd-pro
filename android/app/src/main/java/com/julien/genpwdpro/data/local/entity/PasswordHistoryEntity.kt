package com.julien.genpwdpro.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.julien.genpwdpro.data.models.GenerationMode

/**
 * Entité Room pour l'historique des mots de passe
 */
@Entity(tableName = "password_history")
data class PasswordHistoryEntity(
    @PrimaryKey
    val id: String,
    val password: String,
    val entropy: Double,
    val mode: String, // GenerationMode en String
    val timestamp: Long,
    val settingsJson: String, // Settings sérialisé en JSON
    val isFavorite: Boolean = false, // Marqué comme favori
    val note: String = "" // Note personnalisée
)

/**
 * Convertit en GenerationMode
 */
fun String.toGenerationMode(): GenerationMode {
    return GenerationMode.valueOf(this)
}
