package com.genpwd.provider.graph.di

import com.genpwd.provider.graph.GraphAuthProvider
import com.genpwd.provider.graph.GraphCloudProvider
import com.genpwd.provider.graph.GraphConfig
import com.genpwd.provider.graph.OAuth2GraphAuthProvider
import com.genpwd.providers.api.CloudProvider
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.IntoSet
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit
import javax.inject.Singleton
import javax.inject.Named

@Module
@InstallIn(SingletonComponent::class)
abstract class GraphBindModule {
    @Binds
    @IntoSet
    abstract fun bindGraphProvider(provider: GraphCloudProvider): CloudProvider

    /**
     * Binds the OAuth2 implementation of GraphAuthProvider.
     *
     * Note: OAuth2GraphAuthProvider requires proper configuration:
     * 1. Set CLIENT_ID in OAuth2GraphAuthProvider (or via BuildConfig)
     * 2. Register redirect URI in Azure AD: com.julien.genpwdpro:/oauth2callback
     * 3. Add Files.ReadWrite and offline_access scopes
     *
     * For development/testing without Azure registration, bind ThrowingGraphAuthProvider instead.
     */
    @Binds
    abstract fun bindGraphAuthProvider(impl: OAuth2GraphAuthProvider): GraphAuthProvider
}

@Module
@InstallIn(SingletonComponent::class)
object GraphNetworkModule {
    @Provides
    @Singleton
    @Named("graph")
    fun provideGraphClient(): OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()
}
