package com.julien.genpwdpro.domain.utils

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.HapticFeedbackConstants
import android.view.View
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView

/**
 * Utilitaires pour le feedback haptique
 *
 * Fournit des vibrations et retours tactiles pour améliorer l'expérience utilisateur:
 * - Click léger
 * - Success (génération réussie)
 * - Error (erreur)
 * - Long press
 * - Selection
 */

/**
 * Types de feedback haptique
 */
enum class HapticFeedbackType {
    CLICK, // Click léger
    SUCCESS, // Opération réussie
    ERROR, // Erreur
    LONG_PRESS, // Appui long
    SELECTION, // Sélection d'item
    IMPACT_LIGHT, // Impact léger
    IMPACT_MEDIUM, // Impact moyen
    IMPACT_HEAVY, // Impact fort
    TICK, // Tick (scrolling)
    CONFIRM, // Confirmation
    REJECT // Rejet
}

/**
 * Classe d'aide pour le feedback haptique
 */
class HapticFeedbackHelper(private val context: Context) {

    private val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        vibratorManager?.defaultVibrator
    } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }

    /**
     * Déclenche un feedback haptique
     */
    fun performHapticFeedback(type: HapticFeedbackType) {
        if (vibrator?.hasVibrator() != true) return

        when (type) {
            HapticFeedbackType.CLICK -> vibrateClick()
            HapticFeedbackType.SUCCESS -> vibrateSuccess()
            HapticFeedbackType.ERROR -> vibrateError()
            HapticFeedbackType.LONG_PRESS -> vibrateLongPress()
            HapticFeedbackType.SELECTION -> vibrateSelection()
            HapticFeedbackType.IMPACT_LIGHT -> vibrateImpact(20)
            HapticFeedbackType.IMPACT_MEDIUM -> vibrateImpact(40)
            HapticFeedbackType.IMPACT_HEAVY -> vibrateImpact(80)
            HapticFeedbackType.TICK -> vibrateTick()
            HapticFeedbackType.CONFIRM -> vibrateConfirm()
            HapticFeedbackType.REJECT -> vibrateReject()
        }
    }

    private fun vibrateClick() {
        vibrate(10)
    }

    private fun vibrateSuccess() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val pattern = longArrayOf(0, 50, 50, 50)
            val amplitudes = intArrayOf(0, 100, 0, 150)
            val effect = VibrationEffect.createWaveform(pattern, amplitudes, -1)
            vibrator?.vibrate(effect)
        } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(longArrayOf(0, 50, 50, 50), -1)
        }
    }

    private fun vibrateError() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val pattern = longArrayOf(0, 50, 50, 50, 50, 50)
            val amplitudes = intArrayOf(0, 100, 0, 100, 0, 100)
            val effect = VibrationEffect.createWaveform(pattern, amplitudes, -1)
            vibrator?.vibrate(effect)
        } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(longArrayOf(0, 50, 50, 50, 50, 50), -1)
        }
    }

    private fun vibrateLongPress() {
        vibrate(50)
    }

    private fun vibrateSelection() {
        vibrate(5)
    }

    private fun vibrateImpact(duration: Long) {
        vibrate(duration)
    }

    private fun vibrateTick() {
        vibrate(3)
    }

    private fun vibrateConfirm() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val pattern = longArrayOf(0, 30, 20, 60)
            val amplitudes = intArrayOf(0, 80, 0, 200)
            val effect = VibrationEffect.createWaveform(pattern, amplitudes, -1)
            vibrator?.vibrate(effect)
        } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(longArrayOf(0, 30, 20, 60), -1)
        }
    }

    private fun vibrateReject() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val pattern = longArrayOf(0, 100)
            val amplitudes = intArrayOf(0, 255)
            val effect = VibrationEffect.createWaveform(pattern, amplitudes, -1)
            vibrator?.vibrate(effect)
        } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(100)
        }
    }

    private fun vibrate(duration: Long) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val effect = VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE)
            vibrator?.vibrate(effect)
        } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(duration)
        }
    }
}

/**
 * Composable pour créer un HapticFeedbackHelper
 */
@Composable
fun rememberHapticFeedback(): HapticFeedbackHelper {
    val context = LocalContext.current
    return remember(context) {
        HapticFeedbackHelper(context)
    }
}

/**
 * Extension pour View permettant le feedback haptique système
 */
fun View.performSystemHapticFeedback(type: HapticFeedbackType) {
    val constant = when (type) {
        HapticFeedbackType.CLICK -> HapticFeedbackConstants.VIRTUAL_KEY
        HapticFeedbackType.LONG_PRESS -> HapticFeedbackConstants.LONG_PRESS
        HapticFeedbackType.CONFIRM -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            HapticFeedbackConstants.CONFIRM
        } else {
            HapticFeedbackConstants.VIRTUAL_KEY
        }
        HapticFeedbackType.REJECT -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            HapticFeedbackConstants.REJECT
        } else {
            HapticFeedbackConstants.VIRTUAL_KEY
        }
        else -> HapticFeedbackConstants.VIRTUAL_KEY
    }

    performHapticFeedback(constant)
}

/**
 * Composable helper pour déclencher un feedback haptique
 */
@Composable
fun rememberHapticFeedbackPerformer(): (HapticFeedbackType) -> Unit {
    val view = LocalView.current
    val hapticHelper = rememberHapticFeedback()

    return remember(view, hapticHelper) {
        { type ->
            // Essayer d'abord le feedback système
            try {
                view.performSystemHapticFeedback(type)
            } catch (e: Exception) {
                // Si le feedback système échoue, utiliser notre implémentation
                hapticHelper.performHapticFeedback(type)
            }
        }
    }
}

/**
 * Patterns de vibration prédéfinis
 */
object HapticPatterns {
    val SUCCESS = longArrayOf(0, 50, 50, 50)
    val ERROR = longArrayOf(0, 50, 50, 50, 50, 50)
    val WARNING = longArrayOf(0, 100, 50, 100)
    val NOTIFICATION = longArrayOf(0, 100, 100, 100)
    val DOUBLE_CLICK = longArrayOf(0, 30, 30, 30)
    val TRIPLE_CLICK = longArrayOf(0, 30, 30, 30, 30, 30)
}

/**
 * Intensités de vibration
 */
object HapticIntensity {
    const val LIGHT = 50
    const val MEDIUM = 100
    const val STRONG = 200
    const val MAX = 255
}
