package com.julien.genpwdpro.presentation.otp

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.util.AttributeSet
import android.view.View
import kotlin.math.min

class ScannerOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private val scrimPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = SCRIM_COLOR
        style = Paint.Style.FILL
    }

    private val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = BORDER_WIDTH_DP * resources.displayMetrics.density
    }

    private val path = Path()
    private val rect = RectF()
    private val cornerRadius = CORNER_RADIUS_DP * resources.displayMetrics.density

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val width = width.toFloat()
        val height = height.toFloat()
        if (width == 0f || height == 0f) {
            return
        }
        val overlayWidth = width * 0.75f
        val overlayHeight = min(height * 0.5f, overlayWidth)
        val left = (width - overlayWidth) / 2f
        val top = (height - overlayHeight) / 2f
        val right = left + overlayWidth
        val bottom = top + overlayHeight
        rect.set(left, top, right, bottom)

        path.reset()
        path.fillType = Path.FillType.EVEN_ODD
        path.addRect(0f, 0f, width, height, Path.Direction.CW)
        path.addRoundRect(rect, cornerRadius, cornerRadius, Path.Direction.CCW)

        canvas.drawPath(path, scrimPaint)
        canvas.drawRoundRect(rect, cornerRadius, cornerRadius, borderPaint)
    }

    companion object {
        private const val BORDER_WIDTH_DP = 2f
        private const val CORNER_RADIUS_DP = 32f
        private const val SCRIM_ALPHA = 0xB0
        private val SCRIM_COLOR = Color.argb(SCRIM_ALPHA, 0, 0, 0)
    }
}
