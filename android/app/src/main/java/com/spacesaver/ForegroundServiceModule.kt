package com.spacesaver

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap

class ForegroundServiceModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ForegroundService"

    @ReactMethod
    fun startService(totalFiles: Int, promise: Promise) {
        try {
            CompressionForegroundService.start(reactApplicationContext, totalFiles)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("START_ERROR", e.message)
        }
    }

    @ReactMethod
    fun updateProgress(progress: Int, fileName: String, completed: Int, total: Int, promise: Promise) {
        try {
            CompressionForegroundService.update(
                reactApplicationContext,
                progress,
                fileName,
                completed,
                total
            )
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("UPDATE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopService(promise: Promise) {
        try {
            CompressionForegroundService.stop(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e.message)
        }
    }
}
