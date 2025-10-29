package com.julien.genpwdpro.presentation.otp

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import com.julien.genpwdpro.R
import com.julien.genpwdpro.domain.otp.OtpConfig
import com.julien.genpwdpro.domain.otp.OtpUriMigrationNotSupportedException
import com.julien.genpwdpro.domain.otp.OtpUriParser
import com.julien.genpwdpro.domain.otp.OtpUriParserException
import com.julien.genpwdpro.presentation.security.SecureBaseActivity

class OtpImportActivity : SecureBaseActivity() {

    private val parser = OtpUriParser()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        secureSensitiveContent(true)
        setResult(Activity.RESULT_CANCELED)
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        val dataUri = intent?.data
        if (dataUri == null) {
            finishWithError(getString(R.string.otp_import_error))
            return
        }
        processUri(dataUri)
    }

    private fun processUri(uri: Uri) {
        try {
            val config = parser.parse(uri)
            finishWithSuccess(config)
        } catch (error: OtpUriParserException) {
            finishWithError(resolveErrorMessage(error))
        }
    }

    private fun finishWithSuccess(config: OtpConfig) {
        val resultIntent = Intent().apply {
            putExtra(EXTRA_OTP_CONFIG, config)
        }
        setResult(Activity.RESULT_OK, resultIntent)
        finish()
    }

    private fun finishWithError(message: String) {
        val resultIntent = Intent().apply {
            putExtra(EXTRA_OTP_ERROR, message)
        }
        setResult(Activity.RESULT_CANCELED, resultIntent)
        finish()
    }

    private fun resolveErrorMessage(error: OtpUriParserException): String {
        return when (error) {
            is OtpUriMigrationNotSupportedException -> getString(R.string.otp_migration_not_supported)
            else -> getString(R.string.otp_import_error)
        }
    }

    companion object {
        const val EXTRA_OTP_CONFIG = "com.julien.genpwdpro.extra.OTP_CONFIG"
        const val EXTRA_OTP_ERROR = "com.julien.genpwdpro.extra.OTP_ERROR"
    }
}
