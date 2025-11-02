package com.genpwd.storage.di

import android.content.Context
import androidx.room.Room
import com.genpwd.storage.db.GenPwdDatabase
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object StorageModule {
    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): GenPwdDatabase =
        Room.databaseBuilder(context, GenPwdDatabase::class.java, "genpwd.db")
            .fallbackToDestructiveMigration()
            .build()
}
