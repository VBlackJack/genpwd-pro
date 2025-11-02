package com.julien.genpwdpro.crypto.kdf

import com.julien.genpwdpro.core.crypto.SecretUtils
import com.lambdaworks.crypto.SCrypt
import kotlin.text.Charsets

/**
 * [KdfService] implementation backed by the scrypt key-derivation function.
 */
class ScryptKdfService(
    private val config: ScryptConfig = ScryptConfig()
) : KdfService {

    override val algorithm: KdfAlgorithm = KdfAlgorithm.SCRYPT

    override fun deriveKey(password: CharArray, salt: ByteArray, keyLength: Int?): ByteArray {
        require(salt.isNotEmpty()) { "Salt must not be empty" }

        val effectiveKeyLength = keyLength ?: config.keyLength
        val passwordBytes = password.concatToString().toByteArray(Charsets.UTF_8)

        return try {
            SCrypt.scrypt(
                passwordBytes,
                salt,
                config.cost,
                config.blockSize,
                config.parallelization,
                effectiveKeyLength
            )
        } finally {
            SecretUtils.wipe(passwordBytes)
        }
    }
}
