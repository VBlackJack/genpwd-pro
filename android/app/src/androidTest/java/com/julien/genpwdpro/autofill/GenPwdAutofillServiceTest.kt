package com.julien.genpwdpro.autofill

import android.app.assist.AssistStructure
import android.content.ComponentName
import android.os.CancellationSignal
import android.service.autofill.FillCallback
import android.service.autofill.FillContext
import android.service.autofill.FillRequest
import android.service.autofill.FillResponse
import android.view.View
import android.view.autofill.AutofillId
import androidx.test.core.app.ServiceScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.julien.genpwdpro.autofill.AutofillRepository
import com.julien.genpwdpro.data.models.PasswordResult
import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.domain.usecases.GeneratePasswordUseCase
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.flow.flowOf
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class GenPwdAutofillServiceTest {

    @Test
    fun generatedResponseIsMinimal() {
        val scenario = ServiceScenario.launch(GenPwdAutofillService::class.java)
        try {
            scenario.onService { service ->
                val settings = Settings(quantity = 1)
                val generateUseCase = mockk<GeneratePasswordUseCase>()
                val repository = mockk<AutofillRepository>()

                service.generatePasswordUseCase = generateUseCase
                service.autofillRepository = repository

                coEvery { generateUseCase.invoke(any()) } returns listOf(
                    PasswordResult(
                        password = "S3cure!Pass",
                        entropy = 90.0,
                        mode = settings.mode,
                        settings = settings,
                        isMasked = false
                    )
                )
                every { repository.isVaultUnlocked() } returns true
                every { repository.findMatchingEntries(any()) } returns flowOf(emptyList())
                every { repository.getSettings() } returns flowOf(settings)

                val (request, _) = buildFillRequest(windowPackage = TEST_PACKAGE)
                val callback = RecordingFillCallback()

                service.onFillRequest(request, CancellationSignal(), callback)

                assertTrue(callback.await(), "Autofill callback timed out")
                val response = callback.result
                requireNotNull(response)

                val datasets = response.datasetsList()
                assertEquals(1, datasets.size, "Only one generated dataset should be returned")
            }
        } finally {
            scenario.close()
        }
    }

    @Test
    fun mismatchedPackageYieldsNoResponse() {
        val scenario = ServiceScenario.launch(GenPwdAutofillService::class.java)
        try {
            scenario.onService { service ->
                val generateUseCase = mockk<GeneratePasswordUseCase>()
                val repository = mockk<AutofillRepository>()
                val settings = Settings(quantity = 1)

                service.generatePasswordUseCase = generateUseCase
                service.autofillRepository = repository

                every { repository.isVaultUnlocked() } returns true
                every { repository.findMatchingEntries(any()) } returns flowOf(emptyList())
                every { repository.getSettings() } returns flowOf(settings)
                coEvery { generateUseCase.invoke(any()) } returns emptyList()

                val (request, _) = buildFillRequest(
                    windowPackage = "com.webview.host",
                    componentPackage = TEST_PACKAGE
                )
                val callback = RecordingFillCallback()

                service.onFillRequest(request, CancellationSignal(), callback)

                assertTrue(callback.await(), "Autofill callback timed out")
                assertNull(callback.result, "No response should be provided when package names differ")
                assertNull(callback.failure)
            }
        } finally {
            scenario.close()
        }
    }

    @Test
    fun failureDoesNotExposeSensitiveMessage() {
        val scenario = ServiceScenario.launch(GenPwdAutofillService::class.java)
        try {
            scenario.onService { service ->
                val generateUseCase = mockk<GeneratePasswordUseCase>()
                val repository = mockk<AutofillRepository>()
                val settings = Settings(quantity = 1)

                service.generatePasswordUseCase = generateUseCase
                service.autofillRepository = repository

                every { repository.isVaultUnlocked() } returns true
                every { repository.findMatchingEntries(any()) } returns flowOf(emptyList())
                every { repository.getSettings() } returns flowOf(settings)
                coEvery { generateUseCase.invoke(any()) } throws IllegalStateException("Sensitive stack trace")

                val (request, _) = buildFillRequest(windowPackage = TEST_PACKAGE)
                val callback = RecordingFillCallback()

                service.onFillRequest(request, CancellationSignal(), callback)

                assertTrue(callback.await(), "Autofill callback timed out")
                assertNull(callback.result)
                assertNull(callback.failure)
            }
        } finally {
            scenario.close()
        }
    }

    private fun buildFillRequest(
        windowPackage: String,
        componentPackage: String = windowPackage,
        hints: Array<String> = arrayOf(View.AUTOFILL_HINT_PASSWORD)
    ): Pair<FillRequest, AutofillId> {
        val autofillId = mockk<AutofillId>(relaxed = true)
        val passwordNode = mockk<AssistStructure.ViewNode>(relaxed = true) {
            every { autofillHints } returns hints
            every { autofillId } returns autofillId
            every { idEntry } returns "password"
            every { className } returns "android.widget.EditText"
            every { childCount } returns 0
            every { inputType } returns android.text.InputType.TYPE_CLASS_TEXT or
                android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
            every { autofillType } returns AssistStructure.ViewNode.AUTOFILL_TYPE_TEXT
        }
        val rootNode = mockk<AssistStructure.ViewNode>(relaxed = true) {
            every { childCount } returns 1
            every { getChildAt(0) } returns passwordNode
            every { autofillId } returns mockk(relaxed = true)
            every { className } returns "android.widget.LinearLayout"
            every { autofillType } returns AssistStructure.ViewNode.AUTOFILL_TYPE_LIST
            every { idPackage } returns windowPackage
        }
        val windowNode = mockk<AssistStructure.WindowNode>(relaxed = true) {
            every { rootViewNode } returns rootNode
        }
        val componentName = ComponentName(componentPackage, "DummyActivity")
        val structure = mockk<AssistStructure>(relaxed = true) {
            every { windowNodeCount } returns 1
            every { getWindowNodeAt(0) } returns windowNode
            every { activityComponent } returns componentName
        }
        val fillContext = mockk<FillContext>(relaxed = true) {
            every { structure } returns structure
        }
        val request = mockk<FillRequest>(relaxed = true) {
            every { fillContexts } returns listOf(fillContext)
        }
        return request to autofillId
    }

    private class RecordingFillCallback : FillCallback() {
        private val latch = CountDownLatch(1)
        var result: FillResponse? = null
        var failure: CharSequence? = null

        override fun onSuccess(response: FillResponse?) {
            result = response
            latch.countDown()
        }

        override fun onFailure(message: CharSequence?) {
            failure = message
            latch.countDown()
        }

        fun await(): Boolean = latch.await(3, TimeUnit.SECONDS)
    }

    private fun FillResponse.datasetsList(): List<Any?> {
        val field = FillResponse::class.java.getDeclaredField("mDatasets")
        field.isAccessible = true
        @Suppress("UNCHECKED_CAST")
        return (field.get(this) as? List<Any?>).orEmpty()
    }

    companion object {
        private const val TEST_PACKAGE = "com.julien.genpwdpro.test"
    }
}
