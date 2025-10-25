package com.julien.genpwdpro.domain.generators

import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.domain.utils.CharacterSets
import kotlin.random.Random

/**
 * Générateur de mots de passe par syllables (alternance consonnes/voyelles)
 * Port de generators.js - generateSyllables()
 */
class SyllablesGenerator : PasswordGenerator {

    override suspend fun generate(settings: Settings): String {
        val charSets = CharacterSets.getCharSets(settings.policy)
        val length = settings.syllablesLength
        val result = StringBuilder()

        var useConsonant = true // Commence par une consonne

        repeat(length) {
            val char = if (useConsonant) {
                charSets.consonants.random()
            } else {
                charSets.vowels.random()
            }

            // Appliquer la casse (alternance majuscule/minuscule de façon aléatoire)
            val finalChar = if (Random.nextBoolean()) {
                char.uppercaseChar()
            } else {
                char
            }

            result.append(finalChar)
            useConsonant = !useConsonant
        }

        return result.toString()
    }

    /**
     * Génère une syllabe (consonne + voyelle)
     */
    private fun generateSyllable(
        consonants: List<Char>,
        vowels: List<Char>
    ): String {
        val consonant = consonants.random()
        val vowel = vowels.random()
        return "$consonant$vowel"
    }
}
