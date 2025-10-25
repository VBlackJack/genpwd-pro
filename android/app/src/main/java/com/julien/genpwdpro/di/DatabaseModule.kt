package com.julien.genpwdpro.di

import android.content.Context
import androidx.room.Room
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.julien.genpwdpro.data.local.dao.PasswordHistoryDao
import com.julien.genpwdpro.data.local.database.AppDatabase
import com.julien.genpwdpro.data.local.preferences.SettingsDataStore
import com.julien.genpwdpro.data.repository.PasswordHistoryRepository
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
            .addMigrations(AppDatabase.MIGRATION_1_2)
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
}
