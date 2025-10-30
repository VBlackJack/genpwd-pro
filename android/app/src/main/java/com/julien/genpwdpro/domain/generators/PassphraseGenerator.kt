package com.julien.genpwdpro.domain.generators

import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.domain.utils.DictionaryManager

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

        val words = mutableListOf<String>()
        repeat(wordCount) {
            words.add(dictionary.random())
        }

        return words.joinToString(separator)
    }
}
