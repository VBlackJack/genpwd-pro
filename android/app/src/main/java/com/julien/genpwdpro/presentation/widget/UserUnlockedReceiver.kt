package com.julien.genpwdpro.presentation.widget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.julien.genpwdpro.core.ipc.IntentSanitizer

class UserUnlockedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        intent?.extras?.let { extras ->
            IntentSanitizer.sanitize(extras, intent)
        }

        if (Intent.ACTION_USER_UNLOCKED == intent?.action) {
            PasswordWidget.handleUserUnlocked(context)
        }
    }
}
