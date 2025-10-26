package com.julien.genpwdpro.data.models

import java.util.UUID

/**
 * Résultat de génération d'un mot de passe
 */
data class PasswordResult(
    val id: String = UUID.randomUUID().toString(),
    val password: String,
    val entropy: Double,
    val mode: GenerationMode,
    val timestamp: Long = System.currentTimeMillis(),
    val settings: Settings,
    val isMasked: Boolean = true,
    val isFavorite: Boolean = false,
    val note: String = ""
) {
    /**
     * Mot de passe masqué pour l'affichage
     */
    val maskedPassword: String
        get() = if (isMasked) "•".repeat(password.length) else password

    /**
     * Force du mot de passe basée sur l'entropie
     */
    val strength: PasswordStrength
        get() = when {
            entropy < 50 -> PasswordStrength.WEAK
            entropy < 70 -> PasswordStrength.MEDIUM
            entropy < 100 -> PasswordStrength.STRONG
            else -> PasswordStrength.VERY_STRONG
        }

    /**
     * Formatte l'entropie pour l'affichage
     */
    val entropyDisplay: String
        get() = "%.1f bits".format(entropy)
}

/**
 * Force d'un mot de passe
 */
enum class PasswordStrength(val color: Long, val label: String, val progress: Float) {
    WEAK(0xFFEF4444, "Faible", 0.25f),
    MEDIUM(0xFFF59E0B, "Moyen", 0.5f),
    STRONG(0xFF10B981, "Fort", 0.75f),
    VERY_STRONG(0xFF15BEFF, "Très fort", 1.0f)
}
