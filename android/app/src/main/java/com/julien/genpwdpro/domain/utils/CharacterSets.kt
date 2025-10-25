package com.julien.genpwdpro.domain.utils

import com.julien.genpwdpro.data.models.CharPolicy

/**
 * Ensembles de caractères pour la génération de mots de passe
 * Port direct de constants.js
 */
object CharacterSets {

    // Chiffres
    val DIGITS = listOf('0', '1', '2', '3', '4', '5', '6', '7', '8', '9')

    // Substitutions Leet Speak
    val LEET_SUBSTITUTIONS = mapOf(
        'a' to '@', 'A' to '@',
        'e' to '3', 'E' to '3',
        'i' to '1', 'I' to '1',
        'o' to '0', 'O' to '0',
        's' to '5', 'S' to '5',
        't' to '7', 'T' to '7',
        'l' to '!', 'L' to '!',
        'g' to '9', 'G' to '9',
        'b' to '8', 'B' to '8'
    )

    /**
     * Politique Standard: tous caractères
     */
    private val standardConsonants = listOf(
        'b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm',
        'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'z'
    )
    private val standardVowels = listOf('a', 'e', 'i', 'o', 'u', 'y')
    private val standardSpecials = listOf(
        '!', '#', '%', '+', ',', '-', '.', '/', ':', '=', '@', '_'
    )

    /**
     * Politique Standard Layout-Safe: compatible AZERTY/QWERTY
     * Exclut: a, m, q, w (différences de layout)
     */
    private val standardLayoutConsonants = listOf(
        'b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'n',
        'p', 'r', 's', 't', 'v', 'x'
    )
    private val standardLayoutVowels = listOf('e', 'i', 'o', 'u', 'y')

    /**
     * Politique Alphanumérique: lettres + chiffres uniquement
     */
    private val alphanumericSpecials = emptyList<Char>()

    /**
     * Politique Alphanumérique Layout-Safe
     */
    private val alphanumericLayoutConsonants = standardLayoutConsonants
    private val alphanumericLayoutVowels = standardLayoutVowels

    /**
     * Retourne les ensembles de caractères pour une politique donnée
     */
    fun getCharSets(policy: CharPolicy): CharSets {
        return when (policy) {
            CharPolicy.STANDARD -> CharSets(
                consonants = standardConsonants,
                vowels = standardVowels,
                specials = standardSpecials
            )
            CharPolicy.STANDARD_LAYOUT -> CharSets(
                consonants = standardLayoutConsonants,
                vowels = standardLayoutVowels,
                specials = standardSpecials
            )
            CharPolicy.ALPHANUMERIC -> CharSets(
                consonants = standardConsonants,
                vowels = standardVowels,
                specials = alphanumericSpecials
            )
            CharPolicy.ALPHANUMERIC_LAYOUT -> CharSets(
                consonants = alphanumericLayoutConsonants,
                vowels = alphanumericLayoutVowels,
                specials = alphanumericSpecials
            )
        }
    }

    /**
     * Classe contenant les ensembles de caractères
     */
    data class CharSets(
        val consonants: List<Char>,
        val vowels: List<Char>,
        val specials: List<Char>
    ) {
        val allLetters: List<Char> = consonants + vowels
        val allChars: List<Char> = consonants + vowels + specials + DIGITS
    }
}
