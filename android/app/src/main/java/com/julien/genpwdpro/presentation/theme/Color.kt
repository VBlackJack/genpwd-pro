package com.julien.genpwdpro.presentation.theme

import androidx.compose.ui.graphics.Color

/**
 * Palette de couleurs personnalisée GenPwd Pro
 *
 * Ces couleurs sont utilisées:
 * - Sur Android 11 et antérieur (pas de Material You)
 * - Quand l'utilisateur désactive les couleurs dynamiques
 * - Comme fallback si les couleurs dynamiques échouent
 *
 * Sur Android 12+ avec Material You activé (par défaut), ces couleurs
 * sont remplacées par une palette générée depuis le fond d'écran.
 */

// Couleurs principales (port du thème web)
val PrimaryCyan = Color(0xFF15BEFF)
val PrimaryCyanDark = Color(0xFF0891C7) // Version plus sombre pour le light theme
val SecondaryGrayBlue = Color(0xFF8C94CA)
val TertiaryGreen = Color(0xFF10B981)

// ========================================
// DARK THEME
// ========================================

// Couleurs de fond (dark theme)
val BackgroundDark = Color(0xFF0A0E1A)
val SurfaceDark = Color(0xFF131A34)
val SurfaceVariantDark = Color(0xFF1A2240)

// Couleurs de texte (dark theme)
val TextPrimaryDark = Color(0xFFE8EDFF)       // Amélioré: Plus lumineux pour meilleur contraste
val TextSecondaryDark = Color(0xFFA5AEDB)     // Amélioré: Contraste amélioré
val TextTertiaryDark = Color(0xFF7A82B0)      // Amélioré: Meilleur contraste (était #5A6390)

// ========================================
// LIGHT THEME
// ========================================

// Couleurs de fond (light theme)
val BackgroundLight = Color(0xFFFBFCFE)
val SurfaceLight = Color(0xFFFFFFFF)
val SurfaceVariantLight = Color(0xFFF1F5F9)

// Couleurs de texte (light theme)
val TextPrimaryLight = Color(0xFF0F172A)
val TextSecondaryLight = Color(0xFF334155)    // Amélioré: Contraste amélioré (était #475569)
val TextTertiaryLight = Color(0xFF64748B)     // Amélioré: Meilleur contraste (était #94A3B8)

// ========================================
// COULEURS COMMUNES (tous thèmes)
// ========================================

// Couleurs d'état
val ErrorRed = Color(0xFFEF4444)
val WarningOrange = Color(0xFFF59E0B)
val SuccessGreen = Color(0xFF10B981)

// Couleurs d'entropie et force de mot de passe
val EntropyWeak = Color(0xFFEF4444)          // Rouge
val EntropyMedium = Color(0xFFF59E0B)        // Orange
val EntropyStrong = Color(0xFF10B981)        // Vert
val EntropyVeryStrong = Color(0xFF15BEFF)    // Cyan

// Couleurs de force de mot de passe (PasswordStrengthIndicator)
val PasswordWeakRed = Color(0xFFFF6B6B)      // Rouge clair pour mot de passe faible
val PasswordMediumOrange = Color(0xFFF59E0B) // Orange pour mot de passe moyen
val PasswordStrongGreen = Color(0xFF10B981)  // Vert pour mot de passe fort
val PasswordVeryStrongCyan = Color(0xFF15BEFF) // Cyan pour mot de passe très fort

// Couleurs supplémentaires pour enrichir la palette
val InfoBlue = Color(0xFF3B82F6)             // Bleu info
val PurpleAccent = Color(0xFF8B5CF6)         // Violet accent
val AmberWarning = Color(0xFFF59E0B)         // Ambre warning (alias de WarningOrange)
