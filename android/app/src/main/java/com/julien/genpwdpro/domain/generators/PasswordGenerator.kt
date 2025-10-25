package com.julien.genpwdpro.domain.generators

import com.julien.genpwdpro.data.models.Settings

/**
 * Interface de base pour tous les générateurs de mots de passe
 */
interface PasswordGenerator {
    /**
     * Génère un mot de passe basé sur les paramètres fournis
     *
     * @param settings Configuration de génération
     * @return Mot de passe généré (sans chiffres/spéciaux appliqués)
     */
    suspend fun generate(settings: Settings): String
}
