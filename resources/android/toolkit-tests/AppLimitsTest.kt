package `in`.satym.studybuddy.toolkit

import `in`.satym.studybuddy.shortsblock.AppLimits
import `in`.satym.studybuddy.shortsblock.AppRule
import `in`.satym.studybuddy.shortsblock.BlockedWindow
import org.junit.Assert.*
import org.junit.Test
import java.util.Calendar

/**
 * Unit tests for AppLimits scheduling and window logic.
 *
 * All tests use pure java.util.Calendar instances and never touch Android APIs,
 * so they run as local JUnit tests without an emulator.
 */
class AppLimitsTest {

    @Test
    fun `same-day window is active within range`() {
        // Monday 14:30
        val now = calendar(2026, Calendar.SEPTEMBER, 28, 14, 30)
        val window = BlockedWindow(
            daysOfWeek = setOf(Calendar.MONDAY),
            startMinute = 14 * 60,      // 14:00
            endMinute = 15 * 60         // 15:00
        )
        assertTrue(AppLimits.isWindowActiveAt(window, now))
    }

    @Test
    fun `same-day window is not active before start`() {
        val now = calendar(2026, Calendar.SEPTEMBER, 28, 13, 59)
        val window = BlockedWindow(
            daysOfWeek = setOf(Calendar.MONDAY),
            startMinute = 14 * 60,
            endMinute = 15 * 60
        )
        assertFalse(AppLimits.isWindowActiveAt(window, now))
    }

    @Test
    fun `same-day window is not active at or after end`() {
        val now = calendar(2026, Calendar.SEPTEMBER, 28, 15, 0)
        val window = BlockedWindow(
            daysOfWeek = setOf(Calendar.MONDAY),
            startMinute = 14 * 60,
            endMinute = 15 * 60
        )
        assertFalse(AppLimits.isWindowActiveAt(window, now))
    }

    @Test
    fun `midnight-crossing window is active after start on start day`() {
        // Monday 23:30
        val now = calendar(2026, Calendar.SEPTEMBER, 28, 23, 30)
        val window = BlockedWindow(
            daysOfWeek = setOf(Calendar.MONDAY),
            startMinute = 23 * 60,      // 23:00
            endMinute = 1 * 60          // 01:00 (next day)
        )
        assertTrue(AppLimits.isWindowActiveAt(window, now))
    }

    @Test
    fun `midnight-crossing window is active before end on next day`() {
        // Tuesday 00:30 (window started Monday 23:00)
        val now = calendar(2026, Calendar.SEPTEMBER, 29, 0, 30)
        val window = BlockedWindow(
            daysOfWeek = setOf(Calendar.MONDAY),
            startMinute = 23 * 60,
            endMinute = 1 * 60
        )
        assertTrue(AppLimits.isWindowActiveAt(window, now))
    }

    @Test
    fun `midnight-crossing window is not active on wrong start day`() {
        // Wednesday 23:30 (window is Monday 23:00-01:00)
        val now = calendar(2026, Calendar.SEPTEMBER, 30, 23, 30)
        val window = BlockedWindow(
            daysOfWeek = setOf(Calendar.MONDAY),
            startMinute = 23 * 60,
            endMinute = 1 * 60
        )
        assertFalse(AppLimits.isWindowActiveAt(window, now))
    }

    @Test
    fun `midnight-crossing window is not active on wrong next day`() {
        // Friday 00:30 (window is Monday 23:00-01:00, so next day is Tuesday)
        val now = calendar(2026, Calendar.OCTOBER, 2, 0, 30)
        val window = BlockedWindow(
            daysOfWeek = setOf(Calendar.MONDAY),
            startMinute = 23 * 60,
            endMinute = 1 * 60
        )
        assertFalse(AppLimits.isWindowActiveAt(window, now))
    }

    @Test
    fun `window with multiple days matches any configured day`() {
        // Wednesday 14:30
        val now = calendar(2026, Calendar.SEPTEMBER, 30, 14, 30)
        val window = BlockedWindow(
            daysOfWeek = setOf(Calendar.MONDAY, Calendar.WEDNESDAY, Calendar.FRIDAY),
            startMinute = 14 * 60,
            endMinute = 15 * 60
        )
        assertTrue(AppLimits.isWindowActiveAt(window, now))
    }

