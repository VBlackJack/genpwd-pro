package com.julien.genpwdpro.domain.generators

import com.julien.genpwdpro.data.models.Settings
import javax.inject.Inject

/**
 * Générateur de phrases personnalisées
 * Permet aux utilisateurs de créer des passphrases avec leurs propres listes de mots
 */
class CustomPhraseGenerator @Inject constructor() : PasswordGenerator {

    companion object {
        // Catégories de mots prédéfinies (suggestions)
        val SUGGESTIONS = mapOf(
            "Animaux" to listOf("chat", "chien", "lion", "tigre", "ours", "loup", "aigle", "dauphin", "éléphant", "girafe"),
            "Couleurs" to listOf("rouge", "bleu", "vert", "jaune", "noir", "blanc", "violet", "orange", "rose", "gris"),
            "Fruits" to listOf("pomme", "banane", "orange", "fraise", "kiwi", "mangue", "ananas", "poire", "raisin", "cerise"),
            "Pays" to listOf("france", "japon", "brésil", "canada", "italie", "espagne", "grèce", "égypte", "mexique", "norvège"),
            "Métiers" to listOf("docteur", "avocat", "artiste", "chef", "pilote", "professeur", "ingénieur", "designer", "écrivain", "musicien"),
            "Nature" to listOf("montagne", "océan", "forêt", "désert", "lac", "rivière", "prairie", "volcan", "cascade", "grotte"),
            "Nombres" to (1..100).map { it.toString() },
            "Symboles" to listOf("@", "#", "$", "%", "&", "*", "+", "=", "!", "?")
        )
    }

    /**
     * Génère une passphrase à partir de mots personnalisés
     */
    override suspend fun generate(settings: Settings): String {
        val customWords = settings.customPhraseWords.ifEmpty {
            // Si aucun mot personnalisé, utiliser les suggestions
            SUGGESTIONS.values.flatten().shuffled().take(50)
        }

        if (customWords.isEmpty()) {
            throw IllegalStateException("Aucun mot disponible pour la génération")
        }

        val wordCount = settings.customPhraseWordCount.coerceIn(2, 10)
        val selectedWords = selectRandomWords(customWords, wordCount)

        return when (settings.customPhraseFormat) {
            CustomPhraseFormat.SEPARATED -> {
                selectedWords.joinToString(settings.customPhraseSeparator)
            }
            CustomPhraseFormat.CAPITALIZED -> {
                selectedWords.joinToString("") { it.replaceFirstChar { c -> c.uppercase() } }
            }
            CustomPhraseFormat.CAMEL_CASE -> {
                selectedWords.mapIndexed { index, word ->
                    if (index == 0) {
                        word.lowercase()
                    } else {
                        word.replaceFirstChar { c -> c.uppercase() }
                    }
                }.joinToString("")
            }
            CustomPhraseFormat.SNAKE_CASE -> {
                selectedWords.joinToString("_") { it.lowercase() }
            }
            CustomPhraseFormat.KEBAB_CASE -> {
                selectedWords.joinToString("-") { it.lowercase() }
            }
        }
    }

    /**
     * Sélectionne des mots aléatoires sans répétition
     */
    private fun selectRandomWords(words: List<String>, count: Int): List<String> {
        return if (words.size <= count) {
            words.shuffled()
        } else {
            words.shuffled().take(count)
        }
    }

    /**
     * Calcule l'entropie d'une phrase personnalisée
     */
    fun calculateEntropy(wordListSize: Int, wordCount: Int): Double {
        if (wordListSize <= 0 || wordCount <= 0) return 0.0

        // Entropie = log2(taille_dictionnaire) * nombre_de_mots
        val bitsPerWord = Math.log(wordListSize.toDouble()) / Math.log(2.0)
        return bitsPerWord * wordCount
    }

    /**
     * Extrait les mots d'un texte (séparé par espaces, virgules, points-virgules, retours à la ligne)
     */
    fun parseWordList(text: String): List<String> {
        return text
            .split(Regex("[\\s,;\\n\\r]+"))
            .map { it.trim().lowercase() }
            .filter { it.isNotEmpty() && it.length >= 2 }
            .distinct()
    }

    /**
     * Valide une liste de mots personnalisés
     */
    fun validateWordList(words: List<String>): WordListValidation {
        if (words.isEmpty()) {
            return WordListValidation(
                isValid = false,
                error = "La liste de mots est vide",
                wordCount = 0,
                averageLength = 0.0,
                minEntropy = 0.0,
                maxEntropy = 0.0
            )
        }

        if (words.size < 10) {
            return WordListValidation(
                isValid = false,
                error = "La liste doit contenir au moins 10 mots différents",
                wordCount = words.size,
                averageLength = words.map { it.length }.average(),
                minEntropy = calculateEntropy(words.size, 2),
                maxEntropy = calculateEntropy(words.size, 10)
            )
        }

        val tooShort = words.filter { it.length < 2 }
        if (tooShort.isNotEmpty()) {
            return WordListValidation(
                isValid = false,
                error = "Certains mots sont trop courts (< 2 caractères)",
                wordCount = words.size,
                averageLength = words.map { it.length }.average(),
                minEntropy = calculateEntropy(words.size, 2),
                maxEntropy = calculateEntropy(words.size, 10)
            )
        }

        return WordListValidation(
            isValid = true,
            error = null,
            wordCount = words.size,
            averageLength = words.map { it.length }.average(),
            minEntropy = calculateEntropy(words.size, 2),
            maxEntropy = calculateEntropy(words.size, 10)
        )
    }
}

/**
 * Format de la phrase personnalisée
 */
enum class CustomPhraseFormat {
    SEPARATED, // mots séparés: "mot1-mot2-mot3"
    CAPITALIZED, // capitalisé: "Mot1Mot2Mot3"
    CAMEL_CASE, // camelCase: "mot1Mot2Mot3"
    SNAKE_CASE, // snake_case: "mot1_mot2_mot3"
    KEBAB_CASE // kebab-case: "mot1-mot2-mot3"
}

/**
 * Résultat de la validation d'une liste de mots
 */
data class WordListValidation(
    val isValid: Boolean,
    val error: String?,
    val wordCount: Int,
    val averageLength: Double,
    val minEntropy: Double, // Entropie avec 2 mots
    val maxEntropy: Double // Entropie avec 10 mots
)
