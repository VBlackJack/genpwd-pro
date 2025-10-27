package com.julien.genpwdpro.di

import android.content.Context
import androidx.room.Room
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.julien.genpwdpro.data.local.dao.*
import com.julien.genpwdpro.data.local.database.AppDatabase
import com.julien.genpwdpro.data.local.preferences.SettingsDataStore
import com.julien.genpwdpro.data.crypto.TotpGenerator
import com.julien.genpwdpro.data.crypto.VaultCryptoManager
import com.julien.genpwdpro.data.repository.PasswordHistoryRepository
import com.julien.genpwdpro.data.repository.VaultRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Module Hilt pour la base de données et la persistence
 */
@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideAppDatabase(
        @ApplicationContext context: Context
    ): AppDatabase {
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            AppDatabase.DATABASE_NAME
        )
            .addMigrations(
                AppDatabase.MIGRATION_1_2,
                AppDatabase.MIGRATION_2_3,
                AppDatabase.MIGRATION_3_4,
                AppDatabase.MIGRATION_4_5,
                AppDatabase.MIGRATION_5_6,
                AppDatabase.MIGRATION_6_7
            )
            .fallbackToDestructiveMigration() // Fallback si migration échoue
            .build()
    }

    @Provides
    @Singleton
    fun providePasswordHistoryDao(
        database: AppDatabase
    ): PasswordHistoryDao {
        return database.passwordHistoryDao()
    }

    @Provides
    @Singleton
    fun provideGson(): Gson {
        return GsonBuilder()
            .setPrettyPrinting()
            .create()
    }

    @Provides
    @Singleton
    fun provideSettingsDataStore(
        @ApplicationContext context: Context
    ): SettingsDataStore {
        return SettingsDataStore(context)
    }

    @Provides
    @Singleton
    fun providePasswordHistoryRepository(
        dao: PasswordHistoryDao,
        gson: Gson
    ): PasswordHistoryRepository {
        return PasswordHistoryRepository(dao, gson)
    }

    @Provides
    @Singleton
    fun provideVaultDao(
        database: AppDatabase
    ): VaultDao {
        return database.vaultDao()
    }

    @Provides
    @Singleton
    fun provideVaultEntryDao(
        database: AppDatabase
    ): VaultEntryDao {
        return database.vaultEntryDao()
    }

    @Provides
    @Singleton
    fun provideFolderDao(
        database: AppDatabase
    ): FolderDao {
        return database.folderDao()
    }

    @Provides
    @Singleton
    fun provideTagDao(
        database: AppDatabase
    ): TagDao {
        return database.tagDao()
    }

    @Provides
    @Singleton
    fun provideVaultRegistryDao(
        database: AppDatabase
    ): VaultRegistryDao {
        return database.vaultRegistryDao()
    }

    @Provides
    @Singleton
    fun provideVaultCryptoManager(): VaultCryptoManager {
        return VaultCryptoManager()
    }

    @Provides
    @Singleton
    fun provideTotpGenerator(): TotpGenerator {
        return TotpGenerator()
    }

    @Provides
    @Singleton
    fun provideVaultRepository(
        vaultDao: VaultDao,
        entryDao: VaultEntryDao,
        folderDao: FolderDao,
        tagDao: TagDao,
        cryptoManager: VaultCryptoManager,
        keystoreManager: com.julien.genpwdpro.security.KeystoreManager
    ): VaultRepository {
        return VaultRepository(vaultDao, entryDao, folderDao, tagDao, cryptoManager, keystoreManager)
    }
}
