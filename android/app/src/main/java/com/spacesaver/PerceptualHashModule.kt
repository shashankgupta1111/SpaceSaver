package com.spacesaver

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.io.InputStream

/**
 * Computes perceptual hashes (aHash + dHash) for a batch of images so the JS
 * layer can cluster exact duplicates and near-duplicates (bursts, edits, resaves).
 *
 * Decoding happens natively via BitmapFactory: it is memory-safe (downsampled
 * with inSampleSize), fast, and works uniformly for content:// and file:// URIs
 * across JPEG / PNG / HEIC — none of which are practical to decode in pure JS.
 *
 * Each hash is a 64-bit value encoded as 16 hex chars. Two images are compared
 * in JS by Hamming distance over these bits.
 */
class PerceptualHashModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "PerceptualHash"

    /**
     * @param uris   list of image URIs (content:// or file://)
     * Resolves with an array of { uri, aHash, dHash, width, height } objects.
     * Any image that fails to decode resolves with { uri, error } instead of
     * aborting the whole batch.
     */
    @ReactMethod
    fun hashImages(uris: ReadableArray, promise: Promise) {
        // Run off the native-modules queue so a large scan never blocks other bridge calls.
        Thread {
            try {
                val out: WritableArray = Arguments.createArray()
                for (i in 0 until uris.size()) {
                    val uri = uris.getString(i) ?: continue
                    out.pushMap(hashOne(uri))
                }
                promise.resolve(out)
            } catch (e: Exception) {
                promise.reject("HASH_ERROR", e.message, e)
            }
        }.start()
    }

    private fun hashOne(uri: String): WritableMap {
        val map = Arguments.createMap()
        map.putString("uri", uri)
        try {
            // 1. Read bounds to pick a sane downsample factor (cap the decoded edge ~256px).
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            openStream(uri).use { BitmapFactory.decodeStream(it, null, bounds) }
            val srcW = bounds.outWidth
            val srcH = bounds.outHeight
            if (srcW <= 0 || srcH <= 0) {
                map.putString("error", "undecodable")
                return map
            }

            val opts = BitmapFactory.Options().apply {
                inSampleSize = sampleSize(srcW, srcH, 256)
            }
            val decoded = openStream(uri).use { BitmapFactory.decodeStream(it, null, opts) }
            if (decoded == null) {
                map.putString("error", "decode_failed")
                return map
            }

            // 2. aHash + average colour from an 8x8, dHash from a 9x8.
            //    Perceptual hashes are blind to absolute colour (a solid red and a
            //    solid blue hash identically), so we also carry the mean RGB. JS uses
            //    it to stop low-detail/flat images from being wrongly grouped.
            val small = Bitmap.createScaledBitmap(decoded, 8, 8, true)
            val px = IntArray(64)
            small.getPixels(px, 0, 8, 0, 0, 8, 8)
            small.recycle()
            val a = luminance(px)

            val d = grayscale(Bitmap.createScaledBitmap(decoded, 9, 8, true), 9, 8)
            decoded.recycle()

            var sr = 0
            var sg = 0
            var sb = 0
            for (p in px) {
                sr += (p shr 16) and 0xFF
                sg += (p shr 8) and 0xFF
                sb += p and 0xFF
            }
            map.putString("aHash", aHash(a))
            map.putString("dHash", dHash(d, 9, 8))
            map.putInt("avgR", sr / 64)
            map.putInt("avgG", sg / 64)
            map.putInt("avgB", sb / 64)
            map.putInt("width", srcW)
            map.putInt("height", srcH)
        } catch (e: OutOfMemoryError) {
            map.putString("error", "oom")
        } catch (e: Exception) {
            map.putString("error", e.message ?: "unknown")
        }
        return map
    }

    private fun openStream(uri: String): InputStream {
        return if (uri.startsWith("content://")) {
            reactApplicationContext.contentResolver.openInputStream(Uri.parse(uri))
                ?: throw IllegalStateException("null stream")
        } else {
            val path = if (uri.startsWith("file://")) uri.substring(7) else uri
            java.io.FileInputStream(path)
        }
    }

    private fun sampleSize(w: Int, h: Int, target: Int): Int {
        var sample = 1
        var longEdge = maxOf(w, h)
        while (longEdge / 2 >= target) {
            longEdge /= 2
            sample *= 2
        }
        return sample
    }

    /** Converts a scaled bitmap into a row-major array of luminance values. */
    private fun grayscale(bmp: Bitmap, w: Int, h: Int): IntArray {
        val pixels = IntArray(w * h)
        bmp.getPixels(pixels, 0, w, 0, 0, w, h)
        bmp.recycle()
        return luminance(pixels)
    }

    /** Integer luminance approximation (0.299/0.587/0.114) per pixel. */
    private fun luminance(pixels: IntArray): IntArray {
        val lum = IntArray(pixels.size)
        for (i in pixels.indices) {
            val p = pixels[i]
            val r = (p shr 16) and 0xFF
            val g = (p shr 8) and 0xFF
            val b = p and 0xFF
            lum[i] = (r * 77 + g * 150 + b * 29) shr 8
        }
        return lum
    }

    /** Average hash: bit set when the pixel is brighter than the frame average. */
    private fun aHash(lum: IntArray): String {
        var sum = 0L
        for (v in lum) sum += v
        val avg = sum / lum.size
        var bits = 0L
        for (i in lum.indices) {
            bits = bits shl 1
            if (lum[i] >= avg) bits = bits or 1L
        }
        return toHex16(bits)
    }

    /** Difference hash: bit set when a pixel is brighter than its right neighbour. */
    private fun dHash(lum: IntArray, w: Int, h: Int): String {
        var bits = 0L
        for (y in 0 until h) {
            for (x in 0 until w - 1) {
                bits = bits shl 1
                if (lum[y * w + x] > lum[y * w + x + 1]) bits = bits or 1L
            }
        }
        return toHex16(bits)
    }

    private fun toHex16(bits: Long): String {
        val hex = java.lang.Long.toHexString(bits)
        return "0".repeat(16 - hex.length) + hex
    }
}
