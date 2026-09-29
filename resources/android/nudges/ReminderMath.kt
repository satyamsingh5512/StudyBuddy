package `in`.satym.studybuddy.nudges

import java.util.Calendar

/**
 * Pure next-reminder computation, testable with java.util only.
 *
 * Given a set of scheduled times (minutes-of-day) and enabled days (0=Sunday
 * through 6=Saturday), finds the next absolute wall-clock trigger after `now`.
 *
 * Returns null when no schedule is configured or all future times are disabled.
 */
object ReminderMath {
    /**
     * @param timesMinutesOfDay each value is 0..1439 (minutes since local midnight)
     * @param enabledDays set of Calendar.DAY_OF_WEEK values (1=Sunday..7=Saturday)
     * @param now current wall-clock time
     * @return the next scheduled trigger, or null if none
     */
    fun nextTrigger(
        timesMinutesOfDay: List<Int>,
        enabledDays: Set<Int>,
        now: Calendar
    ): Calendar? {
        if (timesMinutesOfDay.isEmpty() || enabledDays.isEmpty()) return null

        val sorted = timesMinutesOfDay.distinct().sorted()
        val probe = now.clone() as Calendar

        // Search up to 8 days (7 days + partial current day) to handle edge cases
        for (daysAhead in 0..7) {
            val dayOfWeek = probe.get(Calendar.DAY_OF_WEEK)
            if (dayOfWeek !in enabledDays) {
                probe.add(Calendar.DAY_OF_YEAR, 1)
                probe.set(Calendar.HOUR_OF_DAY, 0)
                probe.set(Calendar.MINUTE, 0)
                probe.set(Calendar.SECOND, 0)
                probe.set(Calendar.MILLISECOND, 0)
                continue
            }

            val nowMinute = if (daysAhead == 0) {
                probe.get(Calendar.HOUR_OF_DAY) * 60 + probe.get(Calendar.MINUTE)
            } else {
                -1 // any time today is valid when we've advanced to a future day
            }

            for (scheduledMinute in sorted) {
                if (scheduledMinute > nowMinute) {
                    val trigger = probe.clone() as Calendar
                    trigger.set(Calendar.HOUR_OF_DAY, scheduledMinute / 60)
                    trigger.set(Calendar.MINUTE, scheduledMinute % 60)
                    trigger.set(Calendar.SECOND, 0)
                    trigger.set(Calendar.MILLISECOND, 0)
                    return trigger
                }
            }

            // No valid time today; move to tomorrow
            probe.add(Calendar.DAY_OF_YEAR, 1)
            probe.set(Calendar.HOUR_OF_DAY, 0)
            probe.set(Calendar.MINUTE, 0)
            probe.set(Calendar.SECOND, 0)
            probe.set(Calendar.MILLISECOND, 0)
        }

        return null
    }
}
