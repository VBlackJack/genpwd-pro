package com.julien.genpwdpro.domain.usecases

import com.julien.genpwdpro.data.models.Placement
import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.domain.utils.CharacterSets
import kotlin.random.Random

/**
 * Use case pour placer les chiffres et caractères spéciaux
 * Port de placement.js
 */
class PlaceCharactersUseCase {

    operator fun invoke(password: String, settings: Settings): String {
        var result = password

        // Placer les chiffres
        if (settings.digitsCount > 0) {
            val digits = generateDigits(settings.digitsCount)
            result = placeCharacters(
                password = result,
                characters = digits,
                placement = settings.digitsPlacement,
                positions = settings.digitsPositions
            )
        }

        // Placer les caractères spéciaux
        if (settings.specialsCount > 0) {
            val specials = generateSpecials(settings.specialsCount, settings.customSpecials)
            result = placeCharacters(
                password = result,
                characters = specials,
                placement = settings.specialsPlacement,
                positions = settings.specialsPositions
            )
        }

        return result
    }

    /**
     * Génère des chiffres aléatoires
     */
    private fun generateDigits(count: Int): String {
        return (1..count).map {
            CharacterSets.DIGITS.random()
        }.joinToString("")
    }

    /**
     * Génère des caractères spéciaux aléatoires
     */
    private fun generateSpecials(count: Int, customSpecials: String): String {
        val specials = if (customSpecials.isNotEmpty()) {
            customSpecials.toList()
        } else {
            listOf('_', '+', '-', '=', '.', '@', '#', '%')
        }

        return (1..count).map {
            specials.random()
        }.joinToString("")
    }

    /**
     * Place des caractères selon la stratégie choisie
     */
    private fun placeCharacters(
        password: String,
        characters: String,
        placement: Placement,
        positions: List<Int>
    ): String {
        return when (placement) {
            Placement.START -> characters + password
            Placement.END -> password + characters
            Placement.MIDDLE -> {
                val mid = password.length / 2
                password.substring(0, mid) + characters + password.substring(mid)
            }
            Placement.RANDOM -> {
                val chars = password.toMutableList()
                characters.forEach { char ->
                    val randomPos = Random.nextInt(0, chars.size + 1)
                    chars.add(randomPos, char)
                }
                chars.joinToString("")
            }
            Placement.VISUAL -> {
                // Placer chaque caractère à sa position spécifique
                val chars = password.toMutableList()

                // Créer une liste de (caractère, position) et trier par position décroissante
                // pour éviter les décalages lors de l'insertion
                val charWithPositions = characters.mapIndexed { index, char ->
                    val position = positions.getOrNull(index) ?: positions.lastOrNull() ?: 50
                    val insertPos = (password.length * position / 100).coerceIn(0, chars.size)
                    char to insertPos
                }.sortedByDescending { it.second }

                // Insérer chaque caractère à sa position
                charWithPositions.forEach { (char, pos) ->
                    chars.add(pos, char)
                }

                chars.joinToString("")
            }
        }
    }
}
