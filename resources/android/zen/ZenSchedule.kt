package `in`.satym.studybuddy.zen

import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/**
 * A scheduled do-not-disturb study window.
 *
 * [daysOfWeek] contains [Calendar.SUNDAY] through [Calendar.SATURDAY] values.
 * [startMinute] and [endMinute] are minutes from local midnight (0..1439).
 * When [endMinute] <= [startMinute], the window crosses midnight and ends on
 * the next day; the day-of-week of the [startMinute] determines membership.
 *
 * [startFocus]: when true, also start a native focus session for the window duration.
 * [allowPriorityOnly]: true means DND will be INTERRUPTION_FILTER_PRIORITY (alarms/
 * starred contacts allowed); false means INTERRUPTION_FILTER_NONE (full silence).
 */
data class ZenWindow(
    val id: String,
    val label: String,
    val daysOfWeek: Set<Int>,
    val startMinute: Int,
    val endMinute: Int,
    val enabled: Boolean,
    val startFocus: Boolean,
    val allowPriorityOnly: Boolean
) {
    init {
        require(startMinute in 0..1439) { "startMinute must be 0..1439" }
        require(endMinute in 0..1439) { "endMinute must be 0..1439" }
        require(daysOfWeek.all { it in Calendar.SUNDAY..Calendar.SATURDAY }) {
            "daysOfWeek must contain Calendar.SUNDAY..SATURDAY"
        }
    }

    /**
     * Encodes a ZenWindow to JSON, preserving all fields.
     */
    fun toJson(): JSONObject = JSONObject().apply {
        put("id", id)
        put("label", label)
        put("daysOfWeek", JSONArray(daysOfWeek.sorted()))
        put("startMinute", startMinute)
        put("endMinute", endMinute)
        put("enabled", enabled)
        put("startFocus", startFocus)
        put("allowPriorityOnly", allowPriorityOnly)
    }

    companion object {
        /**
         * Decodes a ZenWindow from JSON, validating ranges.
         * Throws JSONException or IllegalArgumentException on bad data.
         */
        fun fromJson(obj: JSONObject): ZenWindow {
            val daysArray = obj.getJSONArray("daysOfWeek")
            val days = (0 until daysArray.length()).map { daysArray.getInt(it) }.toSet()
            return ZenWindow(
                id = obj.getString("id"),
                label = obj.getString("label"),
                daysOfWeek = days,
                startMinute = obj.getInt("startMinute"),
                endMinute = obj.getInt("endMinute"),
                enabled = obj.getBoolean("enabled"),
                startFocus = obj.getBoolean("startFocus"),
                allowPriorityOnly = obj.getBoolean("allowPriorityOnly")
            )
        }
    }
}

/**
 * Pure scheduling logic with no Android framework dependencies beyond java.util.
 *
 * All calculations are timezone-aware and handle midnight-crossing windows correctly.
 */
object ZenSchedule {
    /** Maximum number of windows to prevent unbounded lists. */
    const val MAX_WINDOWS = 20

    /**
     * Checks if [window] is active at the given [now] moment.
     *
     * Midnight-crossing logic: if [window.endMinute] <= [window.startMinute], the
     * window spans two calendar days. The day-of-week of [startMinute] determines
     * membership, so a window that starts Monday 23:00 and ends 01:00 is active
     * Monday 23:00–23:59 and Tuesday 00:00–00:59, and it is a Monday window.
     */
    fun isActiveAt(window: ZenWindow, now: Calendar): Boolean {
        if (!window.enabled) return false

        val nowMinute = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
        val nowDay = now.get(Calendar.DAY_OF_WEEK)

        val crossesMidnight = window.endMinute <= window.startMinute

        return if (!crossesMidnight) {
            // Normal same-day window
            nowDay in window.daysOfWeek && nowMinute in window.startMinute until window.endMinute
        } else {
            // Midnight-crossing window spans two days
            if (nowDay in window.daysOfWeek && nowMinute >= window.startMinute) {
                // In the start day after start time
                true
            } else {
                // Check if we're in the next day before end time
                val yesterday = if (nowDay == Calendar.SUNDAY) Calendar.SATURDAY else nowDay - 1
                yesterday in window.daysOfWeek && nowMinute < window.endMinute
            }
        }
    }

    /**
     * Returns the window currently active at [now], or null if none.
     *
     * If multiple windows overlap, returns the first match.
     */
    fun activeWindow(windows: List<ZenWindow>, now: Calendar): ZenWindow? =
        windows.firstOrNull { isActiveAt(it, now) }

