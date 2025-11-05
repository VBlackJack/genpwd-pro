package com.julien.genpwdpro.presentation.accessibility

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.*

/**
 * Utilitaires pour améliorer l'accessibilité de l'application
 * Conforme aux standards WCAG 2.1 AA
 */
object AccessibilityUtils {

    /**
     * Actions vocales personnalisées
     */
    object CustomActions {
        const val COPY = "Copier"
        const val TOGGLE_VISIBILITY = "Basculer la visibilité"
        const val FAVORITE = "Marquer comme favori"
        const val UNFAVORITE = "Retirer des favoris"
        const val DELETE = "Supprimer"
        const val EDIT = "Modifier"
        const val SHARE = "Partager"
        const val GENERATE = "Générer"
        const val REFRESH = "Actualiser"
        const val LOCK = "Verrouiller"
        const val UNLOCK = "Déverrouiller"
    }

    /**
     * Rôles sémantiques
     */
    object Roles {
        const val SECURE_FIELD = "Champ sécurisé"
        const val PASSWORD_FIELD = "Champ de mot de passe"
        const val VAULT_ENTRY = "Entrée de coffre-fort"
        const val ACTION_BUTTON = "Bouton d'action"
        const val NAVIGATION_BUTTON = "Bouton de navigation"
    }

    /**
     * États vocalisés
     */
    object States {
        fun locked() = "Verrouillé"
        fun unlocked() = "Déverrouillé"
        fun hidden() = "Masqué"
        fun visible() = "Visible"
        fun favorite() = "Favori"
        fun notFavorite() = "Non favori"
        fun loading() = "Chargement en cours"
        fun error(message: String) = "Erreur: $message"
        fun success(message: String) = "Succès: $message"
        fun selected() = "Sélectionné"
        fun notSelected() = "Non sélectionné"
        fun copied() = "Copié dans le presse-papier"
        fun strength(level: String) = "Force du mot de passe: $level"
        fun remainingTime(seconds: Int) = "Expire dans $seconds secondes"
    }
}

/**
 * Modifier pour marquer un champ comme sensible (mot de passe, PIN, etc.)
 */
fun Modifier.sensitiveContent(
    description: String,
    isVisible: Boolean = false
): Modifier = this.semantics(mergeDescendants = true) {
    contentDescription = if (isVisible) {
        "$description, visible"
    } else {
        "$description, masqué pour la sécurité"
    }
    // Indique que c'est un champ sensible
    password()
}

/**
 * Modifier pour les entrées de coffre-fort
 */
fun Modifier.vaultEntry(
    title: String,
    type: String,
    isFavorite: Boolean,
    hasTotp: Boolean = false
): Modifier = this.semantics(mergeDescendants = true) {
    contentDescription = buildString {
        append("$type: $title")
        if (isFavorite) append(", Favori")
        if (hasTotp) append(", Authentification à deux facteurs activée")
    }
    role = Role.Button
}

/**
 * Modifier pour les boutons d'action avec état
 */
fun Modifier.actionButton(
    action: String,
    state: String? = null,
    enabled: Boolean = true
): Modifier = this.semantics {
    contentDescription = buildString {
        append(action)
        state?.let { append(", $it") }
        if (!enabled) append(", Désactivé")
    }
    role = Role.Button
    this.disabled = !enabled
}

/**
 * Modifier pour les champs avec compteur
 */
fun Modifier.fieldWithCounter(
    label: String,
    currentLength: Int,
    maxLength: Int
): Modifier = this.semantics {
    contentDescription = "$label, $currentLength sur $maxLength caractères"
}

/**
 * Modifier pour les indicateurs de force
 */
fun Modifier.strengthIndicator(
    strength: String,
    percentage: Int
): Modifier = this.semantics {
    contentDescription = "Force du mot de passe: $strength, $percentage pourcent"
    stateDescription = strength
}

/**
 * Modifier pour les éléments de liste avec position
 */
fun Modifier.listItem(
    position: Int,
    total: Int,
    itemDescription: String
): Modifier = this.semantics {
    contentDescription = "$itemDescription, élément $position sur $total"
}

/**
 * Modifier pour les codes TOTP avec compte à rebours
 */
fun Modifier.totpCode(
    code: String,
    remainingSeconds: Int,
    period: Int
): Modifier = this.semantics(mergeDescendants = true) {
    contentDescription = "Code d'authentification: $code, expire dans $remainingSeconds secondes"
    stateDescription = AccessibilityUtils.States.remainingTime(remainingSeconds)
    // Marque comme champ de temps sensible
    liveRegion = LiveRegionMode.Assertive
}

/**
 * Modifier pour les erreurs
 */
fun Modifier.errorMessage(message: String): Modifier = this.semantics {
    contentDescription = "Erreur: $message"
    error(message)
}

