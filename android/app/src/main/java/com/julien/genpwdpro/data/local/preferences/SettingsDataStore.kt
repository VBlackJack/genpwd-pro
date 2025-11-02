package com.julien.genpwdpro.data.local.preferences

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import com.julien.genpwdpro.data.models.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.io.IOException

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

/**
 * Gestion de la persistence des paramètres avec DataStore
 */
class SettingsDataStore(private val context: Context) {

    // Clés de préférences
    private object PreferencesKeys {
        val ONBOARDING_COMPLETED = booleanPreferencesKey("onboarding_completed")
        val MODE = stringPreferencesKey("mode")
        val QUANTITY = intPreferencesKey("quantity")
        val MASK_DISPLAY = booleanPreferencesKey("mask_display")
        val DIGITS_COUNT = intPreferencesKey("digits_count")
        val SPECIALS_COUNT = intPreferencesKey("specials_count")
        val CUSTOM_SPECIALS = stringPreferencesKey("custom_specials")
        val DIGITS_PLACEMENT = stringPreferencesKey("digits_placement")
        val SPECIALS_PLACEMENT = stringPreferencesKey("specials_placement")
        val DIGITS_POSITIONS = stringPreferencesKey("digits_positions")
        val SPECIALS_POSITIONS = stringPreferencesKey("specials_positions")
        val CASE_MODE = stringPreferencesKey("case_mode")
        val CASE_BLOCKS = stringPreferencesKey("case_blocks") // JSON array
        val SYLLABLES_LENGTH = intPreferencesKey("syllables_length")
        val POLICY = stringPreferencesKey("policy")
        val PASSPHRASE_WORD_COUNT = intPreferencesKey("passphrase_word_count")
        val PASSPHRASE_SEPARATOR = stringPreferencesKey("passphrase_separator")
        val DICTIONARY = stringPreferencesKey("dictionary")
        val LEET_WORD = stringPreferencesKey("leet_word")
    }

    /**
     * Flux des paramètres
     */
    val settingsFlow: Flow<Settings> = context.dataStore.data
        .catch { exception ->
            if (exception is IOException) {
                emit(emptyPreferences())
            } else {
                throw exception
            }
        }
        .map { preferences ->
            Settings(
                mode = preferences[PreferencesKeys.MODE]?.let { GenerationMode.valueOf(it) } ?: GenerationMode.SYLLABLES,
                quantity = preferences[PreferencesKeys.QUANTITY] ?: 5,
                maskDisplay = preferences[PreferencesKeys.MASK_DISPLAY] ?: true,
                digitsCount = preferences[PreferencesKeys.DIGITS_COUNT] ?: 2,
                specialsCount = preferences[PreferencesKeys.SPECIALS_COUNT] ?: 2,
                customSpecials = preferences[PreferencesKeys.CUSTOM_SPECIALS] ?: "_+-=.@#%",
                digitsPlacement = preferences[PreferencesKeys.DIGITS_PLACEMENT]?.let { Placement.valueOf(it) } ?: Placement.RANDOM,
                specialsPlacement = preferences[PreferencesKeys.SPECIALS_PLACEMENT]?.let { Placement.valueOf(it) } ?: Placement.RANDOM,
                digitsPositions = preferences[PreferencesKeys.DIGITS_POSITIONS]?.let { parsePositions(it) } ?: listOf(50),
                specialsPositions = preferences[PreferencesKeys.SPECIALS_POSITIONS]?.let { parsePositions(it) } ?: listOf(50),
                caseMode = preferences[PreferencesKeys.CASE_MODE]?.let { CaseMode.valueOf(it) } ?: CaseMode.MIXED,
                caseBlocks = preferences[PreferencesKeys.CASE_BLOCKS]?.let { parseCaseBlocks(it) } ?: listOf(CaseBlock.T, CaseBlock.L),
                syllablesLength = preferences[PreferencesKeys.SYLLABLES_LENGTH] ?: 20,
                policy = preferences[PreferencesKeys.POLICY]?.let { CharPolicy.valueOf(it) } ?: CharPolicy.STANDARD,
                passphraseWordCount = preferences[PreferencesKeys.PASSPHRASE_WORD_COUNT] ?: 5,
                passphraseSeparator = preferences[PreferencesKeys.PASSPHRASE_SEPARATOR] ?: "-",
                dictionary = preferences[PreferencesKeys.DICTIONARY]?.let { DictionaryType.valueOf(it) } ?: DictionaryType.FRENCH,
                leetWord = preferences[PreferencesKeys.LEET_WORD] ?: "password"
            )
        }

