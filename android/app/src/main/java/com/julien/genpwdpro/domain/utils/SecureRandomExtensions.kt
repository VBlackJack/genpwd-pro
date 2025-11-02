package com.julien.genpwdpro.domain.utils

import java.security.SecureRandom

/**
 * Provides a lazily initialised [SecureRandom] instance used across the domain layer.
 */
object SecureRandomProvider {
    private val secureRandom: SecureRandom by lazy { SecureRandom() }

    fun nextBoolean(): Boolean = secureRandom.nextBoolean()

    fun nextInt(bound: Int): Int = secureRandom.nextInt(bound)

    fun instance(): SecureRandom = secureRandom
}

/**
 * Selects a random element from the list using a cryptographically strong PRNG.
 */
fun <T> List<T>.secureRandom(random: SecureRandom = SecureRandomProvider.instance()): T {
    if (isEmpty()) {
        throw NoSuchElementException("Cannot pick a random element from an empty list")
    }
    return this[random.nextInt(size)]
}

/**
 * Returns a shuffled copy of the list using the Fisher-Yates algorithm powered by [SecureRandom].
 */
fun <T> List<T>.secureShuffled(random: SecureRandom = SecureRandomProvider.instance()): List<T> {
    val result = toMutableList()
    result.secureShuffleInPlace(random)
    return result
}

/**
 * Shuffles the list in-place using the Fisher-Yates algorithm powered by [SecureRandom].
 */
fun <T> MutableList<T>.secureShuffleInPlace(random: SecureRandom = SecureRandomProvider.instance()) {
    if (size <= 1) return
    for (i in lastIndex downTo 1) {
        val j = random.nextInt(i + 1)
        if (i != j) {
            val tmp = this[i]
            this[i] = this[j]
            this[j] = tmp
        }
    }
}
