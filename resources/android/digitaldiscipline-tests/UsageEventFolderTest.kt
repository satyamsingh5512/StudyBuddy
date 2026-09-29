package `in`.satym.studybuddy.digitaldiscipline

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class UsageEventFolderTest {
    private val min = 60_000L
    private val dayStart = 1_000_000_000L
    private val dayEnd = dayStart + 24 * 60 * min

    private fun ev(type: Int, pkg: String, at: Long, cls: String = "Main") = RawUsageEvent(type, pkg, cls, at)
    private val resumed = UsageEventFolder.ACTIVITY_RESUMED
    private val paused = UsageEventFolder.ACTIVITY_PAUSED

    @Test
    fun countsResumeToPauseAsForeground() {
        val totals = UsageEventFolder.fold(
            listOf(ev(resumed, "a", dayStart + 10 * min), ev(paused, "a", dayStart + 25 * min)),
            dayStart, dayEnd
        )
        assertEquals(15 * min, totals.foregroundMsByPackage["a"])
        assertEquals(15 * min, totals.screenTimeMs)
    }

    @Test
    fun splitsAnAppOpenAcrossMidnight() {
        // Opened 30 min before midnight, closed 20 min after: only 20 min belong to this day.
        val totals = UsageEventFolder.fold(
            listOf(ev(resumed, "a", dayStart - 30 * min), ev(paused, "a", dayStart + 20 * min)),
            dayStart, dayEnd
        )
        assertEquals(20 * min, totals.foregroundMsByPackage["a"])
    }

    @Test
    fun activityHandOffInsideOneAppIsNotDoubleCounted() {
        val totals = UsageEventFolder.fold(
            listOf(
                ev(resumed, "a", dayStart, "One"),
                ev(resumed, "a", dayStart + 5 * min, "Two"),
                ev(paused, "a", dayStart + 6 * min, "One"),
                ev(paused, "a", dayStart + 10 * min, "Two"),
                ev(UsageEventFolder.ACTIVITY_STOPPED, "a", dayStart + 11 * min, "Two")
            ),
            dayStart, dayEnd
        )
        assertEquals(10 * min, totals.foregroundMsByPackage["a"])
    }

    @Test
    fun screenOffClosesEverythingAndMissingPauseDoesNotRunForever() {
        val totals = UsageEventFolder.fold(
            listOf(
                ev(resumed, "a", dayStart + 60 * min),
                ev(UsageEventFolder.SCREEN_NON_INTERACTIVE, "android", dayStart + 70 * min),
                ev(paused, "a", dayStart + 300 * min)
            ),
            dayStart, dayEnd
        )
        assertEquals(10 * min, totals.foregroundMsByPackage["a"])
    }

    @Test
    fun openAppIsCountedUntilWindowEnd() {
        val now = dayStart + 90 * min
        val totals = UsageEventFolder.fold(listOf(ev(resumed, "a", dayStart + 80 * min)), dayStart, now)
        assertEquals(10 * min, totals.foregroundMsByPackage["a"])
    }

    @Test
    fun excludesOwnPackageAndCountsUnlocksInsideWindowOnly() {
        val totals = UsageEventFolder.fold(
            listOf(
                ev(UsageEventFolder.KEYGUARD_HIDDEN, "android", dayStart - min),
                ev(UsageEventFolder.KEYGUARD_HIDDEN, "android", dayStart + min),
                ev(UsageEventFolder.KEYGUARD_HIDDEN, "android", dayStart + 2 * min),
                ev(resumed, "self", dayStart + 3 * min),
                ev(paused, "self", dayStart + 9 * min)
            ),
            dayStart, dayEnd, excludedPackages = setOf("self")
        )
        assertEquals(2, totals.unlockCount)
        assertTrue(totals.foregroundMsByPackage.isEmpty())
    }

    @Test
    fun unlocksAreUnknownRatherThanZeroWhenUnsupported() {
        val totals = UsageEventFolder.fold(emptyList(), dayStart, dayEnd, unlocksSupported = false)
        assertNull(totals.unlockCount)
        assertFalse(totals.hasData)
    }

    @Test
    fun oldestDayIsTreatedAsTruncatedOnlyWhenItStartsLateAfterAnEmptyDay() {
        val late = UsageEventFolder.fold(listOf(ev(resumed, "a", dayStart + 14 * 60 * min)), dayStart, dayEnd)
        val early = UsageEventFolder.fold(listOf(ev(resumed, "a", dayStart + 30 * min)), dayStart, dayEnd)
        assertTrue(UsageEventFolder.isLikelyTruncated(late, dayStart, olderDayHasData = false))
        assertFalse(UsageEventFolder.isLikelyTruncated(early, dayStart, olderDayHasData = false))
        assertFalse(UsageEventFolder.isLikelyTruncated(late, dayStart, olderDayHasData = true))
    }
}