    /**
     * Sauvegarde les paramètres
     */
    suspend fun saveSettings(settings: Settings) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.MODE] = settings.mode.name
            preferences[PreferencesKeys.QUANTITY] = settings.quantity
            preferences[PreferencesKeys.MASK_DISPLAY] = settings.maskDisplay
            preferences[PreferencesKeys.DIGITS_COUNT] = settings.digitsCount
            preferences[PreferencesKeys.SPECIALS_COUNT] = settings.specialsCount
            preferences[PreferencesKeys.CUSTOM_SPECIALS] = settings.customSpecials
            preferences[PreferencesKeys.DIGITS_PLACEMENT] = settings.digitsPlacement.name
            preferences[PreferencesKeys.SPECIALS_PLACEMENT] = settings.specialsPlacement.name
            preferences[PreferencesKeys.DIGITS_POSITIONS] = serializePositions(settings.digitsPositions)
            preferences[PreferencesKeys.SPECIALS_POSITIONS] = serializePositions(settings.specialsPositions)
            preferences[PreferencesKeys.CASE_MODE] = settings.caseMode.name
            preferences[PreferencesKeys.CASE_BLOCKS] = serializeCaseBlocks(settings.caseBlocks)
            preferences[PreferencesKeys.SYLLABLES_LENGTH] = settings.syllablesLength
            preferences[PreferencesKeys.POLICY] = settings.policy.name
            preferences[PreferencesKeys.PASSPHRASE_WORD_COUNT] = settings.passphraseWordCount
            preferences[PreferencesKeys.PASSPHRASE_SEPARATOR] = settings.passphraseSeparator
            preferences[PreferencesKeys.DICTIONARY] = settings.dictionary.name
            preferences[PreferencesKeys.LEET_WORD] = settings.leetWord
        }
    }

    /**
     * Vérifie si l'onboarding a été complété
     */
    val isOnboardingCompleted: Flow<Boolean> = context.dataStore.data
        .catch { exception ->
            if (exception is IOException) {
                emit(emptyPreferences())
            } else {
                throw exception
            }
        }
        .map { preferences ->
            preferences[PreferencesKeys.ONBOARDING_COMPLETED] ?: false
        }

    /**
     * Marque l'onboarding comme complété
     */
    suspend fun setOnboardingCompleted() {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.ONBOARDING_COMPLETED] = true
        }
    }

    /**
     * Efface tous les paramètres
     */
    suspend fun clearSettings() {
        context.dataStore.edit { it.clear() }
    }

    /**
     * Sérialise les blocs de casse en JSON simple
     */
    private fun serializeCaseBlocks(blocks: List<CaseBlock>): String {
        return blocks.joinToString(",") { it.name }
    }

    /**
     * Parse les blocs de casse depuis JSON
     */
    private fun parseCaseBlocks(json: String): List<CaseBlock> {
        return json.split(",").mapNotNull {
            try {
                CaseBlock.valueOf(it)
            } catch (e: Exception) {
                null
            }
        }
    }

    /**
     * Sérialise les positions en string
     */
    private fun serializePositions(positions: List<Int>): String {
        return positions.joinToString(",")
    }

    /**
     * Parse les positions depuis string
     */
    private fun parsePositions(str: String): List<Int> {
        return str.split(",").mapNotNull {
            try {
                it.toInt().coerceIn(0, 100)
            } catch (e: Exception) {
                null
            }
        }.ifEmpty { listOf(50) }
    }
}
