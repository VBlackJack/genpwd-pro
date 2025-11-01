package com.julien.genpwdpro.domain.generators

import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.domain.utils.DictionaryManager
import com.julien.genpwdpro.domain.utils.secureRandom

/**
 * Générateur de passphrases (mots du dictionnaire séparés)
 * Port de generators.js - generatePassphrase()
 */
class PassphraseGenerator(
    private val dictionaryManager: DictionaryManager
) : PasswordGenerator {

    override suspend fun generate(settings: Settings): String {
        val dictionary = dictionaryManager.getDictionary(settings.dictionary)
        val wordCount = settings.passphraseWordCount
        val separator = settings.passphraseSeparator

        if (dictionary.isEmpty()) {
            throw IllegalStateException("Dictionnaire vide pour ${settings.dictionary}")
        }

        val words = MutableList(wordCount) {
            dictionary.secureRandom()
        }

        return words.joinToString(separator)
    }
}
