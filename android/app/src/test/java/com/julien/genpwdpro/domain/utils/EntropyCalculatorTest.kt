package com.julien.genpwdpro.domain.utils

import org.junit.Assert.*
import org.junit.Test

/**
 * Tests unitaires pour le calculateur d'entropie
 */
class EntropyCalculatorTest {

    @Test
    fun `calculateSyllablesEntropy should calculate correct entropy`() {
        val password = "tarokibe" // 8 chars
        val consonantsPoolSize = 21 // Standard policy
        val vowelsPoolSize = 5

        val entropy = EntropyCalculator.calculateSyllablesEntropy(
            password = password,
            consonantsPoolSize = consonantsPoolSize,
            vowelsPoolSize = vowelsPoolSize
        )

        // Avec alternance C-V : log2(21*5*21*5*21*5*21*5) ≈ 33.7 bits
        assertTrue("Entropy should be around 33-35 bits", entropy in 33.0..35.0)
    }

    @Test
    fun `calculateSyllablesEntropy with longer password should have higher entropy`() {
        val shortPassword = "taro"
        val longPassword = "tarokibemuna"
        val consonantsPoolSize = 21
        val vowelsPoolSize = 5

        val shortEntropy = EntropyCalculator.calculateSyllablesEntropy(
            password = shortPassword,
            consonantsPoolSize = consonantsPoolSize,
            vowelsPoolSize = vowelsPoolSize
        )

        val longEntropy = EntropyCalculator.calculateSyllablesEntropy(
            password = longPassword,
            consonantsPoolSize = consonantsPoolSize,
            vowelsPoolSize = vowelsPoolSize
        )

        assertTrue(
            "Longer password should have higher entropy",
            longEntropy > shortEntropy
        )
    }

    @Test
    fun `calculateSyllablesEntropy with empty password should return zero`() {
        val entropy = EntropyCalculator.calculateSyllablesEntropy(
            password = "",
            consonantsPoolSize = 21,
            vowelsPoolSize = 5
        )

        assertEquals(0.0, entropy, 0.01)
    }

    @Test
    fun `calculatePassphraseEntropy should calculate correct entropy`() {
        val wordCount = 6
        val dictionarySize = 7776 // EFF Large wordlist

        val entropy = EntropyCalculator.calculatePassphraseEntropy(
            wordCount = wordCount,
            dictionarySize = dictionarySize
        )

        // log2(7776^6) = 6 * log2(7776) ≈ 6 * 12.925 ≈ 77.55 bits
        assertTrue("Entropy should be around 77-78 bits", entropy in 77.0..78.0)
    }

    @Test
    fun `calculatePassphraseEntropy with more words should increase entropy`() {
        val dictionarySize = 7776

        val entropy4 = EntropyCalculator.calculatePassphraseEntropy(4, dictionarySize)
        val entropy6 = EntropyCalculator.calculatePassphraseEntropy(6, dictionarySize)
        val entropy8 = EntropyCalculator.calculatePassphraseEntropy(8, dictionarySize)

        assertTrue(
            "More words should increase entropy",
            entropy4 < entropy6 && entropy6 < entropy8
        )
    }

    @Test
    fun `calculatePassphraseEntropy with zero words should return zero`() {
        val entropy = EntropyCalculator.calculatePassphraseEntropy(
            wordCount = 0,
            dictionarySize = 7776
        )

        assertEquals(0.0, entropy, 0.01)
    }

    @Test
    fun `calculateLeetSpeakEntropy should calculate correct entropy`() {
        val password = "P@ssw0rd!23" // 11 chars
        val estimatedPoolSize = 72 // Lettres + chiffres + quelques spéciaux

        val entropy = EntropyCalculator.calculateLeetSpeakEntropy(
            password = password,
            estimatedPoolSize = estimatedPoolSize
        )

        // log2(72^11) ≈ 11 * 6.17 ≈ 67.8 bits
        assertTrue("Entropy should be around 67-69 bits", entropy in 67.0..69.0)
    }

    @Test
    fun `calculateLeetSpeakEntropy with longer password should have higher entropy`() {
        val estimatedPoolSize = 72

        val shortEntropy = EntropyCalculator.calculateLeetSpeakEntropy(
            password = "P@ss",
            estimatedPoolSize = estimatedPoolSize
        )

        val longEntropy = EntropyCalculator.calculateLeetSpeakEntropy(
            password = "P@ssw0rd!234567",
            estimatedPoolSize = estimatedPoolSize
        )

        assertTrue(
            "Longer password should have higher entropy",
            longEntropy > shortEntropy
        )
    }

