package com.genpwd.provider.dropbox.di

import com.genpwd.provider.dropbox.DropboxAuthProvider
import com.genpwd.provider.dropbox.DropboxCloudProvider
import com.genpwd.provider.dropbox.ThrowingDropboxAuthProvider
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
abstract class DropboxBindModule {
    @Binds
    @IntoSet
    abstract fun bindDropboxProvider(provider: DropboxCloudProvider): CloudProvider

    @Binds
    abstract fun bindDropboxAuthProvider(impl: ThrowingDropboxAuthProvider): DropboxAuthProvider
}

@Module
@InstallIn(SingletonComponent::class)
object DropboxNetworkModule {
    @Provides
    @Singleton
    @Named("dropbox")
    fun provideDropboxClient(): OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()
}
