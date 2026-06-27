package com.spacesaver

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.ReactContext

class CompressionForegroundService : Service() {

    private val CHANNEL_ID = "spacesaver_compression"
    private val NOTIFICATION_ID = 1001
    private val binder = LocalBinder()

    private var wakeLock: PowerManager.WakeLock? = null
    private var currentProgress = 0
    private var currentFileName = ""
    private var totalFiles = 0
    private var completedFiles = 0

    inner class LocalBinder : Binder() {
        fun getService(): CompressionForegroundService = this@CompressionForegroundService
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        acquireWakeLock()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                totalFiles = intent.getIntExtra(EXTRA_TOTAL_FILES, 1)
                val notification = buildNotification(0, "Preparing...", 0, totalFiles)
                startForeground(NOTIFICATION_ID, notification)
            }
            ACTION_UPDATE -> {
                currentProgress = intent.getIntExtra(EXTRA_PROGRESS, 0)
                currentFileName = intent.getStringExtra(EXTRA_FILE_NAME) ?: ""
                completedFiles = intent.getIntExtra(EXTRA_COMPLETED, 0)
                totalFiles = intent.getIntExtra(EXTRA_TOTAL, totalFiles)
                updateNotification(currentProgress, currentFileName, completedFiles, totalFiles)
            }
            ACTION_STOP -> {
                stopSelf()
            }
            ACTION_PAUSE -> {
                updateNotification(currentProgress, "Paused – $currentFileName", completedFiles, totalFiles)
            }
            ACTION_RESUME -> {
                updateNotification(currentProgress, currentFileName, completedFiles, totalFiles)
            }
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onDestroy() {
        releaseWakeLock()
        super.onDestroy()
    }

    private fun acquireWakeLock() {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "SpaceSaver::CompressionWakeLock"
        ).apply {
            acquire(60 * 60 * 1000L) // 1 hour max
        }
    }

    private fun releaseWakeLock() {
        wakeLock?.takeIf { it.isHeld }?.release()
        wakeLock = null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Compression Progress",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows compression progress"
                setShowBadge(false)
                enableVibration(false)
                enableLights(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(
        progress: Int,
        fileName: String,
        completed: Int,
        total: Int
    ): Notification {
        // Tap to open app
        val openIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingOpen = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Pause action
        val pauseIntent = Intent(this, CompressionForegroundService::class.java).apply {
            action = ACTION_PAUSE
        }
        val pendingPause = PendingIntent.getService(
            this, 1, pauseIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Cancel action
        val cancelIntent = Intent(this, CompressionForegroundService::class.java).apply {
            action = ACTION_STOP
        }
        val pendingCancel = PendingIntent.getService(
            this, 2, cancelIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val contentText = if (total > 1) "$completed/$total files" else fileName

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Compressing ${if (total > 1) "Videos" else "File"}")
            .setContentText(contentText)
            .setSubText(if (fileName.isNotEmpty()) fileName else null)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setProgress(100, progress, progress == 0)
            .setOngoing(true)
            .setContentIntent(pendingOpen)
            .addAction(android.R.drawable.ic_media_pause, "Pause", pendingPause)
            .addAction(android.R.drawable.ic_delete, "Cancel", pendingCancel)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .build()
    }

    private fun updateNotification(
        progress: Int,
        fileName: String,
        completed: Int,
        total: Int
    ) {
        val notification = buildNotification(progress, fileName, completed, total)
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, notification)
    }

    companion object {
        const val ACTION_START = "ACTION_START_COMPRESSION"
        const val ACTION_UPDATE = "ACTION_UPDATE_COMPRESSION"
        const val ACTION_STOP = "ACTION_STOP_COMPRESSION"
        const val ACTION_PAUSE = "ACTION_PAUSE_COMPRESSION"
        const val ACTION_RESUME = "ACTION_RESUME_COMPRESSION"

        const val EXTRA_PROGRESS = "progress"
        const val EXTRA_FILE_NAME = "fileName"
        const val EXTRA_TOTAL_FILES = "totalFiles"
        const val EXTRA_TOTAL = "total"
        const val EXTRA_COMPLETED = "completed"

        fun start(context: Context, totalFiles: Int) {
            val intent = Intent(context, CompressionForegroundService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_TOTAL_FILES, totalFiles)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun update(
            context: Context,
            progress: Int,
            fileName: String,
            completed: Int,
            total: Int
        ) {
            val intent = Intent(context, CompressionForegroundService::class.java).apply {
                action = ACTION_UPDATE
                putExtra(EXTRA_PROGRESS, progress)
                putExtra(EXTRA_FILE_NAME, fileName)
                putExtra(EXTRA_COMPLETED, completed)
                putExtra(EXTRA_TOTAL, total)
            }
            context.startService(intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, CompressionForegroundService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }
}
