package com.julien.genpwdpro.data.models

/**
 * Modes de génération de mots de passe
 */
enum class GenerationMode {
    /**
     * Mode Syllables: alternance consonnes/voyelles
     * Exemple: "nywOVyQep.Ocy"
     */
    SYLLABLES,

    /**
     * Mode Passphrase: mots du dictionnaire séparés
     * Exemple: "Forcer-Vague-Nature"
     */
    PASSPHRASE,

    /**
     * Mode Leet Speak: transformation de texte
     * Exemple: "P@55W0RD"
     */
    LEET,

    /**
     * Mode Custom Phrase: mots personnalisés
     * Exemple: "Chat-Bleu-Montagne-Rapide"
     */
    CUSTOM_PHRASE
}

/**
 * Stratégies de placement des caractères
 */
enum class Placement {
    START, // Début
    END, // Fin
    MIDDLE, // Milieu
    RANDOM, // Aléatoire
    VISUAL // Position visuelle (pourcentage)
}

/**
 * Modes de casse
 */
enum class CaseMode {
    MIXED, // Aléatoire
    UPPER, // MAJUSCULES
    LOWER, // minuscules
    TITLE, // Title Case
    BLOCKS // Blocs personnalisés
}

/**
 * Blocs de casse pour le mode BLOCKS
 */
enum class CaseBlock {
    U, // UPPER
    T, // Title
    L // lower
}

/**
 * Politiques de caractères pour le mode Syllables
 */
enum class CharPolicy {
    STANDARD, // Tous caractères
    STANDARD_LAYOUT, // Layout-safe (AZERTY/QWERTY)
    ALPHANUMERIC, // Lettres + chiffres
    ALPHANUMERIC_LAYOUT // Alpha Layout-safe
}

/**
 * Types de dictionnaires disponibles
 */
enum class DictionaryType(val displayName: String, val flag: String) {
    FRENCH("Français", "🇫🇷"),
    ENGLISH("English", "🇬🇧"),
    LATIN("Latin", "🏛️")
}
