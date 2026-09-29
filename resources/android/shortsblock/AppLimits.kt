package `in`.satym.studybuddy.shortsblock

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/**
 * A per-app usage limit and optional blocked time windows.
 *
 * [dailyLimitMinutes]: 0 = no daily limit, >0 = app is blocked after this many
 * minutes of foreground use today.
 *
 * [blockedWindows]: list of time windows during which the app is blocked regardless
 * of how much time has been used. Each window is [daysOfWeek, startMinute, endMinute].
 * Midnight-crossing is supported: when endMinute <= startMinute, the window spans
 * two calendar days and the day-of-week of startMinute determines membership.
 */
data class AppRule(
    val packageName: String,
    val dailyLimitMinutes: Int,
    val blockedWindows: List<BlockedWindow>
) {
    init {
        require(packageName.matches(Regex("^[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z0-9_]+)+$"))) {
            "Invalid package name: $packageName"
        }
        require(dailyLimitMinutes >= 0) { "dailyLimitMinutes must be >= 0" }
    }

    fun toJson(): JSONObject = JSONObject().apply {
        put("packageName", packageName)
        put("dailyLimitMinutes", dailyLimitMinutes)
        put("blockedWindows", JSONArray().apply {
            blockedWindows.forEach { put(it.toJson()) }
        })
    }

    companion object {
        fun fromJson(obj: JSONObject): AppRule {
            val windowsArray = obj.optJSONArray("blockedWindows") ?: JSONArray()
            val windows = (0 until windowsArray.length()).map {
                BlockedWindow.fromJson(windowsArray.getJSONObject(it))
            }
            return AppRule(
                packageName = obj.getString("packageName"),
                dailyLimitMinutes = obj.getInt("dailyLimitMinutes"),
                blockedWindows = windows
            )
        }
    }
}

/**
 * A time window during which an app is blocked.
 *
 * [daysOfWeek]: Set of Calendar.SUNDAY..SATURDAY values.
 * [startMinute], [endMinute]: minutes from local midnight (0..1439).
 * When endMinute <= startMinute, the window crosses midnight.
 */
data class BlockedWindow(
    val daysOfWeek: Set<Int>,
    val startMinute: Int,
    val endMinute: Int
) {
    init {
        require(startMinute in 0..1439) { "startMinute must be 0..1439" }
        require(endMinute in 0..1439) { "endMinute must be 0..1439" }
        require(daysOfWeek.all { it in Calendar.SUNDAY..Calendar.SATURDAY }) {
            "daysOfWeek must contain Calendar.SUNDAY..SATURDAY"
        }
    }

    fun toJson(): JSONObject = JSONObject().apply {
        put("daysOfWeek", JSONArray(daysOfWeek.sorted()))
        put("startMinute", startMinute)
        put("endMinute", endMinute)
    }

    companion object {
        fun fromJson(obj: JSONObject): BlockedWindow {
            val daysArray = obj.getJSONArray("daysOfWeek")
            val days = (0 until daysArray.length()).map { daysArray.getInt(it) }.toSet()
            return BlockedWindow(
                daysOfWeek = days,
                startMinute = obj.getInt("startMinute"),
                endMinute = obj.getInt("endMinute")
            )
        }
    }
}

/**
 * Pure scheduling and usage-tracking logic for app limits.
 *
 * No Android framework dependencies beyond java.util, so all math can be unit-tested.
 */
object AppLimits {
    /**
     * Check if [window] is active at the given [now] moment.
     *
     * Midnight-crossing logic matches ZenSchedule: if endMinute <= startMinute,
     * the window spans two days. The day-of-week of startMinute determines membership.
     */
    fun isWindowActiveAt(window: BlockedWindow, now: Calendar): Boolean {
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
     * Check if any of [rule]'s blocked windows are active at [now].
     */
    fun isInBlockedWindow(rule: AppRule, now: Calendar): Boolean =
        rule.blockedWindows.any { isWindowActiveAt(it, now) }

    /**
     * Format a blocked window's next end time as a human-readable string.
     *
     * @return A time string like "18:00" or null if not currently in a window.
     */
    fun nextWindowEndTime(rule: AppRule, now: Calendar): String? {
        val active = rule.blockedWindows.firstOrNull { isWindowActiveAt(it, now) } ?: return null
        val endHour = active.endMinute / 60
        val endMin = active.endMinute % 60
        return String.format(Locale.US, "%02d:%02d", endHour, endMin)
    }
}

/**
 * Persistent storage for app usage tracking.
 *
 * Usage is tracked per package per day in SharedPreferences. Each day's usage is
 * accumulated from TYPE_WINDOW_STATE_CHANGED transitions: when an app goes to the
 * background, the foreground duration is added to its daily total. A single stint
 * is capped at 30 minutes to avoid overcounting when events are missed.
 */
object AppUsageTracker {
    private const val PREFS_NAME = "studybuddy_shortsblock_usage"
    private const val MAX_STINT_SECONDS = 1800 // 30 minutes

    /**
     * Returns today's foreground seconds for [packageName].
     */
    fun todaySeconds(context: Context, packageName: String): Long {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val today = todayKey()
        val key = "$today:$packageName"
        return prefs.getLong(key, 0L)
    }

    /**
     * Returns a map of all packages with usage today.
     */
    fun allTodaySeconds(context: Context): Map<String, Long> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val today = todayKey()
        val prefix = "$today:"
        return prefs.all
            .filterKeys { it.startsWith(prefix) }
            .mapKeys { it.key.removePrefix(prefix) }
            .mapValues { (it.value as? Long) ?: 0L }
    }

    /**
     * Add [seconds] of foreground use to today's total for [packageName].
     *
     * The addition is capped at MAX_STINT_SECONDS to prevent overcounting when
     * the service misses a foreground-to-background transition.
     */
    fun addSeconds(context: Context, packageName: String, seconds: Long) {
        if (seconds <= 0) return
        val capped = seconds.coerceAtMost(MAX_STINT_SECONDS.toLong())
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val today = todayKey()
        val key = "$today:$packageName"
        val current = prefs.getLong(key, 0L)
        prefs.edit().putLong(key, current + capped).apply()
    }

    /**
     * Check if [rule]'s daily limit (if any) has been exceeded.
     *
     * @return True if dailyLimitMinutes > 0 and today's usage >= limit.
     */
    fun limitExceeded(context: Context, rule: AppRule): Boolean {
        if (rule.dailyLimitMinutes <= 0) return false
        val usedSeconds = todaySeconds(context, rule.packageName)
        return usedSeconds >= rule.dailyLimitMinutes * 60L
    }

    /**
     * Prune usage data older than 7 days.
     */
    fun pruneOldData(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val cutoff = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, -7) }
        val cutoffKey = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cutoff.time)
        val toDelete = prefs.all.keys.filter { key ->
            val date = key.substringBefore(':')
            date < cutoffKey
        }
        if (toDelete.isNotEmpty()) {
            prefs.edit().apply {
                toDelete.forEach { remove(it) }
                apply()
            }
        }
    }

    private fun todayKey(): String {
        val calendar = Calendar.getInstance()
        return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(calendar.time)
    }
}
