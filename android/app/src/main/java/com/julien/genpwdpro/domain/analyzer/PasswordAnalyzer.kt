package com.julien.genpwdpro.domain.analyzer

import com.julien.genpwdpro.data.models.GenerationMode
import com.julien.genpwdpro.domain.utils.EntropyCalculator
import javax.inject.Inject

/**
 * Analyseur de mots de passe existants
 * Fournit des informations détaillées sur la force et la composition
 */
class PasswordAnalyzer @Inject constructor() {

    /**
     * Analyse un mot de passe et retourne des métriques détaillées
     */
    fun analyze(password: String): PasswordAnalysis {
        if (password.isEmpty()) {
            return PasswordAnalysis(
                password = password,
                length = 0,
                entropy = 0.0,
                charsetSize = 0,
                hasLowercase = false,
                hasUppercase = false,
                hasDigits = false,
                hasSpecials = false,
                lowercaseCount = 0,
                uppercaseCount = 0,
                digitsCount = 0,
                specialsCount = 0,
                uniqueChars = 0,
                repeatedChars = emptyList(),
                sequentialPatterns = emptyList(),
                commonWords = emptyList(),
                estimatedCrackTime = "Instantané",
                strength = PasswordAnalysisStrength.VERY_WEAK,
                recommendations = listOf("Le mot de passe est vide")
            )
        }

        val length = password.length
        val hasLowercase = password.any { it.isLowerCase() }
        val hasUppercase = password.any { it.isUpperCase() }
        val hasDigits = password.any { it.isDigit() }
        val hasSpecials = password.any { !it.isLetterOrDigit() }

        val lowercaseCount = password.count { it.isLowerCase() }
        val uppercaseCount = password.count { it.isUpperCase() }
        val digitsCount = password.count { it.isDigit() }
        val specialsCount = password.count { !it.isLetterOrDigit() }

        val uniqueChars = password.toSet().size
        val repeatedChars = findRepeatedChars(password)
        val sequentialPatterns = findSequentialPatterns(password)
        val commonWords = findCommonWords(password)

        val charsetSize = calculateCharsetSize(hasLowercase, hasUppercase, hasDigits, hasSpecials)
        val entropy = EntropyCalculator.calculateEntropy(password, GenerationMode.CLASSIC)

        val estimatedCrackTime = estimateCrackTime(entropy)
        val strength = determineStrength(entropy, length, uniqueChars, sequentialPatterns.isNotEmpty(), commonWords.isNotEmpty())
        val recommendations = generateRecommendations(
            length, hasLowercase, hasUppercase, hasDigits, hasSpecials,
            uniqueChars, repeatedChars, sequentialPatterns, commonWords
        )

        return PasswordAnalysis(
            password = password,
            length = length,
            entropy = entropy,
            charsetSize = charsetSize,
            hasLowercase = hasLowercase,
            hasUppercase = hasUppercase,
            hasDigits = hasDigits,
            hasSpecials = hasSpecials,
            lowercaseCount = lowercaseCount,
            uppercaseCount = uppercaseCount,
            digitsCount = digitsCount,
            specialsCount = specialsCount,
            uniqueChars = uniqueChars,
            repeatedChars = repeatedChars,
            sequentialPatterns = sequentialPatterns,
            commonWords = commonWords,
            estimatedCrackTime = estimatedCrackTime,
            strength = strength,
            recommendations = recommendations
        )
    }

    /**
     * Trouve les caractères répétés (3+ fois consécutives)
     */
    private fun findRepeatedChars(password: String): List<String> {
        val patterns = mutableListOf<String>()
        var i = 0
        while (i < password.length - 2) {
            if (password[i] == password[i + 1] && password[i] == password[i + 2]) {
                var count = 1
                while (i + count < password.length && password[i] == password[i + count]) {
                    count++
                }
                patterns.add("${password[i].toString().repeat(count)} (${count}x)")
                i += count
            } else {
                i++
            }
        }
        return patterns
    }

    /**
     * Trouve les motifs séquentiels (abc, 123, etc.)
     */
    private fun findSequentialPatterns(password: String): List<String> {
        val patterns = mutableListOf<String>()
        val sequences = listOf(
            "abcdefghijklmnopqrstuvwxyz",
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
            "0123456789",
            "qwertyuiop",
            "asdfghjkl",
            "zxcvbnm"
        )

        for (sequence in sequences) {
            for (i in 0..sequence.length - 3) {
                val pattern = sequence.substring(i, i + 3)
                if (password.contains(pattern)) {
                    patterns.add(pattern)
                }
                // Check reverse
                val reversePattern = pattern.reversed()
                if (password.contains(reversePattern)) {
                    patterns.add(reversePattern)
                }
            }
        }

        return patterns.distinct()
    }

    /**
     * Trouve les mots communs faibles
     */
    private fun findCommonWords(password: String): List<String> {
        val commonWords = listOf(
            "password", "motdepasse", "admin", "user", "root", "test",
            "123456", "qwerty", "azerty", "letmein", "welcome", "monkey",
            "dragon", "master", "password1", "pass", "login", "secret"
        )

        return commonWords.filter { password.lowercase().contains(it) }
    }

