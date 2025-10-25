package com.julien.genpwdpro.domain.generators

import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.domain.utils.CharacterSets

/**
 * Générateur Leet Speak (transformation de texte)
 * Port de generators.js - generateLeet()
 */
class LeetSpeakGenerator : PasswordGenerator {

    override suspend fun generate(settings: Settings): String {
        val word = settings.leetWord
        if (word.isEmpty()) {
            return "P@55W0RD" // Valeur par défaut
        }

        val result = StringBuilder()

        for (char in word) {
            val leetChar = CharacterSets.LEET_SUBSTITUTIONS[char]
            result.append(leetChar ?: char)
        }

        return result.toString()
    }
}
