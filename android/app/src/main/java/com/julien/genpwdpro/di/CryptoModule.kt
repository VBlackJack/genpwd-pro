package com.julien.genpwdpro.di

import android.content.Context
import com.julien.genpwdpro.crypto.CryptoEngine
import com.julien.genpwdpro.crypto.TinkAesGcmCryptoEngine
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Module Hilt pour l'injection des composants cryptographiques
 */
@Module
@InstallIn(SingletonComponent::class)
object CryptoModule {

    private const val ATTACHMENTS_KEYSET_NAME = "genpwdpro_attachments_keyset"
    private const val ATTACHMENTS_PREFS_FILE = "genpwdpro_attachments_crypto_prefs"

    /**
     * Fournit un CryptoEngine dédié aux pièces jointes.
     *
     * Utilise Tink avec un keyset séparé stocké dans Android Keystore.
     * Ce keyset est distinct de celui utilisé pour les vaults.
     */
    @Provides
    @Singleton
    fun provideCryptoEngine(
        @ApplicationContext context: Context
    ): CryptoEngine {
        return TinkAesGcmCryptoEngine.getOrCreate(
            context = context,
            keysetName = ATTACHMENTS_KEYSET_NAME,
            prefFileName = ATTACHMENTS_PREFS_FILE
        )
    }
}
