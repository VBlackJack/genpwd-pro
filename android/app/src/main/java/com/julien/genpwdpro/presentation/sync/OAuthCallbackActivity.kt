package com.julien.genpwdpro.presentation.sync

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import com.genpwd.corevault.ProviderKind
import com.genpwd.provider.drive.OAuth2GoogleDriveAuthProvider
import com.genpwd.storage.CloudAccountRepository
import com.genpwd.sync.ProviderRegistry
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.presentation.theme.GenPwdProTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Activity that handles OAuth callback redirects from cloud providers.
 *
 * This activity is invoked when the OAuth flow completes and the browser
 * redirects back to the app with the authorization code.
 *
 * URL format: com.julien.genpwdpro://oauth2callback?code=...&state=...
 */
@AndroidEntryPoint
class OAuthCallbackActivity : ComponentActivity() {

    @Inject
    lateinit var cloudAccountRepository: CloudAccountRepository

    @Inject
    lateinit var googleDriveAuthProvider: OAuth2GoogleDriveAuthProvider

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val uri = intent.data
        if (uri == null) {
            finishWithError("No callback data received")
            return
        }

        handleOAuthCallback(uri)
    }

    private fun handleOAuthCallback(uri: Uri) {
        val authCode = uri.getQueryParameter("code")
        val state = uri.getQueryParameter("state")
        val error = uri.getQueryParameter("error")

        when {
            error != null -> {
                val errorDescription = uri.getQueryParameter("error_description")
                finishWithError("OAuth error: $error - $errorDescription")
            }
            authCode != null && state != null -> {
                processAuthorizationCode(authCode, state)
            }
            else -> {
                finishWithError("Invalid OAuth callback")
            }
        }
    }

    private fun processAuthorizationCode(authCode: String, state: String) {
        setContent {
            GenPwdProTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    ProcessingScreen(
                        onComplete = { success, message ->
                            if (success) {
                                finishWithSuccess()
                            } else {
                                finishWithError(message)
                            }
                        }
                    )
                }
            }
        }

        lifecycleScope.launch {
            try {
                SafeLog.d(TAG, "Processing OAuth callback with state: $state")

                // Extract provider kind from state parameter
                // Format: "PROVIDER_KIND:random_state"
                val providerKind = try {
                    val parts = state.split(":", limit = 2)
                    if (parts.isEmpty()) {
                        throw IllegalArgumentException("Invalid state parameter")
                    }
                    ProviderKind.valueOf(parts[0])
                } catch (e: Exception) {
                    SafeLog.e(TAG, "Failed to parse provider kind from state", e)
                    throw IllegalArgumentException("Invalid state parameter: ${e.message}")
                }

                SafeLog.d(TAG, "Provider kind: $providerKind")

                // Currently only Google Drive is implemented
                if (providerKind != ProviderKind.GOOGLE_DRIVE) {
                    throw IllegalStateException("OAuth not implemented for $providerKind")
                }

                SafeLog.d(TAG, "Exchanging authorization code for tokens...")

                // Exchange authorization code for tokens using PKCE
                val tokens = googleDriveAuthProvider.completeAuthentication(state, authCode)

                SafeLog.d(TAG, "Token exchange successful, saving account...")

                // Save account to database
                // TODO: Encrypt tokens before storage
                val account = cloudAccountRepository.saveAccount(
                    kind = providerKind,
                    displayName = tokens.email ?: "Google Drive Account",
                    email = tokens.email,
                    accessToken = tokens.accessToken,
                    refreshToken = tokens.refreshToken,
                    expiresIn = tokens.expiresIn
                )

                SafeLog.d(TAG, "Account saved successfully with ID: ${account.id}")
                finishWithSuccess()
            } catch (e: Exception) {
                SafeLog.e(TAG, "Failed to complete OAuth", e)
                finishWithError("Failed to complete OAuth: ${e.message}")
            }
        }
    }

    companion object {
        private const val TAG = "OAuthCallbackActivity"
    }

    private fun finishWithSuccess() {
        val resultIntent = Intent().apply {
            putExtra("success", true)
        }
        setResult(RESULT_OK, resultIntent)
        finish()
    }

    private fun finishWithError(message: String) {
        val resultIntent = Intent().apply {
            putExtra("success", false)
            putExtra("error", message)
        }
        setResult(RESULT_CANCELED, resultIntent)
        finish()
    }
}

@Composable
private fun ProcessingScreen(
    onComplete: (success: Boolean, message: String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        CircularProgressIndicator()
        Spacer(modifier = Modifier.height(24.dp))
        Text(
            text = "Completing authentication...",
            style = MaterialTheme.typography.titleMedium
        )
        Text(
            text = "Please wait while we finish setting up your account",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