/**
 * Modifier pour les messages de succès
 */
fun Modifier.successMessage(message: String): Modifier = this.semantics {
    contentDescription = "Succès: $message"
    liveRegion = LiveRegionMode.Polite
}

/**
 * Modifier pour les toggle buttons (visibilité, favoris, etc.)
 */
fun Modifier.toggleButton(
    label: String,
    isChecked: Boolean,
    role: String = "Basculer"
): Modifier = this.semantics {
    contentDescription = "$label, ${if (isChecked) "activé" else "désactivé"}"
    this.role = Role.Switch
    this.toggleableState = ToggleableState(isChecked)
}

/**
 * Modifier pour les actions de navigation
 */
fun Modifier.navigationAction(
    destination: String,
    additionalInfo: String? = null
): Modifier = this.semantics {
    contentDescription = buildString {
        append("Naviguer vers $destination")
        additionalInfo?.let { append(", $it") }
    }
    role = Role.Button
}

/**
 * Modifier pour les groupes de statistiques
 */
fun Modifier.statisticItem(
    label: String,
    value: String,
    description: String? = null
): Modifier = this.semantics(mergeDescendants = true) {
    contentDescription = buildString {
        append("$label: $value")
        description?.let { append(", $it") }
    }
}

/**
 * Modifier pour les filtres actifs
 */
fun Modifier.activeFilter(
    filterName: String,
    isActive: Boolean
): Modifier = this.semantics {
    contentDescription = "$filterName, ${if (isActive) "actif" else "inactif"}"
    this.selected = isActive
}

/**
 * Extension pour annoncer les changements dynamiques
 */
fun Modifier.announceChange(announcement: String): Modifier = this.semantics {
    liveRegion = LiveRegionMode.Polite
    contentDescription = announcement
}

/**
 * Modifier pour les zones de drag & drop
 */
fun Modifier.dropZone(
    label: String,
    isActive: Boolean
): Modifier = this.semantics {
    contentDescription = "$label, ${if (isActive) "actif, déposez ici" else "inactif"}"
    role = Role.DropdownList
}

/**
 * Modifier pour les éléments swipeable
 */
fun Modifier.swipeableItem(
    itemName: String,
    leftAction: String? = null,
    rightAction: String? = null
): Modifier = this.semantics {
    contentDescription = buildString {
        append(itemName)
        leftAction?.let { append(", Glisser à gauche pour $it") }
        rightAction?.let { append(", Glisser à droite pour $it") }
    }
}

/**
 * Modifier pour les champs avec validation
 */
fun Modifier.validatedField(
    label: String,
    isValid: Boolean,
    errorMessage: String? = null
): Modifier = this.semantics {
    contentDescription = buildString {
        append(label)
        if (!isValid && errorMessage != null) {
            append(", Erreur: $errorMessage")
        } else if (isValid) {
            append(", Valide")
        }
    }
    if (!isValid && errorMessage != null) {
        error(errorMessage)
    }
}

/**
 * Modifier pour les progrès/indicateurs de chargement
 */
fun Modifier.progressIndicator(
    label: String,
    progress: Float? = null
): Modifier = this.semantics {
    contentDescription = if (progress != null) {
        "$label, ${(progress * 100).toInt()} pourcent"
    } else {
        "$label, chargement en cours"
    }
    role = Role.ProgressBar
    if (progress != null) {
        this.progressBarRangeInfo = ProgressBarRangeInfo(progress, 0f..1f)
    }
}

/**
 * Modifier pour les sections pliables/expansibles
 */
fun Modifier.expandableSection(
    title: String,
    isExpanded: Boolean,
    itemCount: Int? = null
): Modifier = this.semantics {
    contentDescription = buildString {
        append(title)
        append(if (isExpanded) ", Déplié" else ", Plié")
        itemCount?.let { append(", $it éléments") }
    }
    stateDescription = if (isExpanded) "Déplié" else "Plié"
}

/**
 * Modifier pour les badges de notification
 */
fun Modifier.badge(
    count: Int,
    label: String
): Modifier = this.semantics {
    contentDescription = "$count $label"
    role = Role.Image
}

/**
 * Modifier pour les sliders avec valeur
 */
fun Modifier.sliderWithValue(
    label: String,
    value: Float,
    min: Float,
    max: Float,
    unit: String = ""
): Modifier = this.semantics {
    contentDescription = "$label: $value$unit sur $max$unit"
    role = Role.Slider
}

/**
 * Composable pour annoncer des messages à l'utilisateur via TalkBack
 */
@Composable
fun AccessibilityAnnouncement(
    message: String,
    priority: LiveRegionMode = LiveRegionMode.Polite
) {
    androidx.compose.foundation.layout.Box(
        modifier = Modifier.semantics {
            liveRegion = priority
            contentDescription = message
        }
    )
}