    /**
     * Calcule la taille de l'ensemble de caractères
     */
    private fun calculateCharsetSize(
        hasLowercase: Boolean,
        hasUppercase: Boolean,
        hasDigits: Boolean,
        hasSpecials: Boolean
    ): Int {
        var size = 0
        if (hasLowercase) size += 26
        if (hasUppercase) size += 26
        if (hasDigits) size += 10
        if (hasSpecials) size += 32 // Estimation
        return size
    }

    /**
     * Estime le temps de crackage
     */
    private fun estimateCrackTime(entropy: Double): String {
        // Hypothèse: 10 milliards de tentatives/seconde
        val attempts = Math.pow(2.0, entropy)
        val seconds = attempts / 10_000_000_000.0

        return when {
            seconds < 1 -> "Instantané"
            seconds < 60 -> "${seconds.toInt()} secondes"
            seconds < 3600 -> "${(seconds / 60).toInt()} minutes"
            seconds < 86400 -> "${(seconds / 3600).toInt()} heures"
            seconds < 2_592_000 -> "${(seconds / 86400).toInt()} jours"
            seconds < 31_536_000 -> "${(seconds / 2_592_000).toInt()} mois"
            seconds < 3_153_600_000 -> "${(seconds / 31_536_000).toInt()} ans"
            else -> "${(seconds / 31_536_000_000).toLong()} siècles"
        }
    }

    /**
     * Détermine la force globale
     */
    private fun determineStrength(
        entropy: Double,
        length: Int,
        uniqueChars: Int,
        hasSequential: Boolean,
        hasCommonWords: Boolean
    ): PasswordAnalysisStrength {
        // Pénalités
        var score = entropy

        if (hasSequential) score -= 10
        if (hasCommonWords) score -= 20
        if (length < 8) score -= 10
        if (uniqueChars < length * 0.5) score -= 5

        return when {
            score < 30 -> PasswordAnalysisStrength.VERY_WEAK
            score < 50 -> PasswordAnalysisStrength.WEAK
            score < 70 -> PasswordAnalysisStrength.MEDIUM
            score < 90 -> PasswordAnalysisStrength.STRONG
            else -> PasswordAnalysisStrength.VERY_STRONG
        }
    }

    /**
     * Génère des recommandations d'amélioration
     */
    private fun generateRecommendations(
        length: Int,
        hasLowercase: Boolean,
        hasUppercase: Boolean,
        hasDigits: Boolean,
        hasSpecials: Boolean,
        uniqueChars: Int,
        repeatedChars: List<String>,
        sequentialPatterns: List<String>,
        commonWords: List<String>
    ): List<String> {
        val recommendations = mutableListOf<String>()

        if (length < 12) {
            recommendations.add("Augmentez la longueur à au moins 12 caractères")
        }

        if (!hasLowercase) {
            recommendations.add("Ajoutez des lettres minuscules")
        }

        if (!hasUppercase) {
            recommendations.add("Ajoutez des lettres majuscules")
        }

        if (!hasDigits) {
            recommendations.add("Ajoutez des chiffres")
        }

        if (!hasSpecials) {
            recommendations.add("Ajoutez des caractères spéciaux (!@#$%)")
        }

        if (uniqueChars < length * 0.7) {
            recommendations.add("Utilisez plus de caractères uniques")
        }

        if (repeatedChars.isNotEmpty()) {
            recommendations.add("Évitez les répétitions: ${repeatedChars.joinToString(", ")}")
        }

        if (sequentialPatterns.isNotEmpty()) {
            recommendations.add("Évitez les séquences: ${sequentialPatterns.take(3).joinToString(", ")}")
        }

        if (commonWords.isNotEmpty()) {
            recommendations.add("Évitez les mots communs: ${commonWords.joinToString(", ")}")
        }

        if (recommendations.isEmpty()) {
            recommendations.add("Excellent mot de passe ! 🎉")
        }

        return recommendations
    }
}

/**
 * Résultat de l'analyse d'un mot de passe
 */
data class PasswordAnalysis(
    val password: String,
    val length: Int,
    val entropy: Double,
    val charsetSize: Int,
    val hasLowercase: Boolean,
    val hasUppercase: Boolean,
    val hasDigits: Boolean,
    val hasSpecials: Boolean,
    val lowercaseCount: Int,
    val uppercaseCount: Int,
    val digitsCount: Int,
    val specialsCount: Int,
    val uniqueChars: Int,
    val repeatedChars: List<String>,
    val sequentialPatterns: List<String>,
    val commonWords: List<String>,
    val estimatedCrackTime: String,
    val strength: PasswordAnalysisStrength,
    val recommendations: List<String>
)

/**
 * Force du mot de passe analysé
 */
enum class PasswordAnalysisStrength(val label: String, val color: Long) {
    VERY_WEAK("Très Faible", 0xFFEF4444),
    WEAK("Faible", 0xFFFF6B6B),
    MEDIUM("Moyen", 0xFFF59E0B),
    STRONG("Fort", 0xFF10B981),
    VERY_STRONG("Très Fort", 0xFF15BEFF)
}
