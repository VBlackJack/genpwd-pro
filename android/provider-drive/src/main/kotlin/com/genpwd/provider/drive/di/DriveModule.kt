package com.genpwd.provider.drive.di

import com.genpwd.provider.drive.GoogleDriveAuthProvider
import com.genpwd.provider.drive.GoogleDriveCloudProvider
import com.genpwd.provider.drive.ThrowingGoogleDriveAuthProvider
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
abstract class DriveBindModule {
    @Binds
    @IntoSet
    abstract fun bindDriveProvider(provider: GoogleDriveCloudProvider): CloudProvider

    @Binds
    abstract fun bindAuthProvider(impl: ThrowingGoogleDriveAuthProvider): GoogleDriveAuthProvider
}

@Module
@InstallIn(SingletonComponent::class)
object DriveNetworkModule {
    @Provides
    @Singleton
    @Named("drive")
    fun provideDriveClient(): OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()
}
