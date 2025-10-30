package com.julien.genpwdpro.presentation.otp

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.Barcode
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import com.julien.genpwdpro.R
import com.julien.genpwdpro.domain.otp.OtpConfig
import com.julien.genpwdpro.domain.otp.OtpUriMigrationNotSupportedException
import com.julien.genpwdpro.domain.otp.OtpUriParser
import com.julien.genpwdpro.domain.otp.OtpUriParserException
import com.julien.genpwdpro.presentation.security.SecureBaseActivity
import java.io.IOException
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

@Suppress("TooManyFunctions") // Activity coordinates camera, gallery, and manual flows in a single lifecycle scope.
class OtpQrScannerActivity : SecureBaseActivity() {

    private lateinit var previewView: PreviewView
    private lateinit var actionsContainer: View
    private lateinit var confirmationContainer: View
    private lateinit var statusText: TextView
    private lateinit var issuerInput: EditText
    private lateinit var labelInput: EditText
    private lateinit var secretView: TextView
    private lateinit var confirmButton: Button
    private lateinit var rescanButton: Button
    private lateinit var galleryButton: View
    private lateinit var pasteButton: View

    private val parser = OtpUriParser()
    private val barcodeScanner by lazy {
        val options = BarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build()
        BarcodeScanning.getClient(options)
    }
    private var cameraProvider: ProcessCameraProvider? = null
    private val cameraExecutor = Executors.newSingleThreadExecutor()
    private val processingFrame = AtomicBoolean(false)
    private val isScanningActive = AtomicBoolean(true)
    private val lastDetectionTime = AtomicLong(0L)
    private var currentResult: OtpConfig? = null
    private var permissionRequested = false

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            startCamera()
        } else {
            showPermissionDeniedDialog()
        }
    }

    private val galleryLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            handleGalleryUri(uri)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        secureSensitiveContent(true)
        setContentView(R.layout.activity_otp_qr_scanner)
        setResult(Activity.RESULT_CANCELED)

        bindViews()
        setupInteractions()
    }

    override fun onResume() {
        super.onResume()
        if (hasCameraPermission()) {
            startCamera()
        } else if (!permissionRequested) {
            permissionRequested = true
            requestCameraPermission()
        }
    }

    override fun onPause() {
        super.onPause()
        stopCameraPreview()
    }

    override fun onDestroy() {
        super.onDestroy()
        stopCameraPreview()
        barcodeScanner.close()
        cameraExecutor.shutdown()
    }

    private fun bindViews() {
        previewView = findViewById(R.id.previewView)
        actionsContainer = findViewById(R.id.actionsContainer)
        confirmationContainer = findViewById(R.id.confirmationContainer)
        statusText = findViewById(R.id.statusText)
        issuerInput = findViewById(R.id.issuerInput)
        labelInput = findViewById(R.id.labelInput)
        secretView = findViewById(R.id.secretValue)
        confirmButton = findViewById(R.id.confirmButton)
        rescanButton = findViewById(R.id.rescanButton)
        galleryButton = findViewById(R.id.galleryButton)
        pasteButton = findViewById(R.id.pasteButton)
        statusText.setText(R.string.otp_scanner_title)
    }

    private fun setupInteractions() {
        findViewById<ImageButton>(R.id.backButton).setOnClickListener {
            finish()
        }
        galleryButton.setOnClickListener { launchGallery() }
        pasteButton.setOnClickListener { showPasteDialog() }
        confirmButton.setOnClickListener { confirmCurrentResult() }
        rescanButton.setOnClickListener { resetScanner() }
    }

    private fun hasCameraPermission(): Boolean {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
    }

    private fun requestCameraPermission() {
        if (shouldShowRequestPermissionRationale(Manifest.permission.CAMERA)) {
            showRationaleDialog()
        } else {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun showRationaleDialog() {
        val dialog = AlertDialog.Builder(this)
            .setTitle(R.string.otp_permission_rationale_title)
            .setMessage(R.string.otp_permission_rationale)
            .setPositiveButton(android.R.string.ok) { dialogInterface, _ ->
                dialogInterface.dismiss()
                permissionLauncher.launch(Manifest.permission.CAMERA)
            }
            .setNegativeButton(R.string.otp_manual_entry_cancel) { dialogInterface, _ ->
                dialogInterface.dismiss()
            }
            .show()
        secureScreenDelegate.secureDialog(dialog)
    }

    private fun showPermissionDeniedDialog() {
        val dialog = AlertDialog.Builder(this)
            .setMessage(R.string.otp_permission_denied)
            .setPositiveButton(R.string.otp_scanner_gallery) { dialogInterface, _ ->
                dialogInterface.dismiss()
                launchGallery()
            }
            .setNegativeButton(R.string.otp_scanner_paste) { dialogInterface, _ ->
                dialogInterface.dismiss()
                showPasteDialog()
            }
            .setNeutralButton(R.string.otp_permission_settings) { dialogInterface, _ ->
                dialogInterface.dismiss()
                openAppSettings()
            }
            .show()
        secureScreenDelegate.secureDialog(dialog)
    }

    private fun openAppSettings() {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", packageName, null)
        }
        startActivity(intent)
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            try {
                val provider = cameraProviderFuture.get()
                bindCamera(provider)
            } catch (error: Exception) {
                showError(getString(R.string.otp_camera_unavailable))
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun bindCamera(provider: ProcessCameraProvider) {
        cameraProvider = provider
        val preview = Preview.Builder().build().also {
            it.setSurfaceProvider(
                previewView.surfaceProvider
            )
        }
        val analysis = ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()
            .apply {
                setAnalyzer(cameraExecutor, ::analyzeImage)
            }

        try {
            provider.unbindAll()
            provider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)
        } catch (error: Exception) {
            showError(getString(R.string.otp_camera_unavailable))
        }
    }

    private fun analyzeImage(imageProxy: ImageProxy) {
        if (!isScanningActive.get()) {
            imageProxy.close()
            return
        }
        if (!processingFrame.compareAndSet(false, true)) {
            imageProxy.close()
            return
        }
        val elapsed = SystemClock.elapsedRealtime() - lastDetectionTime.get()
        if (elapsed < MIN_DETECTION_INTERVAL_MS) {
            processingFrame.set(false)
            imageProxy.close()
            return
        }
        val mediaImage = imageProxy.image
        if (mediaImage == null) {
            processingFrame.set(false)
            imageProxy.close()
            return
        }
        val rotation = imageProxy.imageInfo.rotationDegrees
        val image = InputImage.fromMediaImage(mediaImage, rotation)
        barcodeScanner.process(image)
            .addOnSuccessListener { barcodes ->
                for (barcode in barcodes) {
                    if (!isScanningActive.get()) {
                        break
                    }
                    val handled = handleBarcode(barcode)
                    if (handled) {
                        lastDetectionTime.set(SystemClock.elapsedRealtime())
                        break
                    }
                }
            }
            .addOnFailureListener {
                showError(getString(R.string.otp_scan_generic_error))
            }
            .addOnCompleteListener {
                imageProxy.close()
                processingFrame.set(false)
            }
    }

    private fun handleBarcode(barcode: Barcode): Boolean {
        val value = barcode.rawValue ?: return false
        if (!value.lowercase(Locale.US).startsWith(OTP_URI_PREFIX)) {
            return false
        }
        val uri = try {
            Uri.parse(value)
        } catch (_: Exception) {
            showError(getString(R.string.otp_scan_generic_error))
            return false
        }
        return try {
            val config = parser.parse(uri)
            onOtpDetected(config)
            true
        } catch (error: OtpUriParserException) {
            showError(resolveErrorMessage(error))
            false
        }
    }

    private fun onOtpDetected(config: OtpConfig) {
        isScanningActive.set(false)
        currentResult = config
        runOnUiThread {
            stopCameraPreview()
            showConfirmation(config)
        }
    }

    private fun showConfirmation(config: OtpConfig) {
        actionsContainer.visibility = View.GONE
        confirmationContainer.visibility = View.VISIBLE
        statusText.setText(R.string.otp_confirmation_title)
        issuerInput.setText(config.issuer.orEmpty())
        labelInput.setText(config.label.orEmpty())
        secretView.text = getString(
            R.string.otp_confirmation_secret_masked,
            maskSecret(config.secret)
        )
    }

    private fun resetScanner() {
        currentResult = null
        confirmationContainer.visibility = View.GONE
        actionsContainer.visibility = View.VISIBLE
        statusText.setText(R.string.otp_scanner_title)
        isScanningActive.set(true)
        lastDetectionTime.set(0L)
        if (hasCameraPermission()) {
            startCamera()
        }
    }

    private fun confirmCurrentResult() {
        val result = currentResult ?: return
        val issuer = issuerInput.text?.toString()?.trim().takeUnless { it.isNullOrEmpty() }
        val label = labelInput.text?.toString()?.trim().takeUnless { it.isNullOrEmpty() }
        val sanitized = result.copy(issuer = issuer, label = label)
        val intent = Intent().apply {
            putExtra(OtpImportActivity.EXTRA_OTP_CONFIG, sanitized)
        }
        setResult(Activity.RESULT_OK, intent)
        finish()
    }

    private fun launchGallery() {
        galleryLauncher.launch("image/*")
    }

    private fun handleGalleryUri(uri: Uri) {
        try {
            contentResolver.openInputStream(uri)?.use { inputStream ->
                val bitmap = BitmapFactory.decodeStream(inputStream)
                if (bitmap == null) {
                    showError(getString(R.string.otp_gallery_error))
                    return
                }
                try {
                    processStaticImage(bitmap)
                } finally {
                    bitmap.recycle()
                }
            } ?: showError(getString(R.string.otp_gallery_error))
        } catch (_: IOException) {
            showError(getString(R.string.otp_gallery_error))
        } catch (_: SecurityException) {
            showError(getString(R.string.otp_gallery_error))
        }
    }

    private fun processStaticImage(bitmap: android.graphics.Bitmap) {
        val image = InputImage.fromBitmap(bitmap, 0)
        barcodeScanner.process(image)
            .addOnSuccessListener { barcodes ->
                for (barcode in barcodes) {
                    val handled = handleBarcode(barcode)
                    if (handled) {
                        break
                    }
                }
            }
            .addOnFailureListener {
                showError(getString(R.string.otp_scan_generic_error))
            }
    }

    private fun showPasteDialog() {
        val view = LayoutInflater.from(this).inflate(R.layout.dialog_paste_input, null)
        val inputField = view.findViewById<EditText>(R.id.pasteInput)
        val dialog = AlertDialog.Builder(this)
            .setTitle(R.string.otp_manual_entry_title)
            .setView(view)
            .setPositiveButton(R.string.otp_manual_entry_action) { dialogInterface, _ ->
                dialogInterface.dismiss()
                val text = inputField.text?.toString()?.trim()
                if (!text.isNullOrEmpty()) {
                    handleManualUri(text)
                } else {
                    showError(getString(R.string.otp_manual_entry_invalid))
                }
            }
            .setNegativeButton(R.string.otp_manual_entry_cancel) { dialogInterface, _ ->
                dialogInterface.dismiss()
            }
            .show()
        secureScreenDelegate.secureDialog(dialog)
    }

    private fun handleManualUri(value: String) {
        val uri = try {
            Uri.parse(value)
        } catch (_: Exception) {
            showError(getString(R.string.otp_manual_entry_invalid))
            return
        }
        if (uri.scheme.isNullOrEmpty()) {
            showError(getString(R.string.otp_manual_entry_invalid))
            return
        }
        try {
            val config = parser.parse(uri)
            onOtpDetected(config)
        } catch (error: OtpUriParserException) {
            showError(resolveErrorMessage(error))
        }
    }

    private fun resolveErrorMessage(error: OtpUriParserException): String {
        return when (error) {
            is OtpUriMigrationNotSupportedException -> getString(
                R.string.otp_migration_not_supported
            )
            else -> getString(R.string.otp_import_error)
        }
    }

    private fun maskSecret(secret: String): String {
        if (secret.isEmpty()) {
            return "••••"
        }
        val visible = secret.take(2)
        return "$visible••••"
    }

    private fun stopCameraPreview() {
        cameraProvider?.unbindAll()
    }

    private fun showError(message: String) {
        runOnUiThread {
            if (!isFinishing) {
                Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
            }
        }
    }

    companion object {
        private const val MIN_DETECTION_INTERVAL_MS = 1200L
        private const val OTP_URI_PREFIX = "otpauth"
    }
}
