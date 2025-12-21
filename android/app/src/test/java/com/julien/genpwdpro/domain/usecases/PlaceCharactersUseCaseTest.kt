package com.julien.genpwdpro.domain.usecases

import com.julien.genpwdpro.data.models.Placement
import com.julien.genpwdpro.data.models.Settings
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests pour PlaceCharactersUseCase
 */
class PlaceCharactersUseCaseTest {

    private lateinit var useCase: PlaceCharactersUseCase

    @Before
    fun setup() {
        useCase = PlaceCharactersUseCase()
    }

    @Test
    fun `invoke with no digits and no specials returns original password`() {
        val password = "testpassword"
        val settings = Settings(
            digitsCount = 0,
            specialsCount = 0
        )

        val result = useCase(password, settings)

        assertEquals(password, result)
    }

    @Test
    fun `invoke with START placement adds characters at beginning`() {
        val password = "password"
        val settings = Settings(
            digitsCount = 2,
            specialsCount = 1,
            digitsPlacement = Placement.START,
            specialsPlacement = Placement.START
        )

        val result = useCase(password, settings)

        // Vérifie que la longueur a augmenté
        assertEquals(password.length + 3, result.length)
        // Vérifie que le password original est à la fin
        assertTrue(result.endsWith(password))
    }

    @Test
    fun `invoke with END placement adds characters at end`() {
        val password = "password"
        val settings = Settings(
            digitsCount = 2,
            specialsCount = 1,
            digitsPlacement = Placement.END,
            specialsPlacement = Placement.END
        )

        val result = useCase(password, settings)

        // Vérifie que la longueur a augmenté
        assertEquals(password.length + 3, result.length)
        // Vérifie que le password original est au début
        assertTrue(result.startsWith(password))
    }

    @Test
    fun `invoke with MIDDLE placement inserts characters in middle`() {
        val password = "password"
        val settings = Settings(
            digitsCount = 2,
            specialsCount = 0,
            digitsPlacement = Placement.MIDDLE,
            specialsPlacement = Placement.MIDDLE
        )

        val result = useCase(password, settings)

        // Vérifie que la longueur a augmenté
        assertEquals(password.length + 2, result.length)
        // Vérifie que ni début ni fin ne correspondent exactement
        assertFalse(result.startsWith(password))
        assertFalse(result.endsWith(password))
    }

    @Test
    fun `invoke with RANDOM placement distributes characters randomly`() {
        val password = "password"
        val settings = Settings(
            digitsCount = 3,
            specialsCount = 2,
            digitsPlacement = Placement.RANDOM,
            specialsPlacement = Placement.RANDOM
        )

        val result = useCase(password, settings)

        // Vérifie que la longueur a augmenté
        assertEquals(password.length + 5, result.length)

        // Exécuter plusieurs fois pour vérifier le caractère aléatoire
        val results = (1..10).map { useCase(password, settings) }
        val uniqueResults = results.toSet()

        // Au moins quelques résultats différents attendus (pas toujours identiques)
        assertTrue(uniqueResults.size >= 2)
    }

    @Test
    fun `invoke with digits only adds correct count of digits`() {
        val password = "abcdef"
        val settings = Settings(
            digitsCount = 4,
            specialsCount = 0,
            digitsPlacement = Placement.END
        )

        val result = useCase(password, settings)

        // Vérifie la longueur
        assertEquals(password.length + 4, result.length)

        // Compte les chiffres dans le résultat
        val digitCount = result.count { it.isDigit() }
        assertEquals(4, digitCount)
    }

    @Test
    fun `invoke with specials only adds special characters`() {
        val password = "abcdef"
        val settings = Settings(
            digitsCount = 0,
            specialsCount = 3,
            specialsPlacement = Placement.END
        )

        val result = useCase(password, settings)

        // Vérifie la longueur
        assertEquals(password.length + 3, result.length)

        // Vérifie que password original est présent
        assertTrue(result.contains(password))
    }

    @Test
    fun `invoke with mixed placements works correctly`() {
        val password = "test"
        val settings = Settings(
            digitsCount = 2,
            specialsCount = 2,
            digitsPlacement = Placement.START,
            specialsPlacement = Placement.END
        )

        val result = useCase(password, settings)

        // Vérifie la longueur totale
        assertEquals(password.length + 4, result.length)
    }

    @Test
    fun `invoke preserves password content`() {
        val password = "MyPassword123"
        val settings = Settings(
            digitsCount = 2,
            specialsCount = 2,
            digitsPlacement = Placement.RANDOM,
            specialsPlacement = Placement.RANDOM
        )

        val result = useCase(password, settings)

        // Vérifie que tous les caractères originaux sont présents
        password.forEach { char ->
            assertTrue("Missing character: $char", result.contains(char))
        }
    }

    @Test
    fun `invoke with large counts works correctly`() {
        val password = "test"
        val settings = Settings(
            digitsCount = 10,
            specialsCount = 10,
            digitsPlacement = Placement.END,
            specialsPlacement = Placement.END
        )

        val result = useCase(password, settings)

        assertEquals(password.length + 20, result.length)
    }

    @Test
    fun `invoke with empty password handles correctly`() {
        val password = ""
        val settings = Settings(
            digitsCount = 3,
            specialsCount = 2,
            digitsPlacement = Placement.END,
            specialsPlacement = Placement.END
        )

        val result = useCase(password, settings)

        assertEquals(5, result.length)
    }
}
