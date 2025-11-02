package com.genpwd.provider.drive.di

import com.genpwd.provider.drive.GoogleDriveAuthProvider
import com.genpwd.provider.drive.GoogleDriveCloudProvider
import com.genpwd.provider.drive.OAuth2GoogleDriveAuthProvider
import com.genpwd.providers.api.CloudProvider
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.IntoSet

@Module
@InstallIn(SingletonComponent::class)
abstract class DriveModule {
    @Binds
    @IntoSet
    abstract fun bindDriveProvider(provider: GoogleDriveCloudProvider): CloudProvider

    @Binds
    abstract fun bindAuthProvider(impl: OAuth2GoogleDriveAuthProvider): GoogleDriveAuthProvider
}
