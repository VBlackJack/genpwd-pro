package com.julien.genpwdpro.autofill

import android.app.assist.AssistStructure
import android.os.Build
import android.os.CancellationSignal
import android.service.autofill.*
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import androidx.annotation.RequiresApi
import com.julien.genpwdpro.R
import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.domain.usecases.GeneratePasswordUseCase
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Service d'auto-remplissage pour GenPwd Pro
 *
 * Permet de générer et remplir automatiquement des mots de passe
 * dans les champs de formulaire d'autres applications (Android 8+)
 *
 * Fonctionnalités:
 * - Détection automatique des champs de mot de passe
 * - Génération de mot de passe à la demande
 * - Support des champs username + password
 * - Sauvegarde automatique dans l'historique
 *
 * Sécurité:
 * - Génération côté service (pas d'UI externe)
 * - Respect des paramètres utilisateur
 * - Pas de stockage permanent par défaut
 */
@RequiresApi(Build.VERSION_CODES.O)
@AndroidEntryPoint
class GenPwdAutofillService : AutofillService() {

    @Inject
    lateinit var generatePasswordUseCase: GeneratePasswordUseCase

    @Inject
    lateinit var autofillRepository: AutofillRepository

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    companion object {
        private const val MAX_DATASETS = 3 // Nombre max de suggestions
    }

    override fun onFillRequest(
        request: FillRequest,
        cancellationSignal: CancellationSignal,
        callback: FillCallback
    ) {
        serviceScope.launch {
            try {
                val context = request.fillContexts.lastOrNull()?.structure
                if (context == null) {
                    callback.onSuccess(null)
                    return@launch
                }

                // Parser la structure pour trouver les champs de mot de passe
                val parser = AutofillParser(context)
                val autofillFields = parser.parseForCredentials()

                if (autofillFields.isEmpty()) {
                    callback.onSuccess(null)
                    return@launch
                }

                // Construire la réponse d'auto-remplissage
                val responseBuilder = FillResponse.Builder()

                // Ajouter des datasets avec mots de passe générés
                val settings = autofillRepository.getSettings().first()

                // Générer 3 options de mots de passe
                repeat(MAX_DATASETS) { index ->
                    val password = generatePasswordUseCase.execute(settings)
                    val dataset = createPasswordDataset(
                        autofillFields = autofillFields,
                        password = password,
                        index = index,
                        settings = settings
                    )
                    responseBuilder.addDataset(dataset)
                }

                callback.onSuccess(responseBuilder.build())

            } catch (e: Exception) {
                callback.onFailure(e.message)
            }
        }
    }

    override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
        serviceScope.launch {
            try {
                // Parser les données sauvegardées
                val context = request.fillContexts.lastOrNull()?.structure
                if (context == null) {
                    callback.onSuccess()
                    return@launch
                }

                val parser = AutofillParser(context)
                val credentials = parser.extractCredentials(request.clientState)

                // Sauvegarder dans l'historique si demandé
                if (credentials.password.isNotEmpty()) {
                    autofillRepository.saveToHistory(
                        password = credentials.password,
                        username = credentials.username,
                        packageName = context.activityComponent.packageName
                    )
                }

                callback.onSuccess()

            } catch (e: Exception) {
                callback.onFailure(e.message)
            }
        }
    }

    override fun onConnected() {
        super.onConnected()
        // Service connecté et prêt
    }

    override fun onDisconnected() {
        super.onDisconnected()
        serviceScope.cancel()
    }

    /**
     * Crée un Dataset avec un mot de passe généré
     */
    private fun createPasswordDataset(
        autofillFields: AutofillFieldsMetadata,
        password: String,
        index: Int,
        settings: Settings
    ): Dataset {
        val datasetBuilder = Dataset.Builder()

        // Présentation visuelle
        val presentation = RemoteViews(packageName, R.layout.autofill_item).apply {
            setTextViewText(
                R.id.autofill_text,
                "GenPwd Pro - Option ${index + 1} (${settings.mode.name})"
            )
            setTextViewText(
                R.id.autofill_subtext,
                "Entropie: ${calculateEntropy(password)} bits"
            )
        }

        // Remplir le champ de mot de passe
        autofillFields.passwordField?.let { field ->
            datasetBuilder.setValue(
                field.autofillId,
                AutofillValue.forText(password),
                presentation
            )
        }

        // Remplir le champ username si présent (optionnel)
        autofillFields.usernameField?.let { field ->
            val username = "user_${System.currentTimeMillis()}" // Placeholder
            datasetBuilder.setValue(
                field.autofillId,
                AutofillValue.forText(username),
                presentation
            )
        }

        return datasetBuilder.build()
    }

    /**
     * Calcule l'entropie approximative pour l'affichage
     */
    private fun calculateEntropy(password: String): Int {
        val hasLower = password.any { it.isLowerCase() }
        val hasUpper = password.any { it.isUpperCase() }
        val hasDigit = password.any { it.isDigit() }
        val hasSpecial = password.any { !it.isLetterOrDigit() }

        var poolSize = 0
        if (hasLower) poolSize += 26
        if (hasUpper) poolSize += 26
        if (hasDigit) poolSize += 10
        if (hasSpecial) poolSize += 32

        return (password.length * kotlin.math.log2(poolSize.toDouble())).toInt()
    }
}

