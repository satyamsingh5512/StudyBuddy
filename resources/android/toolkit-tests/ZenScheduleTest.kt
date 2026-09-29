package `in`.satym.studybuddy.toolkit

import `in`.satym.studybuddy.zen.ZenSchedule
import `in`.satym.studybuddy.zen.ZenWindow
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Calendar
import java.util.TimeZone

/**
 * Pure scheduling maths for Zen windows.
 *
 * These tests exist because the midnight-crossing rule is the part of the schedule
 * a reader is most likely to get wrong: a window that starts Monday 22:30 and ends
 * 00:30 is a *Monday* window that is still active at 00:10 on Tuesday. Getting that
 * backwards would either silence the phone on the wrong night or drop the tail of
 * every late session.
 */
class ZenScheduleTest {

    private fun calendar(dayOfWeek: Int, hour: Int, minute: Int): Calendar =
        Calendar.getInstance(UTC).apply {
            set(Calendar.YEAR, 2026)
            set(Calendar.MONTH, Calendar.MARCH)
            // 2026-03-01 is a Sunday, so day-of-week maps onto day-of-month directly.
            set(Calendar.DAY_OF_MONTH, dayOfWeek)
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

    private fun window(
        id: String = "w1",
        days: Set<Int>,
        startMinute: Int,
        endMinute: Int,
        enabled: Boolean = true
    ) = ZenWindow(
        id = id,
        label = "Study",
        daysOfWeek = days,
        startMinute = startMinute,
        endMinute = endMinute,
        enabled = enabled,
        startFocus = false,
        allowPriorityOnly = true
    )

    @Test
    fun `same day window is active only inside its half open range`() {
        val w = window(days = setOf(Calendar.MONDAY), startMinute = 9 * 60, endMinute = 11 * 60)

        assertFalse(ZenSchedule.isActiveAt(w, calendar(Calendar.MONDAY, 8, 59)))
        assertTrue(ZenSchedule.isActiveAt(w, calendar(Calendar.MONDAY, 9, 0)))
        assertTrue(ZenSchedule.isActiveAt(w, calendar(Calendar.MONDAY, 10, 59)))
        // The end minute is exclusive, so 11:00 is already outside the window.
        assertFalse(ZenSchedule.isActiveAt(w, calendar(Calendar.MONDAY, 11, 0)))
    }

    @Test
    fun `window is inert on days it does not list`() {
        val w = window(days = setOf(Calendar.MONDAY), startMinute = 9 * 60, endMinute = 11 * 60)
        assertFalse(ZenSchedule.isActiveAt(w, calendar(Calendar.TUESDAY, 10, 0)))
    }

    @Test
    fun `disabled window never activates`() {
        val w = window(days = setOf(Calendar.MONDAY), startMinute = 9 * 60, endMinute = 11 * 60, enabled = false)
        assertFalse(ZenSchedule.isActiveAt(w, calendar(Calendar.MONDAY, 10, 0)))
    }

    @Test
    fun `midnight crossing window belongs to its start day and runs into the next`() {
        val w = window(days = setOf(Calendar.MONDAY), startMinute = 22 * 60 + 30, endMinute = 30)

        assertFalse(ZenSchedule.isActiveAt(w, calendar(Calendar.MONDAY, 22, 29)))
        assertTrue(ZenSchedule.isActiveAt(w, calendar(Calendar.MONDAY, 22, 30)))
        assertTrue(ZenSchedule.isActiveAt(w, calendar(Calendar.MONDAY, 23, 59)))
        // Tuesday morning is the tail of Monday's window.
        assertTrue(ZenSchedule.isActiveAt(w, calendar(Calendar.TUESDAY, 0, 29)))
        assertFalse(ZenSchedule.isActiveAt(w, calendar(Calendar.TUESDAY, 0, 30)))
        // Tuesday evening is not, because Tuesday is not a listed day.
        assertFalse(ZenSchedule.isActiveAt(w, calendar(Calendar.TUESDAY, 23, 0)))
    }

    @Test
    fun `activeWindow returns null when nothing matches`() {
        val windows = listOf(window(days = setOf(Calendar.MONDAY), startMinute = 60, endMinute = 120))
        assertNull(ZenSchedule.activeWindow(windows, calendar(Calendar.MONDAY, 5, 0)))
    }

    @Test
    fun `nextTransition inside a window is that window ending`() {
        val w = window(days = setOf(Calendar.MONDAY), startMinute = 9 * 60, endMinute = 11 * 60)
        val now = calendar(Calendar.MONDAY, 10, 0)

        val next = ZenSchedule.nextTransition(listOf(w), now.timeInMillis, UTC)
        checkNotNull(next)
        assertEquals("w1", next.second)
        assertFalse("a transition from inside a window must be an exit", next.third)
        assertEquals(calendar(Calendar.MONDAY, 11, 0).timeInMillis, next.first)
    }

    @Test
    fun `nextTransition outside every window is the soonest start`() {
        val early = window(id = "early", days = setOf(Calendar.MONDAY), startMinute = 9 * 60, endMinute = 10 * 60)
        val late = window(id = "late", days = setOf(Calendar.MONDAY), startMinute = 20 * 60, endMinute = 21 * 60)
        val now = calendar(Calendar.MONDAY, 7, 0)

        val next = ZenSchedule.nextTransition(listOf(early, late), now.timeInMillis, UTC)
        checkNotNull(next)
        assertEquals("early", next.second)
        assertTrue("a transition from outside every window must be an entry", next.third)
        assertEquals(calendar(Calendar.MONDAY, 9, 0).timeInMillis, next.first)
    }

    @Test
    fun `nextTransition is null when no window is enabled`() {
        val w = window(days = setOf(Calendar.MONDAY), startMinute = 60, endMinute = 120, enabled = false)
        assertNull(ZenSchedule.nextTransition(listOf(w), calendar(Calendar.MONDAY, 0, 0).timeInMillis, UTC))
        assertNull(ZenSchedule.nextTransition(emptyList(), calendar(Calendar.MONDAY, 0, 0).timeInMillis, UTC))
    }

    @Test
    fun `serialisation round trips every field and caps the list`() {
        val windows = (1..ZenSchedule.MAX_WINDOWS + 5).map {
            window(id = "w$it", days = setOf(Calendar.FRIDAY), startMinute = it, endMinute = it + 30)
        }
        val restored = ZenSchedule.fromJson(ZenSchedule.toJson(windows))

        assertEquals(ZenSchedule.MAX_WINDOWS, restored.size)
        assertEquals("w1", restored.first().id)
        assertEquals(setOf(Calendar.FRIDAY), restored.first().daysOfWeek)
        assertEquals(1, restored.first().startMinute)
        assertEquals(31, restored.first().endMinute)
        assertTrue(restored.first().allowPriorityOnly)
        assertFalse(restored.first().startFocus)
    }

    @Test
    fun `malformed entries are skipped rather than discarding the whole schedule`() {
        val good = window(id = "good", days = setOf(Calendar.MONDAY), startMinute = 100, endMinute = 200)
        val json = "[${good.toJson()},{\"id\":\"bad\"},{\"nonsense\":true}]"

        val restored = ZenSchedule.fromJson(json)
        assertEquals(1, restored.size)
        assertEquals("good", restored.first().id)
    }

    private companion object {
        val UTC: TimeZone = TimeZone.getTimeZone("UTC")
    }
}
