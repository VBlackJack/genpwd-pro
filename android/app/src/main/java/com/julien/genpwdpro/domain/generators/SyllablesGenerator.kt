package com.julien.genpwdpro.domain.generators

import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.domain.utils.CharacterSets
import com.julien.genpwdpro.domain.utils.SecureRandomProvider
import com.julien.genpwdpro.domain.utils.secureRandom

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
                charSets.consonants.secureRandom()
            } else {
                charSets.vowels.secureRandom()
            }

            // Appliquer la casse (alternance majuscule/minuscule de façon aléatoire)
            val finalChar = if (SecureRandomProvider.nextBoolean()) {
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
        val consonant = consonants.secureRandom()
        val vowel = vowels.secureRandom()
        return "$consonant$vowel"
    }
}
