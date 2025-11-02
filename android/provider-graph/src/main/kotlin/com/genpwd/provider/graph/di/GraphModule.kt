package com.genpwd.provider.graph.di

import com.genpwd.provider.graph.GraphAuthProvider
import com.genpwd.provider.graph.GraphCloudProvider
import com.genpwd.provider.graph.ThrowingGraphAuthProvider
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

    @Binds
    abstract fun bindGraphAuthProvider(impl: ThrowingGraphAuthProvider): GraphAuthProvider
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
