package com.julien.genpwdpro.crypto.kdf

import com.julien.genpwdpro.BuildConfig

/**
 * Enumerates supported key-derivation functions. Argon2id is reserved so the enum can be expanded
 * without touching persisted configuration once its implementation is ready.
 */
enum class KdfAlgorithm {
    SCRYPT,
    ARGON2ID // TODO: Wire an Argon2id-based implementation once libsodium bindings are available.
}

private fun resolveDefaultAlgorithm(): KdfAlgorithm {
    return runCatching {
        KdfAlgorithm.valueOf(BuildConfig.DEFAULT_KDF_ALGORITHM.uppercase())
    }.getOrDefault(KdfAlgorithm.SCRYPT)
}

/**
 * Application level configuration controlling the selected key-derivation algorithm and its
 * tunable parameters.
 */
data class KdfConfig(
    val algorithm: KdfAlgorithm = resolveDefaultAlgorithm(),
    val scrypt: ScryptConfig = ScryptConfig()
)

/**
 * Parameters used by the scrypt key-derivation function. Defaults are provided through
 * [BuildConfig] so they can be adjusted per build variant.
 */
data class ScryptConfig(
    val cost: Int = BuildConfig.SCRYPT_COST,
    val blockSize: Int = BuildConfig.SCRYPT_BLOCK_SIZE,
    val parallelization: Int = BuildConfig.SCRYPT_PARALLELIZATION,
    val keyLength: Int = BuildConfig.SCRYPT_KEY_LENGTH
) {
    init {
        require(cost > 1 && cost and (cost - 1) == 0) {
            "Scrypt cost factor must be a power of two greater than 1"
        }
        require(blockSize > 0) { "Scrypt block size must be positive" }
        require(parallelization > 0) { "Scrypt parallelization factor must be positive" }
        require(keyLength > 0) { "Desired key length must be positive" }
    }
}

/**
 * Factory responsible for creating [KdfService] instances based on the provided [KdfConfig].
 */
class KdfServiceFactory(
    private val config: KdfConfig = KdfConfig()
) {
    fun create(): KdfService = when (config.algorithm) {
        KdfAlgorithm.SCRYPT -> ScryptKdfService(config.scrypt)
        KdfAlgorithm.ARGON2ID -> throw UnsupportedOperationException(
            "Argon2id is not wired yet. TODO: add Argon2id-backed KdfService."
        )
    }
}
