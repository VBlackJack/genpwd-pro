package com.genpwd.provider.webdav.di

import com.genpwd.provider.webdav.ThrowingWebDavAuthProvider
import com.genpwd.provider.webdav.WebDavAuthProvider
import com.genpwd.provider.webdav.WebDavCloudProvider
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
abstract class WebDavBindModule {
    @Binds
    @IntoSet
    abstract fun bindWebDavProvider(provider: WebDavCloudProvider): CloudProvider

    @Binds
    abstract fun bindWebDavAuthProvider(impl: ThrowingWebDavAuthProvider): WebDavAuthProvider
}

@Module
@InstallIn(SingletonComponent::class)
object WebDavNetworkModule {
    @Provides
    @Singleton
    @Named("webdav")
    fun provideWebDavClient(): OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()
}
