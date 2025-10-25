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
        val validatedSettings = copy(
            quantity = quantity.coerceIn(MIN_QUANTITY, MAX_QUANTITY),
            digitsCount = digitsCount.coerceIn(MIN_DIGITS, MAX_DIGITS),
            specialsCount = specialsCount.coerceIn(MIN_SPECIALS, MAX_SPECIALS),
            digitsPosition = digitsPosition.coerceIn(0, 100),
            specialsPosition = specialsPosition.coerceIn(0, 100),
            syllablesLength = syllablesLength.coerceIn(MIN_SYLLABLES_LENGTH, MAX_SYLLABLES_LENGTH),
            passphraseWordCount = passphraseWordCount.coerceIn(MIN_PASSPHRASE_WORDS, MAX_PASSPHRASE_WORDS),
            caseBlocks = if (caseBlocks.isEmpty()) listOf(CaseBlock.T, CaseBlock.L) else caseBlocks
        )

        // Auto-ajuster les blocs si mode BLOCKS activé
        return if (validatedSettings.caseMode == CaseMode.BLOCKS) {
            validatedSettings.copy(caseBlocks = validatedSettings.calculateRequiredBlocks())
        } else {
            validatedSettings
        }
    }

    /**
     * Calcule le nombre de blocs nécessaires en fonction du mode et de la longueur
     */
    private fun calculateRequiredBlocks(): List<CaseBlock> {
        val requiredBlockCount = when (mode) {
            GenerationMode.SYLLABLES -> {
                // Pour syllables: 1 bloc = 3 caractères
                (syllablesLength + 2) / 3 // Arrondi au supérieur
            }
            GenerationMode.PASSPHRASE -> {
                // Pour passphrase: 1 bloc = 1 mot
                passphraseWordCount
            }
            else -> {
                // Pour les autres modes, garder le nombre actuel de blocs
                return caseBlocks
            }
        }

        // Limiter entre 1 et 8 blocs
        val targetCount = requiredBlockCount.coerceIn(1, 8)

        // Si le nombre actuel correspond déjà, garder les blocs existants
        if (caseBlocks.size == targetCount) {
            return caseBlocks
        }

        // Sinon, ajuster la taille en gardant autant de blocs existants que possible
        return if (targetCount > caseBlocks.size) {
            // Ajouter des blocs (répéter le pattern existant)
            val pattern = if (caseBlocks.isEmpty()) listOf(CaseBlock.T, CaseBlock.L) else caseBlocks
            List(targetCount) { pattern[it % pattern.size] }
        } else {
            // Retirer des blocs (garder les premiers)
            caseBlocks.take(targetCount)
        }
    }
}
