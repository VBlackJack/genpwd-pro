package com.genpwd.storage.db

import androidx.room.TypeConverter
import com.genpwd.corevault.ProviderKind

/**
 * Room type converters for custom types.
 */
class Converters {
    @TypeConverter
    fun fromProviderKind(value: ProviderKind): String {
        return value.name
    }

    @TypeConverter
    fun toProviderKind(value: String): ProviderKind {
        return try {
            ProviderKind.valueOf(value)
        } catch (e: IllegalArgumentException) {
            // Default to GOOGLE_DRIVE if unknown provider
            ProviderKind.GOOGLE_DRIVE
        }
    }
}
