package com.wakutakea.QrReaderSender

import android.content.ContentValues
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.ExifInterface
import android.media.MediaScannerConnection
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager
import java.io.File
import java.io.IOException
import java.util.Locale
import java.util.concurrent.Executors
import kotlin.math.roundToInt

/** Publishes camera JPEGs to public Downloads, without broad storage access on Android 10+. */
class EvidenceImagesModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val executor = Executors.newSingleThreadExecutor()

  override fun getName() = "EvidenceImages"

  @ReactMethod
  fun saveQrText(codes: ReadableArray, timestamp: Double, promise: Promise) {
    val values = (0 until codes.size()).map { codes.getString(it) ?: "" }
    executor.execute {
      try {
        require(values.isNotEmpty()) { "There are no QR codes to save" }
        val bytes = QrTextExport.contents(values).toByteArray(Charsets.UTF_8)
        var time = timestamp.toLong()
        var relativePath: String
        var name: String
        do {
          relativePath = "QrReaderSender/${EvidenceImageNames.folder(time)}"
          name = QrTextExport.fileName(time++)
        } while (downloadFileExists(relativePath, name))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          saveTextToDownloads(bytes, relativePath, name)
        } else {
          saveTextToLegacyDownloads(bytes, relativePath, name)
        }
        promise.resolve("$relativePath/$name")
      } catch (error: Exception) {
        promise.reject("TEXT_SAVE_FAILED", "テキストの保存に失敗しました: ${error.message}", error)
      }
    }
  }

  private fun downloadFileExists(relativePath: String, name: String): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      @Suppress("DEPRECATION")
      val directory = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
      return File(directory, "$relativePath/$name").exists()
    }
    val resolver = context.contentResolver
    val path = "${Environment.DIRECTORY_DOWNLOADS}/$relativePath/"
    resolver.query(
      MediaStore.Downloads.EXTERNAL_CONTENT_URI,
      arrayOf(MediaStore.MediaColumns._ID),
      "${MediaStore.MediaColumns.RELATIVE_PATH} = ? AND ${MediaStore.MediaColumns.DISPLAY_NAME} = ?",
      arrayOf(path, name),
      null
    )?.use { return it.moveToFirst() }
    return false
  }

  @android.annotation.TargetApi(Build.VERSION_CODES.Q)
  private fun saveTextToDownloads(bytes: ByteArray, relativePath: String, name: String) {
    val resolver = context.contentResolver
    val values = ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, name)
      put(MediaStore.MediaColumns.MIME_TYPE, "text/plain")
      put(MediaStore.MediaColumns.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/$relativePath")
      put(MediaStore.MediaColumns.IS_PENDING, 1)
    }
    val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
      ?: throw IOException("Download entry could not be created")
    try {
      resolver.openOutputStream(uri)?.use { it.write(bytes) }
        ?: throw IOException("Download file could not be opened")
      val updated = resolver.update(uri, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
      if (updated != 1) throw IOException("Download file could not be published")
    } catch (error: Exception) {
      resolver.delete(uri, null, null)
      throw error
    }
  }

  @Suppress("DEPRECATION")
  private fun saveTextToLegacyDownloads(bytes: ByteArray, relativePath: String, name: String) {
    val directory = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), relativePath)
    if (!directory.isDirectory && !directory.mkdirs()) throw IOException("Download folder could not be created")
    val destination = File(directory, name)
    if (!destination.createNewFile()) throw IOException("Text file already exists: $name")
    try {
      destination.outputStream().use { it.write(bytes) }
    } catch (error: Exception) {
      destination.delete()
      throw error
    }
    MediaScannerConnection.scanFile(context, arrayOf(destination.absolutePath), arrayOf("text/plain"), null)
  }

  @ReactMethod
  fun savePhoto(path: String, codes: ReadableArray, timestamp: Double, promise: Promise) {
    val values = (0 until codes.size()).map { codes.getString(it) ?: "QR" }
    executor.execute {
      var source: File? = null
      var compressed: File? = null
      try {
        val candidate = File(path).canonicalFile
        require(candidate.path.startsWith(context.cacheDir.canonicalPath + File.separator)) {
          "Photo must be in the app cache"
        }
        source = candidate
        require(candidate.isFile) { "Photo file is missing" }
        val prepared = compressPhoto(candidate)
        compressed = prepared
        val usedNames = mutableSetOf<String>()
        for (code in values) {
          // Distinct QR values can have the same first 12 characters. Keep the requested
          // filename format while preventing a same-batch collision at millisecond precision.
          var time = timestamp.toLong()
          var name: String
          do {
            name = EvidenceImageNames.fileName(code, time++)
          } while (!usedNames.add(name.lowercase(Locale.ROOT)))
          val folder = EvidenceImageNames.folder(time - 1)
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveToDownloads(prepared, folder, name)
          } else {
            saveToLegacyDownloads(prepared, folder, name)
          }
        }
        promise.resolve(null)
      } catch (error: Exception) {
        promise.reject("IMAGE_SAVE_FAILED", "画像の保存に失敗しました: ${error.message}", error)
      } finally {
        compressed?.delete()
        source?.delete()
      }
    }
  }

  /** Keep the saved JPEG within HD bounds even when the camera selects a larger photo format. */
  private fun compressPhoto(source: File): File {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(source.path, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
      throw IOException("Photo JPEG could not be decoded")
    }
    val maxWidth = if (bounds.outWidth >= bounds.outHeight) 1280 else 720
    val maxHeight = if (bounds.outWidth >= bounds.outHeight) 720 else 1280
    var sampleSize = 1
    while (bounds.outWidth / (sampleSize * 2) >= maxWidth && bounds.outHeight / (sampleSize * 2) >= maxHeight) {
      sampleSize *= 2
    }
    val options = BitmapFactory.Options().apply {
      inSampleSize = sampleSize
    }
    val bitmap = BitmapFactory.decodeFile(source.path, options)
      ?: throw IOException("Photo JPEG could not be decoded")
    try {
      val scale = minOf(1.0, maxWidth.toDouble() / bitmap.width, maxHeight.toDouble() / bitmap.height)
      val resized = if (scale < 1.0) {
        Bitmap.createScaledBitmap(bitmap, maxOf(1, (bitmap.width * scale).roundToInt()), maxOf(1, (bitmap.height * scale).roundToInt()), true)
      } else bitmap
      try {
        val output = File.createTempFile("evidence-photo-", ".jpg", context.cacheDir)
        try {
          output.outputStream().use { stream ->
            if (!resized.compress(Bitmap.CompressFormat.JPEG, 50, stream)) throw IOException("Photo JPEG could not be compressed")
          }
          val orientation = ExifInterface(source.path).getAttribute(ExifInterface.TAG_ORIENTATION)
          if (orientation != null) {
            ExifInterface(output.path).apply {
              setAttribute(ExifInterface.TAG_ORIENTATION, orientation)
              saveAttributes()
            }
          }
          return output
        } catch (error: Exception) {
          output.delete()
          throw error
        }
      } finally {
        if (resized !== bitmap) resized.recycle()
      }
    } finally {
      bitmap.recycle()
    }
  }

  @android.annotation.TargetApi(Build.VERSION_CODES.Q)
  private fun saveToDownloads(source: File, folder: String, name: String) {
    val resolver = context.contentResolver
    val values = ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, name)
      put(MediaStore.MediaColumns.MIME_TYPE, "image/jpeg")
      put(MediaStore.MediaColumns.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/QrReaderSender/$folder")
      put(MediaStore.MediaColumns.IS_PENDING, 1)
    }
    val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
      ?: throw IOException("Download entry could not be created")
    try {
      val output = resolver.openOutputStream(uri) ?: throw IOException("Download file could not be opened")
      output.use { target -> source.inputStream().use { it.copyTo(target) } }
      val updated = resolver.update(uri, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
      if (updated != 1) throw IOException("Download file could not be published")
    } catch (error: Exception) {
      resolver.delete(uri, null, null)
      throw error
    }
  }

  @Suppress("DEPRECATION")
  private fun saveToLegacyDownloads(source: File, folder: String, name: String) {
    val directory = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "QrReaderSender/$folder")
    if (!directory.isDirectory && !directory.mkdirs()) throw IOException("Download folder could not be created")
    val destination = File(directory, name)
    // Never overwrite an existing evidence image.
    if (!destination.createNewFile()) throw IOException("Image already exists: $name")
    try {
      source.inputStream().use { input -> destination.outputStream().use { input.copyTo(it) } }
    } catch (error: Exception) {
      destination.delete()
      throw error
    }
    MediaScannerConnection.scanFile(context, arrayOf(destination.absolutePath), arrayOf("image/jpeg"), null)
  }

  override fun invalidate() {
    executor.shutdown()
    super.invalidate()
  }
}

class EvidenceImagesPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(EvidenceImagesModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
