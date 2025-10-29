package com.julien.genpwdpro.di

import android.content.Context
import androidx.room.Room
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.julien.genpwdpro.BuildConfig
import com.julien.genpwdpro.data.crypto.TotpGenerator
import com.julien.genpwdpro.data.crypto.VaultCryptoManager
import com.julien.genpwdpro.data.db.dao.*
import com.julien.genpwdpro.data.db.database.AppDatabase
import com.julien.genpwdpro.data.db.database.DatabaseOpenHelperFactoryProvider
import com.julien.genpwdpro.data.db.database.SqlCipherDatabaseOpenHelperFactoryProvider
import com.julien.genpwdpro.data.local.preferences.SettingsDataStore
import com.julien.genpwdpro.data.repository.PasswordHistoryRepository
import com.julien.genpwdpro.data.repository.VaultRepository
import com.julien.genpwdpro.data.session.RoomSessionStore
import com.julien.genpwdpro.data.session.db.SessionDao
import com.julien.genpwdpro.data.session.db.SessionDatabase
import com.julien.genpwdpro.domain.session.SessionStore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import java.util.concurrent.TimeUnit
import javax.inject.Named
import javax.inject.Singleton

/**
 * Module Hilt pour la base de données et la persistence
 */
@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabaseOpenHelperFactoryProvider(
        sqlCipherProvider: SqlCipherDatabaseOpenHelperFactoryProvider
    ): DatabaseOpenHelperFactoryProvider = sqlCipherProvider

    @Provides
    @Singleton
    fun provideAppDatabase(
        @ApplicationContext context: Context,
        openHelperFactoryProvider: DatabaseOpenHelperFactoryProvider
    ): AppDatabase {
        val builder = Room.databaseBuilder(
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
                AppDatabase.MIGRATION_6_7,
                AppDatabase.MIGRATION_7_8
            )
            .fallbackToDestructiveMigration() // Fallback si migration échoue
            .setJournalMode(androidx.room.RoomDatabase.JournalMode.WRITE_AHEAD_LOGGING)

        builder.openHelperFactory(openHelperFactoryProvider.provideFactory())

        return builder.build()
    }

    @Provides
    @Singleton
    fun provideSessionDatabase(
        @ApplicationContext context: Context,
        openHelperFactoryProvider: DatabaseOpenHelperFactoryProvider
    ): SessionDatabase {
        val builder = Room.databaseBuilder(
            context,
            SessionDatabase::class.java,
            SessionDatabase.DATABASE_NAME
        )
            .fallbackToDestructiveMigration()
            .setJournalMode(androidx.room.RoomDatabase.JournalMode.WRITE_AHEAD_LOGGING)

        builder.openHelperFactory(openHelperFactoryProvider.provideFactory())

        return builder.build()
    }

    @Provides
    @Singleton
    fun provideSessionDao(
        database: SessionDatabase
    ): SessionDao = database.sessionDao()

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
    fun providePresetDao(
        database: AppDatabase
    ): PresetDao {
        return database.presetDao()
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
        presetDao: PresetDao,
        cryptoManager: VaultCryptoManager,
        keystoreManager: com.julien.genpwdpro.security.KeystoreManager
    ): VaultRepository {
        return VaultRepository(vaultDao, entryDao, folderDao, tagDao, presetDao, cryptoManager, keystoreManager)
    }

    @Provides
    @Singleton
    fun provideSessionStore(
        sessionDao: SessionDao,
        ioDispatcher: kotlinx.coroutines.CoroutineDispatcher,
        @Named("session_cleanup_interval_ms") cleanupIntervalMillis: Long
    ): SessionStore {
        return RoomSessionStore(sessionDao, ioDispatcher, cleanupIntervalMillis)
    }

    @Provides
    @Singleton
    fun provideIoDispatcher(): kotlinx.coroutines.CoroutineDispatcher {
        return kotlinx.coroutines.Dispatchers.IO
    }

    @Provides
    @Singleton
    @Named("session_cleanup_interval_ms")
    fun provideSessionCleanupInterval(): Long =
        TimeUnit.MINUTES.toMillis(15)

    @Provides
    @Singleton
    @Named("legacy_sync_enabled")
    fun provideLegacySyncFlag(): Boolean = BuildConfig.DEBUG
}
