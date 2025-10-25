package com.julien.genpwdpro.domain.usecases

import com.julien.genpwdpro.data.models.GenerationMode
import com.julien.genpwdpro.data.models.PasswordResult
import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.domain.generators.LeetSpeakGenerator
import com.julien.genpwdpro.domain.generators.PassphraseGenerator
import com.julien.genpwdpro.domain.generators.SyllablesGenerator
import com.julien.genpwdpro.domain.utils.EntropyCalculator
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Use case principal pour générer des mots de passe
 * Coordonne tous les générateurs et applique les transformations
 */
class GeneratePasswordUseCase(
    private val syllablesGenerator: SyllablesGenerator,
    private val passphraseGenerator: PassphraseGenerator,
    private val leetSpeakGenerator: LeetSpeakGenerator,
    private val applyCasingUseCase: ApplyCasingUseCase,
    private val placeCharactersUseCase: PlaceCharactersUseCase
) {

    /**
     * Génère plusieurs mots de passe selon les paramètres
     */
    suspend operator fun invoke(settings: Settings): List<PasswordResult> =
        withContext(Dispatchers.Default) {
            val validSettings = settings.validate()
            val results = mutableListOf<PasswordResult>()

            repeat(validSettings.quantity) {
                val result = generateSingle(validSettings)
                results.add(result)
            }

            results
        }

    /**
     * Génère un seul mot de passe
     */
    private suspend fun generateSingle(settings: Settings): PasswordResult {
        // 1. Génération de base selon le mode
        val generator = when (settings.mode) {
            GenerationMode.SYLLABLES -> syllablesGenerator
            GenerationMode.PASSPHRASE -> passphraseGenerator
            GenerationMode.LEET -> leetSpeakGenerator
        }

        var password = generator.generate(settings)

        // 2. Application de la casse
        password = applyCasingUseCase(password, settings)

        // 3. Placement des chiffres et caractères spéciaux
        password = placeCharactersUseCase(password, settings)

        // 4. Calcul de l'entropie
        val entropy = when (settings.mode) {
            GenerationMode.SYLLABLES -> {
                val charSets = com.julien.genpwdpro.domain.utils.CharacterSets.getCharSets(settings.policy)
                EntropyCalculator.calculateSyllablesEntropy(
                    password = password,
                    consonantsPoolSize = charSets.consonants.size,
                    vowelsPoolSize = charSets.vowels.size,
                    hasDigits = settings.digitsCount > 0,
                    hasSpecials = settings.specialsCount > 0
                )
            }
            GenerationMode.PASSPHRASE -> {
                // Estimation basée sur le dictionnaire français (2400+ mots)
                EntropyCalculator.calculatePassphraseEntropy(
                    wordCount = settings.passphraseWordCount,
                    dictionarySize = 2400
                )
            }
            else -> {
                EntropyCalculator.calculateEntropy(password, settings.mode)
            }
        }

        return PasswordResult(
            password = password,
            entropy = entropy,
            mode = settings.mode,
            settings = settings,
            isMasked = settings.maskDisplay
        )
    }
}
