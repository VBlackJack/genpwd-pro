package com.julien.genpwdpro.presentation.widget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class UserUnlockedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (Intent.ACTION_USER_UNLOCKED == intent?.action) {
            PasswordWidget.handleUserUnlocked(context)
        }
    }
}
