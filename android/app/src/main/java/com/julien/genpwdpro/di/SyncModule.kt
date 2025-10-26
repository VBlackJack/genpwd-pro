package com.julien.genpwdpro.di

import com.julien.genpwdpro.data.sync.CloudProviderSyncRepository
import com.julien.genpwdpro.data.sync.CloudSyncRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Module Hilt pour l'injection de dépendances de la synchronisation cloud
 *
 * Configure:
 * - CloudSyncRepository → CloudProviderSyncRepository
 * - Tous les singletons sont automatiquement injectés par Hilt
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class SyncModule {

    /**
     * Fournit l'implémentation de CloudSyncRepository
     *
     * CloudProviderSyncRepository sera injecté automatiquement avec:
     * - Context
     * - CloudProviderFactory
     * - ProviderCredentialManager
     */
    @Binds
    @Singleton
    abstract fun bindCloudSyncRepository(
        impl: CloudProviderSyncRepository
    ): CloudSyncRepository
}
