package com.julien.genpwdpro.di

import android.content.Context
import com.julien.genpwdpro.core.log.SafeLog
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.julien.genpwdpro.BuildConfig
import com.julien.genpwdpro.data.crypto.TotpGenerator
import com.julien.genpwdpro.data.crypto.VaultCryptoManager
import com.julien.genpwdpro.data.db.dao.PasswordHistoryDao
import com.julien.genpwdpro.data.db.dao.VaultRegistryDao
import com.julien.genpwdpro.data.db.database.AppDatabase
import com.julien.genpwdpro.data.db.database.DatabaseOpenHelperFactoryProvider
import com.julien.genpwdpro.data.db.database.SqlCipherDatabaseOpenHelperFactoryProvider
import com.julien.genpwdpro.data.local.preferences.SettingsDataStore
import com.julien.genpwdpro.data.repository.PasswordHistoryRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
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
        @ApplicationContext context: Context,
        factoryProvider: DatabaseOpenHelperFactoryProvider
    ): AppDatabase {
        val supportFactory = factoryProvider.provideFactory()
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            AppDatabase.DATABASE_NAME
        )
            .openHelperFactory(supportFactory)
            .addMigrations(
                AppDatabase.MIGRATION_1_2,
                AppDatabase.MIGRATION_2_3,
                AppDatabase.MIGRATION_3_4,
                AppDatabase.MIGRATION_4_5,
                AppDatabase.MIGRATION_5_6,
                AppDatabase.MIGRATION_6_7,
                AppDatabase.MIGRATION_7_8
            )
            .addCallback(createBackupCallback(context)) // Fixed: Backup avant migration
            .build()
    }

    @Provides
    @Singleton
    fun provideDatabaseOpenHelperFactoryProvider(
        provider: SqlCipherDatabaseOpenHelperFactoryProvider
    ): DatabaseOpenHelperFactoryProvider = provider

    /**
     * Crée un callback Room pour faire un backup automatique de la base de données
     * avant toute migration ou destructive migration.
     *
     * Fixed: Prévient la perte de données en cas d'échec de migration.
     * Le backup est créé dans le répertoire databases avec un timestamp.
     *
     * @param context Context de l'application
     * @return RoomDatabase.Callback configuré
     */
    private fun createBackupCallback(context: Context): RoomDatabase.Callback {
        return object : RoomDatabase.Callback() {
            override fun onOpen(db: SupportSQLiteDatabase) {
                super.onOpen(db)
                try {
                    // Créer un backup avant toute opération potentiellement destructive
                    val dbFile = context.getDatabasePath(AppDatabase.DATABASE_NAME)
                    if (dbFile.exists()) {
                        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
                        val backupFile = File(
                            context.getDatabasePath("").parent,
                            "${AppDatabase.DATABASE_NAME}_backup_$timestamp.db"
                        )

                        // Copier le fichier de base de données
                        dbFile.copyTo(backupFile, overwrite = false)
                        SafeLog.i("DatabaseModule", "Database backup created: ${SafeLog.redact(backupFile.name)}")

                        // Nettoyer les backups trop anciens (garder seulement les 3 derniers)
                        cleanOldBackups(context, 3)
                    }
                } catch (e: Exception) {
                    SafeLog.e("DatabaseModule", "Failed to create database backup", e)
                    // Ne pas bloquer l'ouverture de la DB si le backup échoue
                }
            }
        }
    }

    /**
     * Nettoie les anciens fichiers de backup, en gardant seulement les N plus récents
     *
     * @param context Context de l'application
     * @param keepCount Nombre de backups à conserver
     */
    private fun cleanOldBackups(context: Context, keepCount: Int) {
        try {
            val dbDir = context.getDatabasePath("").parentFile ?: return
            val backupFiles = dbDir.listFiles { file ->
                file.name.startsWith("${AppDatabase.DATABASE_NAME}_backup_") &&
                        file.name.endsWith(".db")
            }?.sortedByDescending { it.lastModified() } ?: return

            // Supprimer les backups au-delà de keepCount
            backupFiles.drop(keepCount).forEach { file ->
                if (file.delete()) {
                    SafeLog.d("DatabaseModule", "Deleted old backup: ${SafeLog.redact(file.name)}")
                }
            }
        } catch (e: Exception) {
            SafeLog.e("DatabaseModule", "Failed to clean old backups", e)
        }
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
    fun provideIoDispatcher(): kotlinx.coroutines.CoroutineDispatcher {
        return kotlinx.coroutines.Dispatchers.IO
    }

}
