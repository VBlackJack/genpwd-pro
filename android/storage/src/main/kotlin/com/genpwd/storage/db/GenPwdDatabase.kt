package com.genpwd.storage.db

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [
        ProviderAccountEntity::class,
        VaultMetaEntity::class,
        SyncStateEntity::class,
        PendingOpEntity::class,
        AuditLogEntity::class,
    ],
    version = 1,
    exportSchema = true,
)
abstract class GenPwdDatabase : RoomDatabase() {
    abstract fun providerAccountDao(): ProviderAccountDao
    abstract fun vaultMetaDao(): VaultMetaDao
    abstract fun syncStateDao(): SyncStateDao
    abstract fun pendingOpDao(): PendingOpDao
    abstract fun auditLogDao(): AuditLogDao
}
