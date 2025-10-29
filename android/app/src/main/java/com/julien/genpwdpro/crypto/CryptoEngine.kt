package com.julien.genpwdpro.crypto

/**
 * Abstraction for authenticated encryption engines capable of encrypting and decrypting
 * sensitive payloads entirely in memory.
 */
interface CryptoEngine {
    /**
     * Encrypts [plaintext] and returns the resulting ciphertext. Optional [associatedData] can
     * be provided to bind additional context to the ciphertext. The same [associatedData] must be
     * supplied when decrypting.
     */
    fun encrypt(plaintext: ByteArray, associatedData: ByteArray = EMPTY_AAD): ByteArray

    /**
     * Decrypts [ciphertext] previously produced by [encrypt]. Optional [associatedData] must match
     * the value supplied during encryption.
     */
    fun decrypt(ciphertext: ByteArray, associatedData: ByteArray = EMPTY_AAD): ByteArray

    /**
     * Rotates the primary key used for future encryptions while keeping previous keys available
     * for decryption.
     */
    fun rotate()

    /**
     * Exports the current keyset in a serialized form so it can be persisted securely.
     */
    fun exportKeyset(): String

    companion object {
        val EMPTY_AAD: ByteArray = ByteArray(0)
    }
}
