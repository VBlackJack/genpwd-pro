package com.julien.genpwdpro.presentation.shortcuts

import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.annotation.RequiresApi
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import com.julien.genpwdpro.R
import com.julien.genpwdpro.data.models.GenerationMode
import com.julien.genpwdpro.presentation.MainActivity

/**
 * Gestionnaire des raccourcis dynamiques pour génération rapide
 * Permet l'accès rapide depuis le menu long-press de l'icône
 */
object AppShortcutManager {

    const val EXTRA_GENERATION_MODE = "extra_generation_mode"
    const val EXTRA_QUICK_GENERATE = "extra_quick_generate"

    private const val SHORTCUT_SYLLABLES = "shortcut_syllables"
    private const val SHORTCUT_PASSPHRASE = "shortcut_passphrase"
    private const val SHORTCUT_LEET = "shortcut_leet"

    /**
     * Initialise les raccourcis dynamiques de l'application
     * À appeler au démarrage de MainActivity
     */
    fun setupShortcuts(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N_MR1) {
            return // Les raccourcis dynamiques nécessitent Android 7.1+
        }

        val shortcuts = listOf(
            createSyllablesShortcut(context),
            createPassphraseShortcut(context),
            createLeetShortcut(context)
        )

        ShortcutManagerCompat.setDynamicShortcuts(context, shortcuts)
    }

    /**
     * Crée le raccourci "Générer Syllabes"
     */
    private fun createSyllablesShortcut(context: Context): ShortcutInfoCompat {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            putExtra(EXTRA_GENERATION_MODE, GenerationMode.SYLLABLES.name)
            putExtra(EXTRA_QUICK_GENERATE, true)
        }

        return ShortcutInfoCompat.Builder(context, SHORTCUT_SYLLABLES)
            .setShortLabel("Syllabes")
            .setLongLabel("Générer mot de passe syllabique")
            .setIcon(IconCompat.createWithResource(context, R.drawable.ic_syllables))
            .setIntent(intent)
            .setRank(0)
            .build()
    }

    /**
     * Crée le raccourci "Générer Passphrase"
     */
    private fun createPassphraseShortcut(context: Context): ShortcutInfoCompat {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            putExtra(EXTRA_GENERATION_MODE, GenerationMode.PASSPHRASE.name)
            putExtra(EXTRA_QUICK_GENERATE, true)
        }

        return ShortcutInfoCompat.Builder(context, SHORTCUT_PASSPHRASE)
            .setShortLabel("Passphrase")
            .setLongLabel("Générer une passphrase")
            .setIcon(IconCompat.createWithResource(context, R.drawable.ic_passphrase))
            .setIntent(intent)
            .setRank(1)
            .build()
    }

    /**
     * Crée le raccourci "Générer Leet Speak"
     */
    private fun createLeetShortcut(context: Context): ShortcutInfoCompat {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            putExtra(EXTRA_GENERATION_MODE, GenerationMode.LEET.name)
            putExtra(EXTRA_QUICK_GENERATE, true)
        }

        return ShortcutInfoCompat.Builder(context, SHORTCUT_LEET)
            .setShortLabel("Leet Speak")
            .setLongLabel("Générer en Leet Speak")
            .setIcon(IconCompat.createWithResource(context, R.drawable.ic_leet))
            .setIntent(intent)
            .setRank(2)
            .build()
    }

    /**
     * Met à jour les raccourcis dynamiques
     * À appeler lorsque les préférences changent
     */
    fun updateShortcuts(context: Context) {
        setupShortcuts(context)
    }

    /**
     * Supprime tous les raccourcis dynamiques
     */
    fun removeAllShortcuts(context: Context) {
        ShortcutManagerCompat.removeAllDynamicShortcuts(context)
    }
}