    @Test
    fun `window with multiple days does not match unconfigured day`() {
        // Tuesday 14:30
        val now = calendar(2026, Calendar.SEPTEMBER, 29, 14, 30)
        val window = BlockedWindow(
            daysOfWeek = setOf(Calendar.MONDAY, Calendar.WEDNESDAY, Calendar.FRIDAY),
            startMinute = 14 * 60,
            endMinute = 15 * 60
        )
        assertFalse(AppLimits.isWindowActiveAt(window, now))
    }

    @Test
    fun `isInBlockedWindow returns true when any window is active`() {
        val now = calendar(2026, Calendar.SEPTEMBER, 28, 14, 30)
        val rule = AppRule(
            packageName = "com.example.app",
            dailyLimitMinutes = 0,
            blockedWindows = listOf(
                BlockedWindow(
                    daysOfWeek = setOf(Calendar.TUESDAY),
                    startMinute = 10 * 60,
                    endMinute = 11 * 60
                ),
                BlockedWindow(
                    daysOfWeek = setOf(Calendar.MONDAY),
                    startMinute = 14 * 60,
                    endMinute = 15 * 60
                )
            )
        )
        assertTrue(AppLimits.isInBlockedWindow(rule, now))
    }

    @Test
    fun `isInBlockedWindow returns false when no windows are active`() {
        val now = calendar(2026, Calendar.SEPTEMBER, 28, 16, 0)
        val rule = AppRule(
            packageName = "com.example.app",
            dailyLimitMinutes = 0,
            blockedWindows = listOf(
                BlockedWindow(
                    daysOfWeek = setOf(Calendar.MONDAY),
                    startMinute = 14 * 60,
                    endMinute = 15 * 60
                )
            )
        )
        assertFalse(AppLimits.isInBlockedWindow(rule, now))
    }

    @Test
    fun `isInBlockedWindow returns false when rule has no windows`() {
        val now = calendar(2026, Calendar.SEPTEMBER, 28, 14, 30)
        val rule = AppRule(
            packageName = "com.example.app",
            dailyLimitMinutes = 0,
            blockedWindows = emptyList()
        )
        assertFalse(AppLimits.isInBlockedWindow(rule, now))
    }

    @Test
    fun `nextWindowEndTime returns formatted time for active window`() {
        val now = calendar(2026, Calendar.SEPTEMBER, 28, 14, 30)
        val rule = AppRule(
            packageName = "com.example.app",
            dailyLimitMinutes = 0,
            blockedWindows = listOf(
                BlockedWindow(
                    daysOfWeek = setOf(Calendar.MONDAY),
                    startMinute = 14 * 60,
                    endMinute = 17 * 60 + 45  // 17:45
                )
            )
        )
        assertEquals("17:45", AppLimits.nextWindowEndTime(rule, now))
    }

    @Test
    fun `nextWindowEndTime returns null when no window is active`() {
        val now = calendar(2026, Calendar.SEPTEMBER, 28, 18, 0)
        val rule = AppRule(
            packageName = "com.example.app",
            dailyLimitMinutes = 0,
            blockedWindows = listOf(
                BlockedWindow(
                    daysOfWeek = setOf(Calendar.MONDAY),
                    startMinute = 14 * 60,
                    endMinute = 17 * 60
                )
            )
        )
        assertNull(AppLimits.nextWindowEndTime(rule, now))
    }

    @Test
    fun `nextWindowEndTime formats midnight as 00-00`() {
        // Monday 23:30, window ends Tuesday 00:00
        val now = calendar(2026, Calendar.SEPTEMBER, 28, 23, 30)
        val rule = AppRule(
            packageName = "com.example.app",
            dailyLimitMinutes = 0,
            blockedWindows = listOf(
                BlockedWindow(
                    daysOfWeek = setOf(Calendar.MONDAY),
                    startMinute = 23 * 60,
                    endMinute = 0  // 00:00
                )
            )
        )
        assertEquals("00:00", AppLimits.nextWindowEndTime(rule, now))
    }

