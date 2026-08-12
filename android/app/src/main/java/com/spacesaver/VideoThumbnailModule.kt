package com.spacesaver

import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.media.ThumbnailUtils
import android.net.Uri
import android.os.Build
import android.os.ParcelFileDescriptor
import android.provider.MediaStore
import android.util.Size
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.security.MessageDigest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class VideoThumbnailModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NativeVideoThumbnail"

    @ReactMethod
    fun getThumbnail(videoUri: String, promise: Promise) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val path = generateThumbnailInternal(videoUri)
                if (path != null) {
                    promise.resolve(path)
                } else {
                    promise.reject("THUMB_ERROR", "Could not generate thumbnail for: $videoUri")
                }
            } catch (e: Exception) {
                promise.reject("THUMB_ERROR", e.message, e)
            }
        }
    }

    private suspend fun generateThumbnailInternal(videoUri: String): String? = withContext(Dispatchers.IO) {
        if (videoUri.isBlank()) return@withContext null

        val cacheDir = File(reactContext.cacheDir, "native_video_thumbs")
        if (!cacheDir.exists()) {
            cacheDir.mkdirs()
        }

        val md5Hash = md5(videoUri)
        val outFile = File(cacheDir, "thumb_$md5Hash.jpg")
        if (outFile.exists() && outFile.length() > 0) {
            return@withContext "file://${outFile.absolutePath}"
        }

        val context = reactContext.applicationContext
        val uri = Uri.parse(videoUri)
        var bitmap: Bitmap? = null

        // Strategy 1: ContentResolver.loadThumbnail (Android 10+ / API 29+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && videoUri.startsWith("content://")) {
            try {
                bitmap = context.contentResolver.loadThumbnail(uri, Size(512, 512), null)
            } catch (e: Throwable) {
                bitmap = null
            }
        }

        // Strategy 2: MediaMetadataRetriever via openFileDescriptor (Keeping PFD OPEN during frame extraction!)
        if (bitmap == null && videoUri.startsWith("content://")) {
            var pfd: ParcelFileDescriptor? = null
            val retriever = MediaMetadataRetriever()
            try {
                pfd = context.contentResolver.openFileDescriptor(uri, "r")
                if (pfd != null) {
                    retriever.setDataSource(pfd.fileDescriptor)
                    bitmap = extractFrameWithRetriever(retriever)
                }
            } catch (e: Throwable) {
                bitmap = null
            } finally {
                try { retriever.release() } catch (e: Throwable) {}
                try { pfd?.close() } catch (e: Throwable) {}
            }
        }

        // Strategy 3: MediaStore.Video.Thumbnails.getThumbnail (Legacy MediaStore fallback)
        if (bitmap == null && videoUri.startsWith("content://")) {
            try {
                val mediaId = uri.lastPathSegment?.toLongOrNull()
                if (mediaId != null) {
                    @Suppress("DEPRECATION")
                    bitmap = MediaStore.Video.Thumbnails.getThumbnail(
                        context.contentResolver,
                        mediaId,
                        MediaStore.Video.Thumbnails.MINI_KIND,
                        null
                    )
                }
            } catch (e: Throwable) {
                bitmap = null
            }
        }

        // Strategy 4: Raw file path resolution (via MediaStore DATA column query)
        var filePath: String? = null
        if (videoUri.startsWith("content://")) {
            try {
                val proj = arrayOf(MediaStore.Video.Media.DATA)
                context.contentResolver.query(uri, proj, null, null, null)?.use { cursor ->
                    if (cursor.moveToFirst()) {
                        val idx = cursor.getColumnIndex(MediaStore.Video.Media.DATA)
                        if (idx != -1) {
                            filePath = cursor.getString(idx)
                        }
                    }
                }
            } catch (e: Throwable) {
                filePath = null
            }
        } else {
            filePath = videoUri.replace("^file:/+".toRegex(), "/")
        }

        // Strategy 5: ThumbnailUtils on raw file path
        if (bitmap == null && !filePath.isNullOrBlank()) {
            try {
                val file = File(filePath!!)
                if (file.exists()) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        bitmap = ThumbnailUtils.createVideoThumbnail(file, Size(512, 512), null)
                    } else {
                        @Suppress("DEPRECATION")
                        bitmap = ThumbnailUtils.createVideoThumbnail(file.absolutePath, MediaStore.Images.Thumbnails.MINI_KIND)
                    }
                }
            } catch (e: Throwable) {
                bitmap = null
            }
        }

        // Strategy 6: Copy stream header to temporary cache file for MOV / Content URIs
        if (bitmap == null && videoUri.startsWith("content://")) {
            val tempFile = File(cacheDir, "temp_$md5Hash.mov")
            var inputStream: InputStream? = null
            var fos: FileOutputStream? = null
            try {
                inputStream = context.contentResolver.openInputStream(uri)
                if (inputStream != null) {
                    fos = FileOutputStream(tempFile)
                    val buffer = ByteArray(8192)
                    var bytesRead: Int
                    var totalRead = 0
                    while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                        fos.write(buffer, 0, bytesRead)
                        totalRead += bytesRead
                        if (totalRead > 5 * 1024 * 1024) break
                    }
                    fos.flush()

                    val retriever = MediaMetadataRetriever()
                    try {
                        retriever.setDataSource(tempFile.absolutePath)
                        bitmap = extractFrameWithRetriever(retriever)
                    } finally {
                        try { retriever.release() } catch (e: Throwable) {}
                    }
                }
            } catch (e: Throwable) {
                bitmap = null
            } finally {
                try { inputStream?.close() } catch (e: Throwable) {}
                try { fos?.close() } catch (e: Throwable) {}
                try { if (tempFile.exists()) tempFile.delete() } catch (e: Throwable) {}
            }
        }

        if (bitmap == null) return@withContext null

        var fos: FileOutputStream? = null
        try {
            fos = FileOutputStream(outFile)
            bitmap.compress(Bitmap.CompressFormat.JPEG, 85, fos)
            fos.flush()
            return@withContext "file://${outFile.absolutePath}"
        } catch (e: Throwable) {
            return@withContext null
        } finally {
            try { fos?.close() } catch (e: Throwable) {}
        }
    }

    private fun extractFrameWithRetriever(retriever: MediaMetadataRetriever): Bitmap? {
        val attempts = arrayOf(
            Pair(0L, MediaMetadataRetriever.OPTION_CLOSEST_SYNC),
            Pair(0L, MediaMetadataRetriever.OPTION_CLOSEST),
            Pair(100_000L, MediaMetadataRetriever.OPTION_CLOSEST_SYNC),
            Pair(500_000L, MediaMetadataRetriever.OPTION_CLOSEST_SYNC),
            Pair(1_000_000L, MediaMetadataRetriever.OPTION_CLOSEST_SYNC),
            Pair(2_000_000L, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
        )
        for ((timeUs, option) in attempts) {
            val bmp = try {
                retriever.getFrameAtTime(timeUs, option)
            } catch (e: Throwable) {
                null
            }
            if (bmp != null) return bmp
        }
        val repFrame = try { retriever.frameAtTime } catch (e: Throwable) { null }
        if (repFrame != null) return repFrame

        return try { retriever.getFrameAtTime(-1L) } catch (e: Throwable) { null }
    }

    private fun md5(input: String): String {
        val bytes = MessageDigest.getInstance("MD5").digest(input.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }
}
