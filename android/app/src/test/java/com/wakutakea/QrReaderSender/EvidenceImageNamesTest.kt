package com.wakutakea.QrReaderSender

import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.Calendar

class EvidenceImageNamesTest {
  private val timestamp = Calendar.getInstance().apply {
    clear()
    set(2026, Calendar.SEPTEMBER, 13, 14, 30, 25)
    set(Calendar.MILLISECOND, 7)
  }.timeInMillis

  @Test fun usesLocalDateAndThreeDigitMilliseconds() {
    assertEquals("2026_0913", EvidenceImageNames.folder(timestamp))
    assertEquals("ABC123_2026_0913_143025_007.jpg", EvidenceImageNames.fileName("ABC123", timestamp))
  }

  @Test fun truncatesLongValuesToTwelveCharacters() {
    assertEquals("ABCDEFGHIJKL_2026_0913_143025_007.jpg", EvidenceImageNames.fileName("ABCDEFGHIJKLMNOP", timestamp))
  }

  @Test fun keepsUnicodeCharactersIntact() {
    val prefix = "😀".repeat(12)
    assertEquals("${prefix}_2026_0913_143025_007.jpg", EvidenceImageNames.fileName(prefix + "あ", timestamp))
  }

  @Test fun replacesPathSeparatorsAndControlCharacters() {
    assertEquals("a_b_c_d_e_2026_0913_143025_007.jpg", EvidenceImageNames.fileName("a/b\\c\nd:e", timestamp))
  }

  @Test fun suppliesAnEmptyPrefixFallback() {
    assertEquals("QR_2026_0913_143025_007.jpg", EvidenceImageNames.fileName("", timestamp))
    assertEquals("QR_2026_0913_143025_007.jpg", EvidenceImageNames.fileName("...", timestamp))
  }
}