    @Test
    fun `nextWindowEndTime uses first active window when multiple are active`() {
        val now = calendar(2026, Calendar.SEPTEMBER, 28, 14, 30)
        val rule = AppRule(
            packageName = "com.example.app",
            dailyLimitMinutes = 0,
            blockedWindows = listOf(
                BlockedWindow(
                    daysOfWeek = setOf(Calendar.MONDAY),
                    startMinute = 14 * 60,
                    endMinute = 15 * 60
                ),
                BlockedWindow(
                    daysOfWeek = setOf(Calendar.MONDAY),
                    startMinute = 14 * 60,
                    endMinute = 18 * 60
                )
            )
        )
        // Returns first window's end time
        assertEquals("15:00", AppLimits.nextWindowEndTime(rule, now))
    }

    @Test
    fun `midnight crossing Saturday to Sunday handles week boundary`() {
        // Saturday 23:30
        val now = calendar(2026, Calendar.OCTOBER, 3, 23, 30)
        val window = BlockedWindow(
            daysOfWeek = setOf(Calendar.SATURDAY),
            startMinute = 23 * 60,
            endMinute = 1 * 60
        )
        assertTrue(AppLimits.isWindowActiveAt(window, now))
    }

    @Test
    fun `midnight crossing Saturday to Sunday is active on Sunday morning`() {
        // Sunday 00:30 (window started Saturday 23:00)
        val now = calendar(2026, Calendar.OCTOBER, 4, 0, 30)
        val window = BlockedWindow(
            daysOfWeek = setOf(Calendar.SATURDAY),
            startMinute = 23 * 60,
            endMinute = 1 * 60
        )
        assertTrue(AppLimits.isWindowActiveAt(window, now))
    }

    @Test
    fun `equal start and end blocks the full 24 hours from the start day`() {
        // Same convention as Zen and as the app-limit editor's hint: end <= start
        // runs past midnight, so 00:00-00:00 on Monday covers all of Monday.
        val window = BlockedWindow(
            daysOfWeek = setOf(Calendar.MONDAY),
            startMinute = 0,
            endMinute = 0
        )
        assertTrue(AppLimits.isWindowActiveAt(window, calendar(2026, Calendar.SEPTEMBER, 28, 12, 0)))
        assertTrue(AppLimits.isWindowActiveAt(window, calendar(2026, Calendar.SEPTEMBER, 28, 23, 59)))
        assertFalse(AppLimits.isWindowActiveAt(window, calendar(2026, Calendar.SEPTEMBER, 29, 0, 0)))
    }

    @Test
    fun `a window can run to the end of the day by ending at 00-00`() {
        // Monday 23:59. The end minute is exclusive, so blocking "until midnight"
        // is expressed as an end of 00:00 (a midnight-crossing window), and 1440
        // is rejected rather than silently accepted.
        val now = calendar(2026, Calendar.SEPTEMBER, 28, 23, 59)
        assertThrows(IllegalArgumentException::class.java) {
            BlockedWindow(daysOfWeek = setOf(Calendar.MONDAY), startMinute = 20 * 60, endMinute = 1440)
        }
        val untilMidnight = BlockedWindow(
            daysOfWeek = setOf(Calendar.MONDAY),
            startMinute = 20 * 60,
            endMinute = 0
        )
        assertTrue(AppLimits.isWindowActiveAt(untilMidnight, now))
        // The following day is not blocked once midnight has passed.
        assertFalse(AppLimits.isWindowActiveAt(untilMidnight, calendar(2026, Calendar.SEPTEMBER, 29, 0, 1)))
    }

    // -------------------------------------------------------------------------
    // Helper
    // -------------------------------------------------------------------------

    private fun calendar(year: Int, month: Int, day: Int, hour: Int, minute: Int): Calendar =
        Calendar.getInstance().apply {
            set(Calendar.YEAR, year)
            set(Calendar.MONTH, month)
            set(Calendar.DAY_OF_MONTH, day)
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
}
