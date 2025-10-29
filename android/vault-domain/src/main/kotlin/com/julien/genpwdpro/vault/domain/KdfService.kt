package com.julien.genpwdpro.vault.domain

/**
 * Derives strong encryption keys from a password using a key derivation function (KDF).
 */
interface KdfService {
    fun deriveKey(password: CharArray, params: KdfParams): ByteArray
}