/**
 * Métadonnées des champs d'auto-remplissage détectés
 */
data class AutofillFieldsMetadata(
    val passwordField: AutofillFieldMetadata? = null,
    val usernameField: AutofillFieldMetadata? = null,
    val packageName: String = ""
)

/**
 * Métadonnées d'un champ individuel
 */
data class AutofillFieldMetadata(
    val autofillId: AutofillId,
    val hints: List<String>,
    val viewId: String? = null
)

/**
 * Informations d'identification extraites
 */
data class AutofillCredentials(
    val username: String = "",
    val password: String = "",
    val packageName: String = ""
)

/**
 * Parser pour analyser la structure AssistStructure
 */
class AutofillParser(private val structure: AssistStructure) {

    /**
     * Parse la structure pour trouver les champs username/password
     */
    fun parseForCredentials(): AutofillFieldsMetadata {
        var passwordField: AutofillFieldMetadata? = null
        var usernameField: AutofillFieldMetadata? = null
        var packageName = ""

        // Parcourir tous les nœuds
        for (i in 0 until structure.windowNodeCount) {
            val windowNode = structure.getWindowNodeAt(i)
            packageName = windowNode.rootViewNode.idPackage ?: ""

            traverseNode(windowNode.rootViewNode) { node ->
                val autofillHints = node.autofillHints?.toList() ?: emptyList()
                val autofillType = node.autofillType

                // Chercher le champ de mot de passe
                if (isPasswordField(node, autofillHints)) {
                    passwordField = AutofillFieldMetadata(
                        autofillId = node.autofillId!!,
                        hints = autofillHints,
                        viewId = node.idEntry
                    )
                }

                // Chercher le champ username
                if (isUsernameField(node, autofillHints)) {
                    usernameField = AutofillFieldMetadata(
                        autofillId = node.autofillId!!,
                        hints = autofillHints,
                        viewId = node.idEntry
                    )
                }
            }
        }

        return AutofillFieldsMetadata(
            passwordField = passwordField,
            usernameField = usernameField,
            packageName = packageName
        )
    }

    /**
     * Extrait les credentials depuis la structure
     */
    fun extractCredentials(clientState: android.os.Bundle?): AutofillCredentials {
        var username = ""
        var password = ""
        var packageName = ""

        for (i in 0 until structure.windowNodeCount) {
            val windowNode = structure.getWindowNodeAt(i)
            packageName = windowNode.rootViewNode.idPackage ?: ""

            traverseNode(windowNode.rootViewNode) { node ->
                val value = node.autofillValue
                val hints = node.autofillHints?.toList() ?: emptyList()

                if (isPasswordField(node, hints) && value?.isText == true) {
                    password = value.textValue.toString()
                }

                if (isUsernameField(node, hints) && value?.isText == true) {
                    username = value.textValue.toString()
                }
            }
        }

        return AutofillCredentials(username, password, packageName)
    }

    /**
     * Parcourt récursivement tous les nœuds
     */
    private fun traverseNode(
        node: AssistStructure.ViewNode,
        action: (AssistStructure.ViewNode) -> Unit
    ) {
        if (node.autofillId != null) {
            action(node)
        }

        for (i in 0 until node.childCount) {
            traverseNode(node.getChildAt(i), action)
        }
    }

    /**
     * Détermine si un nœud est un champ de mot de passe
     */
    private fun isPasswordField(
        node: AssistStructure.ViewNode,
        hints: List<String>
    ): Boolean {
        // Vérifier les hints d'auto-remplissage
        if (hints.any { it.contains("password", ignoreCase = true) }) {
            return true
        }

        // Vérifier l'input type
        if (node.inputType and android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD != 0 ||
            node.inputType and android.text.InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD != 0) {
            return true
        }

        // Vérifier l'ID de la vue
        val viewId = node.idEntry?.lowercase() ?: ""
        if (viewId.contains("password") || viewId.contains("pwd")) {
            return true
        }

        return false
    }

    /**
     * Détermine si un nœud est un champ username
     */
    private fun isUsernameField(
        node: AssistStructure.ViewNode,
        hints: List<String>
    ): Boolean {
        // Vérifier les hints
        if (hints.any {
            it.contains("username", ignoreCase = true) ||
            it.contains("email", ignoreCase = true) ||
            it.contains("login", ignoreCase = true)
        }) {
            return true
        }

        // Vérifier l'ID de la vue
        val viewId = node.idEntry?.lowercase() ?: ""
        if (viewId.contains("user") || viewId.contains("email") || viewId.contains("login")) {
            return true
        }

        return false
    }
}
