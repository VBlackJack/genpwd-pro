package com.genpwd.sync.di

import com.genpwd.corevault.VaultCryptoEngine
import com.genpwd.providers.api.CloudProvider
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.Multibinds
import okhttp3.OkHttpClient
import java.security.SecureRandom
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class SyncModule {
    @Multibinds
    abstract fun bindProvidersSet(): Set<CloudProvider>

    companion object {
        @Provides
        @Singleton
        fun provideVaultCryptoEngine(): VaultCryptoEngine =
            VaultCryptoEngine(SecureRandom())

        @Provides
        @Singleton
        fun provideOkHttpClient(): OkHttpClient =
            OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build()
    }
}
