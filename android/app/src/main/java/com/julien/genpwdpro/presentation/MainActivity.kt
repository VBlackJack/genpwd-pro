package com.julien.genpwdpro.presentation

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.julien.genpwdpro.presentation.screens.GeneratorScreen
import com.julien.genpwdpro.presentation.theme.GenPwdProTheme
import dagger.hilt.android.AndroidEntryPoint

/**
 * Activité principale de l'application
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            GenPwdProTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    GeneratorScreen()
                }
            }
        }
    }
}
