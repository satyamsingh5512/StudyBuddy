package `in`.satym.studybuddy.toolkit

import `in`.satym.studybuddy.nudges.ReminderMath
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.Calendar
import java.util.TimeZone

/**
 * Next-reminder selection.
 *
 * The behaviour worth pinning down is that a reminder is never scheduled for a time
 * that has already passed today, and that the search rolls forward across disabled
 * days instead of giving up. A regression in either direction is invisible until a
 * reminder silently stops firing.
 */
class ReminderMathTest {

    private fun now(dayOfMonth: Int, hour: Int, minute: Int): Calendar =
        Calendar.getInstance(UTC).apply {
            set(Calendar.YEAR, 2026)
            set(Calendar.MONTH, Calendar.MARCH)
            // 2026-03-01 is a Sunday, so day-of-month equals Calendar.DAY_OF_WEEK here.
            set(Calendar.DAY_OF_MONTH, dayOfMonth)
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 42)
            set(Calendar.MILLISECOND, 500)
        }

    @Test
    fun `picks the next time later the same day`() {
        val trigger = ReminderMath.nextTrigger(
            timesMinutesOfDay = listOf(8 * 60, 18 * 60),
            enabledDays = setOf(Calendar.MONDAY),
            now = now(2, 9, 0)
        )

        checkNotNull(trigger)
        assertEquals(2, trigger.get(Calendar.DAY_OF_MONTH))
        assertEquals(18, trigger.get(Calendar.HOUR_OF_DAY))
        assertEquals(0, trigger.get(Calendar.MINUTE))
        // Seconds are zeroed so a reminder fires on the minute, not 42 seconds into it.
        assertEquals(0, trigger.get(Calendar.SECOND))
        assertEquals(0, trigger.get(Calendar.MILLISECOND))
    }

    @Test
    fun `rolls to the next enabled day when today is exhausted`() {
        val trigger = ReminderMath.nextTrigger(
            timesMinutesOfDay = listOf(8 * 60),
            enabledDays = setOf(Calendar.MONDAY, Calendar.WEDNESDAY),
            now = now(2, 20, 0)
        )

        checkNotNull(trigger)
        // Monday 08:00 has passed, so the next one is Wednesday.
        assertEquals(4, trigger.get(Calendar.DAY_OF_MONTH))
        assertEquals(Calendar.WEDNESDAY, trigger.get(Calendar.DAY_OF_WEEK))
        assertEquals(8, trigger.get(Calendar.HOUR_OF_DAY))
    }

    @Test
    fun `skips days that are not enabled at all`() {
        val trigger = ReminderMath.nextTrigger(
            timesMinutesOfDay = listOf(7 * 60),
            enabledDays = setOf(Calendar.SATURDAY),
            now = now(2, 12, 0)
        )

        checkNotNull(trigger)
        assertEquals(Calendar.SATURDAY, trigger.get(Calendar.DAY_OF_WEEK))
        assertEquals(7, trigger.get(Calendar.HOUR_OF_DAY))
    }

    @Test
    fun `a time exactly now is treated as passed`() {
        val trigger = ReminderMath.nextTrigger(
            timesMinutesOfDay = listOf(9 * 60, 9 * 60 + 1),
            enabledDays = setOf(Calendar.MONDAY),
            now = now(2, 9, 0)
        )

        checkNotNull(trigger)
        // 09:00 is the current minute, so the 09:01 entry wins. Firing "now" would
        // mean an alarm scheduled in the past, which AlarmManager delivers instantly.
        assertEquals(9, trigger.get(Calendar.HOUR_OF_DAY))
        assertEquals(1, trigger.get(Calendar.MINUTE))
    }

    @Test
    fun `duplicate and unsorted times do not change the answer`() {
        val trigger = ReminderMath.nextTrigger(
            timesMinutesOfDay = listOf(18 * 60, 8 * 60, 18 * 60, 8 * 60),
            enabledDays = setOf(Calendar.MONDAY),
            now = now(2, 7, 0)
        )

        checkNotNull(trigger)
        assertEquals(8, trigger.get(Calendar.HOUR_OF_DAY))
    }

    @Test
    fun `no schedule yields no trigger`() {
        assertNull(ReminderMath.nextTrigger(emptyList(), setOf(Calendar.MONDAY), now(2, 7, 0)))
        assertNull(ReminderMath.nextTrigger(listOf(8 * 60), emptySet(), now(2, 7, 0)))
    }

    @Test
    fun `computing the next trigger does not mutate the supplied calendar`() {
        val supplied = now(2, 9, 0)
        val before = supplied.timeInMillis

        ReminderMath.nextTrigger(listOf(18 * 60), setOf(Calendar.MONDAY), supplied)

        assertEquals(before, supplied.timeInMillis)
    }

    private companion object {
        val UTC: TimeZone = TimeZone.getTimeZone("UTC")
    }
}
