package com.julien.genpwdpro.domain.utils

import android.content.Context
import com.google.gson.Gson
import com.google.gson.JsonParseException
import com.google.gson.reflect.TypeToken
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.data.models.DictionaryType
import java.io.IOException
import java.io.InputStreamReader
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Gestionnaire de dictionnaires multilingues
 * Charge et met en cache les dictionnaires depuis assets/
 */
class DictionaryManager(private val context: Context) {

    companion object {
        private const val TAG = "DictionaryManager"
    }

    private val gson = Gson()
    private val cache = mutableMapOf<DictionaryType, List<String>>()

    /**
     * Dictionnaire français par défaut (fallback)
     * Port de FALLBACK_DICTIONARY de constants.js
     */
    private val fallbackDictionary = listOf(
        "abri", "acier", "actif", "aimer", "algue", "alpes", "amande", "ananas", "ancien", "ancre",
        "angle", "animal", "arbre", "argent", "arome", "asile", "aspect", "atelier", "atlas", "atout",
        "audace", "avion", "avocat", "azimut", "bagage", "baie", "balade", "bambou", "banane", "banc",
        "barbe", "baril", "bassin", "bazar", "beige", "belier", "bento", "bisou", "bison", "bitume",
        "blason", "bleu", "bloc", "bocal", "boheme", "boite", "bonbon", "bonheur", "bosse", "botte",
        "boucle", "boue", "bougie", "boule", "branche", "bravo", "bref", "bruit", "bulle", "bureau",
        "cactus", "cadre", "caisse", "calme", "canyon", "capable", "carafe", "carbone", "cargo", "carte",
        "casque", "cave", "caviar", "ceinture", "cellule", "cerise", "chance", "chaud", "cheval", "chou",
        "ciel", "cigale", "ciment", "citron", "clair", "classe", "clic", "client", "cloche", "clou",
        "cobalt", "codage", "coeur", "coffee", "colline", "colonne", "combat", "comete", "compact", "confort",
        "copain", "corail", "corde", "cornet", "corps", "cosmos", "coton", "couche", "courbe", "courir",
        "coyote", "crabe", "cran", "crayon", "creme", "creux", "crique", "cristal", "croix", "cumulus",
        "cycle", "dague", "dalle", "danger", "danse", "dauphin", "debout", "declic", "degre", "delta"
    )

    /**
     * Récupère un dictionnaire (depuis le cache ou en le chargeant)
     */
    suspend fun getDictionary(type: DictionaryType): List<String> = withContext(Dispatchers.IO) {
        // Vérifier le cache
        cache[type]?.let { return@withContext it }

        // Charger le dictionnaire
        try {
            val dictionary = loadDictionary(type)
            cache[type] = dictionary
            dictionary
        } catch (ioException: IOException) {
            SafeLog.w(TAG, "Failed to load dictionary for type=$type", ioException)
            // Fallback sur le dictionnaire français intégré
            fallbackDictionary
        } catch (parseException: JsonParseException) {
            SafeLog.w(TAG, "Invalid dictionary format for type=$type", parseException)
            fallbackDictionary
        }
    }

    /**
     * Charge un dictionnaire depuis assets/dictionaries/
     */
    private fun loadDictionary(type: DictionaryType): List<String> {
        val fileName = when (type) {
            DictionaryType.FRENCH -> "french.json"
            DictionaryType.ENGLISH -> "english.json"
            DictionaryType.LATIN -> "latin.json"
        }

        val inputStream = context.assets.open("dictionaries/$fileName")
        val reader = InputStreamReader(inputStream)

        // Le fichier JSON contient: { "language": "french", "words": [...] }
        val typeToken = object : TypeToken<DictionaryFile>() {}.type
        val dictionaryFile: DictionaryFile = gson.fromJson(reader, typeToken)
        reader.close()

        return dictionaryFile.words
    }

    /**
     * Pré-charge tous les dictionnaires en arrière-plan
     */
    suspend fun preloadAll() = withContext(Dispatchers.IO) {
        DictionaryType.values().forEach { type ->
            getDictionary(type)
        }
    }

    /**
     * Efface le cache des dictionnaires
     */
    fun clearCache() {
        cache.clear()
    }

    /**
     * Structure du fichier JSON de dictionnaire
     */
    private data class DictionaryFile(
        val language: String,
        val words: List<String>
    )
}
