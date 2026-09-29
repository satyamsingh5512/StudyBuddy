package `in`.satym.studybuddy.nudges

import android.content.Context
import android.content.SharedPreferences

/**
 * Settings and rate-limit state for the nudges package.
 *
 * Each feature stores its own configuration in the studybuddy_nudges SharedPreferences
 * file, separate from DigitalDisciplinePreferences.
 */
class NudgesPreferences(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    // Focus nudges settings
    fun focusNudgesEnabled(): Boolean = prefs.getBoolean(KEY_FOCUS_NUDGES_ENABLED, true)
    fun setFocusNudgesEnabled(enabled: Boolean) = prefs.edit().putBoolean(KEY_FOCUS_NUDGES_ENABLED, enabled).apply()

    fun studyPackages(): List<String> {
        val csv = prefs.getString(KEY_STUDY_PACKAGES, "") ?: ""
        return if (csv.isBlank()) emptyList() else csv.split(",").filter { it.isNotBlank() }
    }

    fun setStudyPackages(packages: List<String>) {
        prefs.edit().putString(KEY_STUDY_PACKAGES, packages.joinToString(",")).apply()
    }

    // Focus nudge rate limiting (per session)
    fun sessionNudgeCount(sessionId: String): Int {
        return prefs.getInt("$KEY_SESSION_NUDGE_COUNT_PREFIX$sessionId", 0)
    }

    fun incrementSessionNudgeCount(sessionId: String): Int {
        val key = "$KEY_SESSION_NUDGE_COUNT_PREFIX$sessionId"
        val current = prefs.getInt(key, 0)
        val updated = current + 1
        prefs.edit().putInt(key, updated).apply()
        return updated
    }

    fun sessionLastNudgeMs(sessionId: String): Long {
        return prefs.getLong("$KEY_SESSION_LAST_NUDGE_PREFIX$sessionId", 0L)
    }

    fun setSessionLastNudgeMs(sessionId: String, atMs: Long) {
        prefs.edit().putLong("$KEY_SESSION_LAST_NUDGE_PREFIX$sessionId", atMs).apply()
    }

    fun clearSessionNudgeState(sessionId: String) {
        prefs.edit()
            .remove("$KEY_SESSION_NUDGE_COUNT_PREFIX$sessionId")
            .remove("$KEY_SESSION_LAST_NUDGE_PREFIX$sessionId")
            .apply()
    }

    // Study reminders settings
    data class ReminderSchedule(
        val enabled: Boolean,
        val timesMinutesOfDay: List<Int>,
        val enabledDays: Set<Int>,
        val idleNudgeEnabled: Boolean
    )

    fun reminderSchedule(): ReminderSchedule {
        val enabled = prefs.getBoolean(KEY_REMINDER_ENABLED, false)
        val timesStr = prefs.getString(KEY_REMINDER_TIMES, "") ?: ""
        val times = if (timesStr.isBlank()) emptyList() else timesStr.split(",").mapNotNull { it.toIntOrNull() }
        val daysStr = prefs.getString(KEY_REMINDER_DAYS, "") ?: ""
        val days = if (daysStr.isBlank()) emptySet() else daysStr.split(",").mapNotNull { it.toIntOrNull() }.toSet()
        val idleNudge = prefs.getBoolean(KEY_REMINDER_IDLE_NUDGE, true)
        return ReminderSchedule(enabled, times, days, idleNudge)
    }

    fun setReminderSchedule(schedule: ReminderSchedule) {
        prefs.edit()
            .putBoolean(KEY_REMINDER_ENABLED, schedule.enabled)
            .putString(KEY_REMINDER_TIMES, schedule.timesMinutesOfDay.joinToString(","))
            .putString(KEY_REMINDER_DAYS, schedule.enabledDays.joinToString(","))
            .putBoolean(KEY_REMINDER_IDLE_NUDGE, schedule.idleNudgeEnabled)
            .apply()
    }

    companion object {
        private const val PREFS_NAME = "studybuddy_nudges"
        private const val KEY_FOCUS_NUDGES_ENABLED = "focus_nudges_enabled"
        private const val KEY_STUDY_PACKAGES = "study_packages"
        private const val KEY_SESSION_NUDGE_COUNT_PREFIX = "session_nudge_count_"
        private const val KEY_SESSION_LAST_NUDGE_PREFIX = "session_last_nudge_ms_"
        private const val KEY_REMINDER_ENABLED = "reminder_enabled"
        private const val KEY_REMINDER_TIMES = "reminder_times"
        private const val KEY_REMINDER_DAYS = "reminder_days"
        private const val KEY_REMINDER_IDLE_NUDGE = "reminder_idle_nudge"
    }
}