    @Test
    fun `calculateLeetSpeakEntropy with empty password should return zero`() {
        val entropy = EntropyCalculator.calculateLeetSpeakEntropy(
            password = "",
            estimatedPoolSize = 72
        )

        assertEquals(0.0, entropy, 0.01)
    }

    @Test
    fun `calculateBruteForceEntropy should handle lowercase only`() {
        val password = "abcdef"

        val entropy = EntropyCalculator.calculateBruteForceEntropy(password)

        // 26^6 ≈ 28.2 bits
        assertTrue("Entropy should be around 28 bits", entropy in 28.0..29.0)
    }

    @Test
    fun `calculateBruteForceEntropy should handle mixed case`() {
        val password = "AbCdEf"

        val entropy = EntropyCalculator.calculateBruteForceEntropy(password)

        // 52^6 ≈ 33.9 bits
        assertTrue("Entropy should be around 33-35 bits", entropy in 33.0..35.0)
    }

    @Test
    fun `calculateBruteForceEntropy should handle alphanumeric`() {
        val password = "abc123"

        val entropy = EntropyCalculator.calculateBruteForceEntropy(password)

        // 36^6 ≈ 31.0 bits
        assertTrue("Entropy should be around 31-32 bits", entropy in 31.0..32.0)
    }

    @Test
    fun `calculateBruteForceEntropy should handle special characters`() {
        val password = "ab@!12"

        val entropy = EntropyCalculator.calculateBruteForceEntropy(password)

        // Pool de caractères étendu, entropie plus élevée
        assertTrue("Entropy should be at least 35 bits", entropy >= 35.0)
    }

    @Test
    fun `calculateBruteForceEntropy with empty password should return zero`() {
        val entropy = EntropyCalculator.calculateBruteForceEntropy("")

        assertEquals(0.0, entropy, 0.01)
    }

    @Test
    fun `estimateCharacterPoolSize should detect lowercase only`() {
        val poolSize = EntropyCalculator.estimateCharacterPoolSize("abcdefghij")

        assertEquals(26, poolSize)
    }

    @Test
    fun `estimateCharacterPoolSize should detect mixed case`() {
        val poolSize = EntropyCalculator.estimateCharacterPoolSize("AbCdEf")

        assertEquals(52, poolSize)
    }

    @Test
    fun `estimateCharacterPoolSize should detect alphanumeric`() {
        val poolSize = EntropyCalculator.estimateCharacterPoolSize("abc123")

        assertEquals(36, poolSize) // 26 lowercase + 10 digits
    }

    @Test
    fun `estimateCharacterPoolSize should detect with special characters`() {
        val poolSize = EntropyCalculator.estimateCharacterPoolSize("ab@!12")

        assertTrue("Pool size should be at least 72", poolSize >= 72)
    }

    @Test
    fun `entropy should increase with password length`() {
        val passwords = listOf("abc", "abcdef", "abcdefghi", "abcdefghijkl")

        val entropies = passwords.map { EntropyCalculator.calculateBruteForceEntropy(it) }

        // Vérifier que l'entropie augmente avec la longueur
        for (i in 0 until entropies.size - 1) {
            assertTrue(
                "Entropy should increase with length",
                entropies[i] < entropies[i + 1]
            )
        }
    }

    @Test
    fun `high entropy should be achievable`() {
        // Un mot de passe fort de 20 caractères devrait avoir > 100 bits
        val strongPassword = "Tr0ub4dor&3PasSw0rd!"

        val entropy = EntropyCalculator.calculateBruteForceEntropy(strongPassword)

        assertTrue(
            "Strong password should have > 100 bits entropy",
            entropy > 100.0
        )
    }

    @Test
    fun `entropy calculation should be consistent`() {
        val password = "TestPassword123!"

        val entropy1 = EntropyCalculator.calculateBruteForceEntropy(password)
        val entropy2 = EntropyCalculator.calculateBruteForceEntropy(password)

        assertEquals("Entropy should be consistent", entropy1, entropy2, 0.01)
    }
}
