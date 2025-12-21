package com.julien.genpwdpro.domain.utils

import com.julien.genpwdpro.data.models.GenerationMode
import kotlin.math.log2

/**
 * Calcul de l'entropie des mots de passe
 * Port de la logique JavaScript
 */
object EntropyCalculator {

    /**
     * Calcule l'entropie d'un mot de passe
     * Formule: entropie = longueur * log2(taille_charset)
     *
     * @param password Mot de passe à analyser
     * @param mode Mode de génération utilisé
     * @param charset Ensemble de caractères utilisés
     * @return Entropie en bits
     */
    fun calculateEntropy(
        password: String,
        mode: GenerationMode,
        charset: Set<Char> = detectCharset(password)
    ): Double {
        if (password.isEmpty()) return 0.0

        val poolSize = charset.size.toDouble()
        if (poolSize <= 1) return 0.0

        return password.length * log2(poolSize)
    }

    /**
     * Détecte automatiquement le charset utilisé dans un mot de passe
     */
    private fun detectCharset(password: String): Set<Char> {
        val charset = mutableSetOf<Char>()

        for (char in password) {
            when {
                char.isLowerCase() -> charset.add('a') // Représente les minuscules
                char.isUpperCase() -> charset.add('A') // Représente les majuscules
                char.isDigit() -> charset.add('0') // Représente les chiffres
                else -> charset.add(char) // Caractères spéciaux ajoutés individuellement
            }
        }

        // Estimation de la taille du pool
        val poolSize = when {
            charset.contains('a') && charset.contains('A') && charset.any { !it.isLetterOrDigit() } && charset.any { it.isDigit() } -> 94 // Full ASCII
            charset.contains('a') && charset.contains('A') && charset.any { it.isDigit() } -> 62 // Alphanumeric mixte
            charset.contains('a') && charset.contains('A') -> 52 // Lettres mixtes
            charset.contains('a') || charset.contains('A') -> 26 // Lettres seules
            charset.any { it.isDigit() } -> 10 // Chiffres seuls
            else -> charset.size // Taille exacte pour autres cas
        }

        // Retourne un set de la taille appropriée
        return (1..poolSize).map { it.toChar() }.toSet()
    }

    /**
     * Calcule l'entropie pour le mode Syllables
     * Prend en compte l'alternance consonnes/voyelles
     */
    fun calculateSyllablesEntropy(
        password: String,
        consonantsPoolSize: Int,
        vowelsPoolSize: Int,
        hasDigits: Boolean = false,
        hasSpecials: Boolean = false
    ): Double {
        var entropy = 0.0
        var isConsonant = true // Premier caractère est une consonne

        for (char in password) {
            when {
                char.isLetter() -> {
                    val poolSize = if (isConsonant) consonantsPoolSize else vowelsPoolSize
                    entropy += log2(poolSize.toDouble() * 2) // x2 pour maj/min
                    isConsonant = !isConsonant
                }
                char.isDigit() -> {
                    entropy += log2(10.0) // 10 chiffres possibles
                }
                else -> {
                    // Caractère spécial
                    entropy += log2(12.0) // ~12 caractères spéciaux standards
                }
            }
        }

        return entropy
    }

    /**
     * Calcule l'entropie pour le mode Passphrase
     * Prend en compte le nombre de mots dans le dictionnaire
     */
    fun calculatePassphraseEntropy(
        wordCount: Int,
        dictionarySize: Int
    ): Double {
        return wordCount * log2(dictionarySize.toDouble())
    }

    /**
     * Retourne une description textuelle de la force du mot de passe
     */
    fun getStrengthDescription(entropy: Double): String {
        return when {
            entropy < 50 -> "Faible"
            entropy < 70 -> "Moyen"
            entropy < 100 -> "Fort"
            else -> "Très fort"
        }
    }

    /**
     * Retourne une couleur pour représenter la force
     */
    fun getStrengthColor(entropy: Double): Long {
        return when {
            entropy < 50 -> 0xFFEF4444 // Rouge
            entropy < 70 -> 0xFFF59E0B // Orange
            entropy < 100 -> 0xFF10B981 // Vert
            else -> 0xFF15BEFF // Bleu cyan
        }
    }

    /**
     * Calcule l'entropie pour le mode Leet Speak
     * Utilise une taille de pool estimée (lettres + chiffres + spéciaux)
     */
    fun calculateLeetSpeakEntropy(
        password: String,
        estimatedPoolSize: Int
    ): Double {
        if (password.isEmpty()) return 0.0
        if (estimatedPoolSize <= 1) return 0.0
        return password.length * log2(estimatedPoolSize.toDouble())
    }

    /**
     * Calcule l'entropie brute-force basée sur les caractères détectés
     * Analyse automatiquement le type de caractères utilisés
     */
    fun calculateBruteForceEntropy(password: String): Double {
        if (password.isEmpty()) return 0.0
        val poolSize = estimateCharacterPoolSize(password)
        if (poolSize <= 1) return 0.0
        return password.length * log2(poolSize.toDouble())
    }

    /**
     * Estime la taille du pool de caractères basée sur le mot de passe
     *
     * Utilise une estimation conservatrice:
     * - Lettres seules: 26 (un seul type) ou 52 (mixed case)
     * - Alphanumeric: 62 (lettres + chiffres)
     * - Avec spéciaux: 94 (ASCII imprimable)
     */
    fun estimateCharacterPoolSize(password: String): Int {
        var hasLower = false
        var hasUpper = false
        var hasDigit = false
        var hasSpecial = false

        for (char in password) {
            when {
                char.isLowerCase() -> hasLower = true
                char.isUpperCase() -> hasUpper = true
                char.isDigit() -> hasDigit = true
                !char.isLetterOrDigit() -> hasSpecial = true
            }
        }

        // Build pool size based on detected character types
        var pool = 0
        if (hasLower) pool += 26
        if (hasUpper) pool += 26
        if (hasDigit) pool += 10
        if (hasSpecial) pool += 36 // Approximate special characters

        return if (pool > 0) pool else 1
    }
}