    /**
     * Computes the next transition point (window start or end) after [nowMs].
     *
     * @return Triple of (atMs, windowId, starting) where [starting] is true for a
     *         window entering, false for exiting. Returns null if no enabled windows.
     */
    fun nextTransition(windows: List<ZenWindow>, nowMs: Long, timeZone: java.util.TimeZone): Triple<Long, String, Boolean>? {
        val enabled = windows.filter { it.enabled }
        if (enabled.isEmpty()) return null

        val now = Calendar.getInstance(timeZone).apply { timeInMillis = nowMs }
        val activeNow = activeWindow(enabled, now)

        data class Event(val ms: Long, val windowId: String, val starting: Boolean)
        val events = mutableListOf<Event>()

        // Collect all start and end points from yesterday through the next 8 days.
        //
        // The scan has to begin at -1, not 0. A midnight-crossing window that is
        // currently in its post-midnight tail started *yesterday*, and its end event
        // is generated from its start day. Starting at 0 produced no end event for it
        // today, so the "next transition" resolved to the same window a week later and
        // Do Not Disturb stayed engaged for days. Yesterday's other events are all in
        // the past and are filtered out by the `> nowMs` checks below.
        for (offset in -1..7) {
            val day = (now.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, offset) }
            val dayOfWeek = day.get(Calendar.DAY_OF_WEEK)

            for (window in enabled) {
                // Start event
                if (dayOfWeek in window.daysOfWeek) {
                    val startCal = (day.clone() as Calendar).apply {
                        set(Calendar.HOUR_OF_DAY, window.startMinute / 60)
                        set(Calendar.MINUTE, window.startMinute % 60)
                        set(Calendar.SECOND, 0)
                        set(Calendar.MILLISECOND, 0)
                    }
                    if (startCal.timeInMillis > nowMs) {
                        events.add(Event(startCal.timeInMillis, window.id, true))
                    }
                }

                // End event (may be next day for midnight-crossing windows)
                val endDayOffset = if (window.endMinute <= window.startMinute) 1 else 0
                val endDay = (day.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, endDayOffset) }
                val endDayOfWeek = endDay.get(Calendar.DAY_OF_WEEK)
                
                // For midnight-crossing windows, the end is on the day *after* the scheduled day
                val belongsToThisWindow = if (window.endMinute <= window.startMinute) {
                    // Window started on dayOfWeek
                    dayOfWeek in window.daysOfWeek
                } else {
                    // Normal window
                    endDayOfWeek in window.daysOfWeek
                }

                if (belongsToThisWindow) {
                    val endCal = (endDay.clone() as Calendar).apply {
                        set(Calendar.HOUR_OF_DAY, window.endMinute / 60)
                        set(Calendar.MINUTE, window.endMinute % 60)
                        set(Calendar.SECOND, 0)
                        set(Calendar.MILLISECOND, 0)
                    }
                    if (endCal.timeInMillis > nowMs) {
                        events.add(Event(endCal.timeInMillis, window.id, false))
                    }
                }
            }
        }

        // If we're in a window now, the next event is that window ending
        if (activeNow != null) {
            return events
                .filter { !it.starting && it.windowId == activeNow.id }
                .minByOrNull { it.ms }
                ?.let { Triple(it.ms, it.windowId, it.starting) }
        }

        // Otherwise, next event is the soonest start
        return events.minByOrNull { it.ms }?.let { Triple(it.ms, it.windowId, it.starting) }
    }

    /**
     * Serializes a list of windows to JSON, capped at [MAX_WINDOWS].
     */
    fun toJson(windows: List<ZenWindow>): String {
        val capped = windows.take(MAX_WINDOWS)
        val array = JSONArray()
        capped.forEach { array.put(it.toJson()) }
        return array.toString()
    }

    /**
     * Deserializes windows from JSON, validating each and capping at [MAX_WINDOWS].
     * Invalid entries are skipped rather than failing the entire list.
     */
    fun fromJson(json: String): List<ZenWindow> {
        val array = JSONArray(json)
        val windows = mutableListOf<ZenWindow>()
        for (i in 0 until array.length().coerceAtMost(MAX_WINDOWS)) {
            try {
                windows.add(ZenWindow.fromJson(array.getJSONObject(i)))
            } catch (e: Exception) {
                // Skip invalid entries rather than failing the entire list
                continue
            }
        }
        return windows
    }
}
