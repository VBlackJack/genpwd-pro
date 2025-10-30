package com.julien.genpwdpro.autofill

import android.app.assist.AssistStructure
import android.content.ComponentName
import android.os.CancellationSignal
import android.service.autofill.Dataset
import android.service.autofill.FillCallback
import android.service.autofill.FillContext
import android.service.autofill.FillRequest
import android.service.autofill.FillResponse
import android.util.Log
import android.view.View
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import androidx.test.core.app.ServiceScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.julien.genpwdpro.data.models.PasswordResult
import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.domain.usecases.GeneratePasswordUseCase
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.unmockkStatic
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

                val (request, passwordId) = buildFillRequest(windowPackage = TEST_PACKAGE)
                val callback = RecordingFillCallback()

                service.onFillRequest(request, CancellationSignal(), callback)

                assertTrue(callback.await(), "Autofill callback timed out")
                val response = callback.result
                requireNotNull(response)

                val datasets = response.datasetsList()
                assertEquals(1, datasets.size, "Only one generated dataset should be returned")
                val dataset = datasets.single() as Dataset
                val valueMap = dataset.valueMap()
                assertEquals(
                    setOf(passwordId),
                    valueMap.keys,
                    "Dataset must target the detected password field only"
                )
                val autofillValue = valueMap[passwordId]
                requireNotNull(autofillValue)
                assertTrue(autofillValue.isText)
                assertEquals("S3cure!Pass", autofillValue.textValue.toString())
            }
        } finally {
            scenario.close()
        }
    }

    @Test
    fun noSensitiveDataLoggedDuringAutofill() {
        mockkStatic(Log::class)
        val loggedMessages = mutableListOf<String>()

        fun recordMessage(arg: Any?) {
            if (arg is String && arg.isNotBlank()) {
                loggedMessages += arg
            }
        }

        try {
            every { Log.d(any(), any<String>()) } answers { recordMessage(secondArg()); 0 }
            every { Log.d(any(), any<String>(), any()) } answers { recordMessage(secondArg()); 0 }
            every { Log.i(any(), any<String>()) } answers { recordMessage(secondArg()); 0 }
            every { Log.i(any(), any<String>(), any()) } answers { recordMessage(secondArg()); 0 }
            every { Log.w(any(), any<String>()) } answers { recordMessage(secondArg()); 0 }
            every { Log.w(any(), any<String>(), any()) } answers { recordMessage(secondArg()); 0 }
            every { Log.w(any(), any<Throwable>()) } returns 0
            every { Log.e(any(), any<String>()) } answers { recordMessage(secondArg()); 0 }
            every { Log.e(any(), any<String>(), any()) } answers { recordMessage(secondArg()); 0 }
            every { Log.e(any(), any<Throwable>()) } returns 0
            every { Log.v(any(), any<String>()) } answers { recordMessage(secondArg()); 0 }
            every { Log.v(any(), any<String>(), any()) } answers { recordMessage(secondArg()); 0 }

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
                            password = "UltraSecret#123",
                            entropy = 95.0,
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
                }
            } finally {
                scenario.close()
            }

            assertTrue(
                loggedMessages.isEmpty() || loggedMessages.none { it.contains("UltraSecret#123") }
            ) {
                "Sensitive autofill data leaked to logs: $loggedMessages"
            }
        } finally {
            unmockkStatic(Log::class)
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
                assertNull(
                    callback.result,
                    "No response should be provided when package names differ"
                )
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
                coEvery { generateUseCase.invoke(any()) } throws IllegalStateException(
                    "Sensitive stack trace"
                )

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

    private fun Dataset.valueMap(): Map<AutofillId, AutofillValue?> {
        val idField = Dataset::class.java.getDeclaredField("mFieldIds")
        val valueField = Dataset::class.java.getDeclaredField("mFieldValues")
        idField.isAccessible = true
        valueField.isAccessible = true

        val ids = (idField.get(this) as? Array<AutofillId?>) ?: emptyArray()
        val values = (valueField.get(this) as? Array<AutofillValue?>) ?: emptyArray()

        return ids.mapIndexedNotNull { index, id ->
            val value = values.getOrNull(index)
            if (id != null) id to value else null
        }.toMap()
    }

    companion object {
        private const val TEST_PACKAGE = "com.julien.genpwdpro.test"
    }
}
