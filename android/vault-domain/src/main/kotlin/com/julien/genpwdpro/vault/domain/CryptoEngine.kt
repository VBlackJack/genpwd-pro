package com.julien.genpwdpro.vault.domain

/**
 * Provides basic cryptographic operations for the vault domain.
 */
interface CryptoEngine {
    fun encrypt(plainText: ByteArray, key: ByteArray): ByteArray
    fun decrypt(cipherText: ByteArray, key: ByteArray): ByteArray
}
