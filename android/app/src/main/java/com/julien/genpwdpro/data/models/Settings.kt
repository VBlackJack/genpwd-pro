package com.julien.genpwdpro.data.models

/**
 * Configuration de génération de mots de passe
 * Contient tous les paramètres nécessaires pour générer des mots de passe
 */
data class Settings(
    // Mode de génération
    val mode: GenerationMode = GenerationMode.SYLLABLES,

    // Paramètres communs
    val quantity: Int = 5,
    val maskDisplay: Boolean = true,
    val digitsCount: Int = 2,
    val specialsCount: Int = 2,
    val customSpecials: String = "_+-=.@#%",
    val digitsPlacement: Placement = Placement.RANDOM,
    val specialsPlacement: Placement = Placement.RANDOM,

    // Placement visuel (pourcentage 0-100)
    val digitsPosition: Int = 50,
    val specialsPosition: Int = 50,

    // Casse
    val caseMode: CaseMode = CaseMode.MIXED,
    val caseBlocks: List<CaseBlock> = listOf(CaseBlock.T, CaseBlock.L),

    // Mode Syllables
    val syllablesLength: Int = 20,
    val policy: CharPolicy = CharPolicy.STANDARD,

    // Mode Passphrase
    val passphraseWordCount: Int = 5,
    val passphraseSeparator: String = "-",
    val dictionary: DictionaryType = DictionaryType.FRENCH,

    // Mode Leet
    val leetWord: String = "password"
) {
    companion object {
        // Limites de validation
        const val MIN_QUANTITY = 1
        const val MAX_QUANTITY = 20
        const val MIN_DIGITS = 0
        const val MAX_DIGITS = 6
        const val MIN_SPECIALS = 0
        const val MAX_SPECIALS = 6
        const val MIN_SYLLABLES_LENGTH = 6
        const val MAX_SYLLABLES_LENGTH = 64
        const val MIN_PASSPHRASE_WORDS = 2
        const val MAX_PASSPHRASE_WORDS = 8
    }

    /**
     * Valide et corrige les paramètres si nécessaire
     */
    fun validate(): Settings {
        return copy(
            quantity = quantity.coerceIn(MIN_QUANTITY, MAX_QUANTITY),
            digitsCount = digitsCount.coerceIn(MIN_DIGITS, MAX_DIGITS),
            specialsCount = specialsCount.coerceIn(MIN_SPECIALS, MAX_SPECIALS),
            digitsPosition = digitsPosition.coerceIn(0, 100),
            specialsPosition = specialsPosition.coerceIn(0, 100),
            syllablesLength = syllablesLength.coerceIn(MIN_SYLLABLES_LENGTH, MAX_SYLLABLES_LENGTH),
            passphraseWordCount = passphraseWordCount.coerceIn(MIN_PASSPHRASE_WORDS, MAX_PASSPHRASE_WORDS),
            caseBlocks = if (caseBlocks.isEmpty()) listOf(CaseBlock.T, CaseBlock.L) else caseBlocks
        )
    }
}
