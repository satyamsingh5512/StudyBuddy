package `in`.satym.studybuddy.shortsblock

import android.content.Context
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/**
 * Tracks distinct "next video" swipes in detected short-form feeds.
 *
 * Why this exists:
 * A daily allowance in minutes measures time but not engagement. A user can spend
 * their allowance watching 2 videos or 50. Swipe limits complement time limits by
 * capping the number of distinct videos consumed, which more directly measures the
 * addictive "just one more" behavior that these feeds encourage.
 *
 * How it works:
 * Every TYPE_VIEW_SCROLLED event in a detected short-form feed increments the
 * swipe counter for today, debounced to 600 ms so a single fling gesture that
 * generates multiple scroll events counts as one swipe. The counter is only
 * incremented while ShortFormDetector reports positive detection.
 *
 * Privacy:
 * Only a counter is stored; no video titles, URLs, or screen content are persisted.
 */
object ReelSwipeLimiter {
    private const val PREFS_NAME = "studybuddy_shortsblock_swipes"
    private const val KEY_DATE = "date"
    private const val KEY_COUNT = "count"
    private const val KEY_LAST_SWIPE_MS = "last_swipe_ms"

    /** A single fling emits several scroll events; they count as one swipe. */
    private const val DEBOUNCE_MS = 600L

    /**
     * Returns today's swipe count.
     */
    fun todayCount(context: Context): Int {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val today = todayKey()
        val recorded = prefs.getString(KEY_DATE, null)
        if (recorded != today) return 0
        return prefs.getInt(KEY_COUNT, 0)
    }

    /**
     * Record a swipe, debounced to 600 ms.
     *
     * @param nowMs Current monotonic time from SystemClock.elapsedRealtime().
     * @return True if the swipe was recorded (not debounced).
     */
    fun recordSwipe(context: Context, nowMs: Long): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val today = todayKey()
        val recorded = prefs.getString(KEY_DATE, null)
        val lastSwipeMs = prefs.getLong(KEY_LAST_SWIPE_MS, 0L)

        // Debounce: ignore swipes within 600 ms of the last one.
        //
        // elapsedRealtime() restarts at zero on reboot while the stored value does not,
        // so a negative delta means the clock was reset, not that two swipes were close
        // together. Treating it as a debounce hit would stop counting swipes entirely
        // until uptime passed the previously stored value.
        val delta = nowMs - lastSwipeMs
        if (delta in 0 until DEBOUNCE_MS) return false

        if (recorded != today) {
            // New day: reset counter
            prefs.edit().apply {
                putString(KEY_DATE, today)
                putInt(KEY_COUNT, 1)
                putLong(KEY_LAST_SWIPE_MS, nowMs)
                apply()
            }
            return true
        } else {
            // Same day: increment
            val count = prefs.getInt(KEY_COUNT, 0)
            prefs.edit().apply {
                putInt(KEY_COUNT, count + 1)
                putLong(KEY_LAST_SWIPE_MS, nowMs)
                apply()
            }
            return true
        }
    }

    /**
     * Check if the swipe limit (if configured) has been exceeded.
     *
     * @param limit The configured swipe limit (0 = disabled).
     * @return True if limit > 0 and today's count >= limit.
     */
    fun limitExceeded(context: Context, limit: Int): Boolean {
        if (limit <= 0) return false
        return todayCount(context) >= limit
    }

    private fun todayKey(): String {
        val calendar = Calendar.getInstance()
        return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(calendar.time)
    }
}
