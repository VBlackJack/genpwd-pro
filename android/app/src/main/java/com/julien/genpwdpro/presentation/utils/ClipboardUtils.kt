package com.julien.genpwdpro.presentation.utils

import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import androidx.core.content.getSystemService

/**
 * Utilitaires pour la gestion sécurisée du presse-papiers
 */
object ClipboardUtils {

    private const val DEFAULT_CLEAR_DELAY_MS = 10_000L // 10 secondes

    /**
     * Copie du texte dans le presse-papiers avec effacement automatique après délai
     */
    fun copyWithTimeout(
        context: Context,
        text: String,
        label: String = "password",
        delayMs: Long = DEFAULT_CLEAR_DELAY_MS,
        showToast: Boolean = true,
        onCleared: (() -> Unit)? = null
    ) {
        val clipboard = context.getSystemService<ClipboardManager>() ?: return

        // Copier le texte
        val clip = ClipData.newPlainText(label, text)

        // Sur Android 13+, on peut marquer comme sensible pour masquage automatique
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            clip.description.extras = android.os.PersistableBundle().apply {
                putBoolean(ClipDescription.EXTRA_IS_SENSITIVE, true)
            }
        }

        clipboard.setPrimaryClip(clip)

        if (showToast) {
            val timeoutSec = delayMs / 1000
            Toast.makeText(
                context,
                "Copié ! Auto-effacement dans ${timeoutSec}s",
                Toast.LENGTH_SHORT
            ).show()
        }

        // Programmer l'effacement
        val handler = Handler(Looper.getMainLooper())
        handler.postDelayed({
            if (clipboardMatchesText(context, text)) {
                clearClipboard(context)
                onCleared?.invoke()

                if (showToast) {
                    Toast.makeText(
                        context,
                        "Presse-papiers effacé pour sécurité",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }, delayMs)
    }

    /**
     * Copie simple sans effacement automatique
     */
    fun copyToClipboard(
        context: Context,
        text: String,
        label: String = "password",
        showToast: Boolean = true
    ) {
        val clipboard = context.getSystemService<ClipboardManager>() ?: return
        val clip = ClipData.newPlainText(label, text)

        // Sur Android 13+, marquer comme sensible
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            clip.description.extras = android.os.PersistableBundle().apply {
                putBoolean(ClipDescription.EXTRA_IS_SENSITIVE, true)
            }
        }

        clipboard.setPrimaryClip(clip)

        if (showToast) {
            Toast.makeText(context, "Copié !", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Efface le contenu du presse-papiers
     */
    fun clearClipboard(context: Context) {
        val clipboard = context.getSystemService<ClipboardManager>() ?: return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            // Android 9+: méthode officielle
            clipboard.clearPrimaryClip()
        } else {
            // Android < 9: copier un texte vide
            val clip = ClipData.newPlainText("", "")
            clipboard.setPrimaryClip(clip)
        }
    }

    /**
     * Vérifie si le presse-papiers contient du texte
     */
    fun hasText(context: Context): Boolean {
        val clipboard = context.getSystemService<ClipboardManager>() ?: return false
        return clipboard.hasPrimaryClip() &&
                clipboard.primaryClipDescription?.hasMimeType(ClipDescription.MIMETYPE_TEXT_PLAIN) == true
    }

    /**
     * Récupère le texte du presse-papiers
     */
    fun getText(context: Context): String? {
        val clipboard = context.getSystemService<ClipboardManager>() ?: return null
        val clip = clipboard.primaryClip ?: return null

        if (clip.itemCount > 0) {
            return clip.getItemAt(0)?.text?.toString()
        }

        return null
    }

    private fun clipboardMatchesText(context: Context, expected: String): Boolean {
        val clipboard = context.getSystemService<ClipboardManager>() ?: return false
        val clipData = clipboard.primaryClip ?: return false
        if (clipData.itemCount == 0) return false
        val current = clipData.getItemAt(0)?.coerceToText(context)?.toString()
        return current == expected
    }
}
