package com.julien.genpwdpro.data.local.database

import androidx.sqlite.db.SupportSQLiteOpenHelper
import javax.inject.Inject
import javax.inject.Singleton

interface DatabaseOpenHelperFactoryProvider {
    fun provideFactory(): SupportSQLiteOpenHelper.Factory?
}

@Singleton
class DefaultDatabaseOpenHelperFactoryProvider @Inject constructor() : DatabaseOpenHelperFactoryProvider {
    override fun provideFactory(): SupportSQLiteOpenHelper.Factory? = null
}
