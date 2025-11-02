package com.julien.genpwdpro.data.session.db.converters

import androidx.room.TypeConverter
import org.json.JSONObject

/**
 * Converts attribute maps to a JSON string representation for Room persistence.
 */
class SessionAttributesConverter {

    @TypeConverter
    fun fromMap(value: Map<String, String>?): String? {
        if (value.isNullOrEmpty()) {
            return null
        }
        val jsonObject = JSONObject()
        value.forEach { (key, entryValue) ->
            jsonObject.put(key, entryValue)
        }
        return jsonObject.toString()
    }

    @TypeConverter
    fun toMap(value: String?): Map<String, String> {
        if (value.isNullOrBlank()) {
            return emptyMap()
        }
        val jsonObject = JSONObject(value)
        val result = mutableMapOf<String, String>()
        val keys = jsonObject.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            result[key] = jsonObject.getString(key)
        }
        return result
    }
}
