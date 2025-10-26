package com.julien.genpwdpro.domain.usecases

import com.julien.genpwdpro.data.models.CaseBlock
import com.julien.genpwdpro.data.models.CaseMode
import com.julien.genpwdpro.data.models.Settings
import kotlin.random.Random

/**
 * Use case pour appliquer la casse aux mots de passe
 * Port de casing.js
 */
class ApplyCasingUseCase {

    operator fun invoke(password: String, settings: Settings): String {
        return when (settings.caseMode) {
            CaseMode.MIXED -> applyMixed(password)
            CaseMode.UPPER -> password.uppercase()
            CaseMode.LOWER -> password.lowercase()
            CaseMode.TITLE -> applyTitle(password)
            CaseMode.BLOCKS -> applyBlocks(password, settings.caseBlocks)
        }
    }

    /**
     * Casse mixte: aléatoire
     */
    private fun applyMixed(password: String): String {
        return password.map { char ->
            if (char.isLetter()) {
                if (Random.nextBoolean()) char.uppercaseChar() else char.lowercaseChar()
            } else {
                char
            }
        }.joinToString("")
    }

    /**
     * Title Case: première lettre majuscule de chaque mot
     */
    private fun applyTitle(password: String): String {
        val separators = listOf('-', '_', '.', ' ')
        var capitalizeNext = true

        return password.map { char ->
            when {
                char in separators -> {
                    capitalizeNext = true
                    char
                }
                char.isLetter() && capitalizeNext -> {
                    capitalizeNext = false
                    char.uppercaseChar()
                }
                else -> {
                    char.lowercaseChar()
                }
            }
        }.joinToString("")
    }

    /**
     * Blocs de casse: applique un pattern U/T/L
     */
    private fun applyBlocks(password: String, blocks: List<CaseBlock>): String {
        if (blocks.isEmpty()) return password

        // Séparer par les délimiteurs
        val separators = listOf('-', '_', '.', ' ')
        val hasSeparators = password.any { it in separators }

        return if (hasSeparators) {
            // Mode avec séparateurs (ex: passphrase)
            applyBlocksWithSeparators(password, blocks, separators)
        } else {
            // Mode sans séparateurs (ex: syllables)
            applyBlocksAsChunks(password, blocks)
        }
    }

    /**
     * Applique les blocs de casse en divisant par séparateurs (pour passphrases)
     */
    private fun applyBlocksWithSeparators(
        password: String,
        blocks: List<CaseBlock>,
        separators: List<Char>
    ): String {
        val words = password.split(*separators.map { it.toString() }.toTypedArray())
        val usedSeparators = mutableListOf<Char>()

        // Extraire les séparateurs utilisés
        for (char in password) {
            if (char in separators) {
                usedSeparators.add(char)
            }
        }

        // Appliquer les blocs
        val transformedWords = words.mapIndexed { index, word ->
            val block = blocks[index % blocks.size]
            applyBlockToWord(word, block)
        }

        // Reconstruire avec les séparateurs
        val result = StringBuilder()
        transformedWords.forEachIndexed { index, word ->
            result.append(word)
            if (index < usedSeparators.size) {
                result.append(usedSeparators[index])
            }
        }

        return result.toString()
    }

    /**
     * Applique les blocs de casse en divisant en chunks (pour syllables)
     */
    private fun applyBlocksAsChunks(password: String, blocks: List<CaseBlock>): String {
        if (password.isEmpty()) return password

        // Calculer la taille de chaque chunk
        val chunkSize = (password.length + blocks.size - 1) / blocks.size

        val result = StringBuilder()
        var position = 0

        blocks.forEachIndexed { blockIndex, block ->
            // Extraire le chunk pour ce bloc
            val endPosition = minOf(position + chunkSize, password.length)
            if (position < password.length) {
                val chunk = password.substring(position, endPosition)
                result.append(applyBlockToWord(chunk, block))
                position = endPosition
            }
        }

        return result.toString()
    }

    /**
     * Applique un bloc de casse à un mot
     */
    private fun applyBlockToWord(word: String, block: CaseBlock): String {
        return when (block) {
            CaseBlock.U -> word.uppercase()
            CaseBlock.L -> word.lowercase()
            CaseBlock.T -> {
                if (word.isEmpty()) word
                else word.first().uppercaseChar() + word.drop(1).lowercase()
            }
        }
    }
}
