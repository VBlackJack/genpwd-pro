package com.julien.genpwdpro.crypto.kdf

/**
 * Contract for key-derivation services capable of deriving secret material from a password and
 * salt. Implementations should avoid leaking sensitive data and wipe intermediate buffers when
 * possible.
 */
interface KdfService {
    val algorithm: KdfAlgorithm

    /**
     * Derives a key from the provided [password] and [salt]. When [keyLength] is `null`, the
     * implementation should fallback to its configured default output length.
     */
    fun deriveKey(password: CharArray, salt: ByteArray, keyLength: Int? = null): ByteArray
}
