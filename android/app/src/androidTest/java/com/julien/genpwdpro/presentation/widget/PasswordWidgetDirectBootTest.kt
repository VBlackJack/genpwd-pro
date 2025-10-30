package com.julien.genpwdpro.presentation.widget

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Ignore
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PasswordWidgetDirectBootTest {

    @Test
    @Ignore(
        "TODO: validate widget behaviour under Direct Boot lock state once device emulation is wired"
    )
    fun widgetShowsPlaceholderWhileDeviceLocked() {
        // Placeholder: will assert widget hides secrets when the user storage is locked.
    }

    @Test
    @Ignore("TODO: verify widget refresh after unlock and stored password retrieval")
    fun widgetRefreshesSecretsAfterUnlock() {
        // Placeholder: will unlock device storage and assert widget refreshes last password safely.
    }
}
