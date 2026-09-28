package `in`.satym.studybuddy.rewards

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import `in`.satym.studybuddy.MainActivity
import `in`.satym.studybuddy.R
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplineDatabase
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplinePreferences
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/**
 * Encouragement notifications for real, already-recorded progress.
 *
 * Every figure here is derived from the daily usage summaries the user already
 * has. Nothing is invented, nothing is compared to a synthetic opponent, and
 * nothing is awarded for opening the app. If a streak breaks, the notification
 * says so plainly rather than shaming the user.
 *
 * All of it is opt-in: StudyBuddy never sends an encouragement notification
 * without `progressNotificationsEnabled`.
 */
data class ProgressState(
    val streakDays: Int,
    val todayFocusMinutes: Long,
    val dailyGoalMinutes: Int,
    val weekFocusMinutes: Long,
    val milestonesHit: List<String>
) {
    /** Only fires when the goal is actually met, so an unmet goal is never flattered. */
    fun goalMet(): Boolean = dailyGoalMinutes > 0 && todayFocusMinutes >= dailyGoalMinutes
}

class ProgressNotifier(private val context: Context) {
    private val dateKeyFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    fun stateFor(userId: String): ProgressState {
        val preferences = DigitalDisciplinePreferences(context)
        val goal = preferences.focusDailyGoalMinutes()
        val dao = DigitalDisciplineDatabase.get(context).dao()

        val now = Calendar.getInstance()
        val todayKey = dateKeyFormat.format(now.time)
        val today = dao.dailySummary(userId, todayKey)

        val weekStart = (now.clone() as Calendar).apply {
            set(Calendar.DAY_OF_WEEK, firstDayOfWeek)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val weekFocus = dao.dailySummariesInRange(userId, dateKeyFormat.format(weekStart.time), todayKey)

        return ProgressState(
            streakDays = streakLength(userId),
            todayFocusMinutes = (today?.focusTimeMs ?: 0L) / 60_000L,
            dailyGoalMinutes = goal,
            weekFocusMinutes = weekFocus.sumOf { it.focusTimeMs } / 60_000L,
            milestonesHit = milestones((today?.focusTimeMs ?: 0L) / 60_000L, goal)
        )
    }

    /**
     * Consecutive days ending today or yesterday that recorded any focus time.
     * Today not yet being focused does not break the streak, otherwise the count
     * would reset every morning before the user has studied at all.
     */
    fun streakLength(userId: String): Int {
        val dao = DigitalDisciplineDatabase.get(context).dao()
        val calendar = Calendar.getInstance()
        val todayKey = dateKeyFormat.format(calendar.time)
        val todayFocused = (dao.dailySummary(userId, todayKey)?.focusTimeMs ?: 0L) > 0L

        var streak = 0
        var probe = calendar.clone() as Calendar
        if (!todayFocused) {
            probe.add(Calendar.DAY_OF_YEAR, -1)
            if ((dao.dailySummary(userId, dateKeyFormat.format(probe.time))?.focusTimeMs ?: 0L) <= 0L) {
                return 0
            }
        }
        // Bounded so a corrupt or hand-edited database cannot spin here.
        while (streak < 3650) {
            val focused = (dao.dailySummary(userId, dateKeyFormat.format(probe.time))?.focusTimeMs ?: 0L) > 0L
            if (!focused) break
            streak += 1
            probe.add(Calendar.DAY_OF_YEAR, -1)
        }
        return streak
    }

    private fun milestones(todayFocusMinutes: Long, goal: Int): List<String> {
        val hit = mutableListOf<String>()
        for (mark in MILESTONES) {
            if (goal > 0 && todayFocusMinutes >= mark && todayFocusMinutes < mark + 25) hit += "${mark}m"
        }
        return hit
    }

    /**
     * Posts at most one notification per day, and only for a real reason: the
     * daily goal being met, a streak milestone, or a streak that has lapsed.
     */
    fun notifyIfWorthwhile(userId: String) {
        val preferences = DigitalDisciplinePreferences(context)
        if (!preferences.progressNotificationsEnabled()) return

        val state = stateFor(userId)
        val todayKey = dateKeyFormat.format(Calendar.getInstance().time)
        if (preferences.lastProgressNotificationKey() == todayKey) return

        val message = when {
            state.milestonesHit.isNotEmpty() && state.goalMet() ->
                "Day ${state.streakDays} \u00b7 ${state.todayFocusMinutes} min focused, goal reached"
            state.goalMet() ->
                "${state.todayFocusMinutes} min focused \u00b7 day ${state.streakDays} streak"
            state.milestonesHit.isNotEmpty() ->
                "${state.todayFocusMinutes} min focused \u00b7 day ${state.streakDays} streak"
            else -> return
        }

        preferences.setLastProgressNotificationKey(todayKey)
        post(context, "Progress", message)
    }

    /** Announces that a streak ended. Deliberately factual, no guilt framing. */
    fun notifyStreakEnded(userId: String, previousStreak: Int) {
        val preferences = DigitalDisciplinePreferences(context)
        if (!preferences.progressNotificationsEnabled()) return
        if (previousStreak < 2) return
        post(
            context,
            "Streak ended",
            "Your ${previousStreak}-day focus streak ended. Today's total starts a new one."
        )
    }

    private fun post(context: Context, title: String, body: String) {
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        createChannel(manager)
        val open = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        manager.notify(
            NOTIFICATION_ID,
            NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_studybuddy)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true)
                .setContentIntent(open)
                .build()
        )
    }

    private fun createChannel(manager: NotificationManager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.progress_channel_name),
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = context.getString(R.string.progress_channel_description)
                setShowBadge(true)
            }
        )
    }

    companion object {
        private const val CHANNEL_ID = "studybuddy-progress"
        private const val NOTIFICATION_ID = 9320
        private val MILESTONES = intArrayOf(25, 50, 100, 180)
    }
}
