package com.wakutakea.QrReaderSender

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

internal object EvidenceImageNames {
  fun folder(timestamp: Long): String = SimpleDateFormat("yyyy_MMdd", Locale.ROOT).format(Date(timestamp))

  fun fileName(code: String, timestamp: Long): String {
    val safe = code.replace(Regex("[\\p{Cntrl}\\\\/:*?\"<>|]"), "_")
    val end = safe.offsetByCodePoints(0, minOf(12, safe.codePointCount(0, safe.length)))
    val prefix = safe.substring(0, end).trim().trimEnd('.').ifEmpty { "QR" }
    val date = SimpleDateFormat("yyyy_MMdd_HHmmss_SSS", Locale.ROOT).format(Date(timestamp))
    return "${prefix}_$date.jpg"
  }
}
