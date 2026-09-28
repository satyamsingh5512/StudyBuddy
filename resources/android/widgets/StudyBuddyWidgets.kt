package `in`.satym.studybuddy.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import `in`.satym.studybuddy.MainActivity
import `in`.satym.studybuddy.R
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplineDatabase
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplinePreferences
import `in`.satym.studybuddy.digitaldiscipline.FocusEngine
import `in`.satym.studybuddy.digitaldiscipline.FocusState
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import kotlin.math.max

/**
 * StudyBuddy home-screen widgets.
 *
 * These are built on RemoteViews rather than a Compose-based widget library so
 * that StudyBuddy takes on no extra dependency, and no extra APK weight, purely
 * to put a number on the home screen.
 *
 * Two rules govern every widget here:
 *
 *  1. A widget may only display data the local Room database already owns, so a
 *     widget can never surface a figure the app itself would not show.
 *  2. All widgets share a single snapshot read and fall back to a signed-out
 *     placeholder, so one account's history can never appear on a shared device.
 */

private val dateKeyFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)

data class WidgetSnapshot(
    val signedIn: Boolean,
    val focusActive: Boolean,
    val focusRemainingMinutes: Long,
    val focusSubject: String,
    val todayFocusMinutes: Long,
    val todayStudyMinutes: Long,
    val todayScreenMinutes: Long,
    val todayDoomscrollMinutes: Long,
    val blockedToday: Int,
    val weekFocusMinutes: Long,
    val weekActiveDays: Int,
    val dailyFocusGoalMinutes: Int,
    val dayOfMonth: Int,
    val daysInMonth: Int
)

fun readWidgetSnapshot(context: Context): WidgetSnapshot {
    val preferences = DigitalDisciplinePreferences(context)
    val calendar = Calendar.getInstance()

    // Day-of-month is a device fact rather than account data, so it is safe to
    // compute before we know who is signed in.
    val dayOfMonth = calendar.get(Calendar.DAY_OF_MONTH)
    val daysInMonth = calendar.getActualMaximum(Calendar.DAY_OF_MONTH)
    val goalMinutes = preferences.focusDailyGoalMinutes()

    val userId = preferences.userId()
    if (userId.isNullOrBlank()) {
        return WidgetSnapshot(
            signedIn = false,
            focusActive = false,
            focusRemainingMinutes = 0,
            focusSubject = "",
            todayFocusMinutes = 0,
            todayStudyMinutes = 0,
            todayScreenMinutes = 0,
            todayDoomscrollMinutes = 0,
            blockedToday = 0,
            weekFocusMinutes = 0,
            weekActiveDays = 0,
            dailyFocusGoalMinutes = goalMinutes,
            dayOfMonth = dayOfMonth,
            daysInMonth = daysInMonth
        )
    }

    val dao = DigitalDisciplineDatabase.get(context).dao()
    val today = dao.dailySummary(userId, dateKeyFormat.format(calendar.time))

    val weekStart = (calendar.clone() as Calendar).apply {
        set(Calendar.DAY_OF_WEEK, firstDayOfWeek)
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }
    val week = dao.dailySummariesBetween(userId, dateKeyFormat.format(weekStart.time))

    val session = dao.activeFocus(userId)
    val state = runCatching { FocusState.valueOf(session?.state ?: "IDLE") }.getOrDefault(FocusState.IDLE)
    val focusActive = state == FocusState.ACTIVE
    val remaining = if (focusActive && session != null) {
        max(0L, session.configuredDurationMs - FocusEngine(dao).elapsedMs(session)) / 60_000L
    } else {
        0L
    }

    return WidgetSnapshot(
        signedIn = true,
        focusActive = focusActive,
        focusRemainingMinutes = remaining,
        focusSubject = session?.subject.orEmpty().take(80),
        todayFocusMinutes = (today?.focusTimeMs ?: 0L) / 60_000L,
        todayStudyMinutes = (today?.studyTimeMs ?: 0L) / 60_000L,
        todayScreenMinutes = (today?.screenTimeMs ?: 0L) / 60_000L,
        todayDoomscrollMinutes = (today?.doomscrollTimeMs ?: 0L) / 60_000L,
        blockedToday = today?.blockedAttempts ?: 0,
        weekFocusMinutes = week.sumOf { it.focusTimeMs } / 60_000L,
        weekActiveDays = week.count { it.focusTimeMs > 0L },
        dailyFocusGoalMinutes = goalMinutes,
        dayOfMonth = dayOfMonth,
        daysInMonth = daysInMonth
    )
}

private fun formatDuration(minutes: Long): String {
    if (minutes <= 0) return "0m"
    val hours = minutes / 60
    val remainder = minutes % 60
    return when {
        hours > 0 && remainder > 0 -> "${hours}h ${remainder}m"
        hours > 0 -> "${hours}h"
        else -> "${remainder}m"
    }
}

private const val SIGNED_OUT = "Sign in"

/**
 * Shared behaviour for every StudyBuddy widget: renders the one card layout and
 * wires a tap through to the app view the widget represents.
 */
abstract class StudyBuddyWidgetProvider : AppWidgetProvider() {
    abstract val tapAction: String

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val snapshot = readWidgetSnapshot(context)
        for (id in ids) {
            val views = RemoteViews(context.packageName, R.layout.studybuddy_widget_card)
            render(views, snapshot)
            views.setOnClickPendingIntent(R.id.studybuddy_widget_value, openApp(context))
            manager.updateAppWidget(id, views)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == AppWidgetManager.ACTION_APPWIDGET_UPDATE) {
            val ids = intent.getIntArrayExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS) ?: return
            onUpdate(context, AppWidgetManager.getInstance(context), ids)
        }
    }

    protected abstract fun render(views: RemoteViews, snapshot: WidgetSnapshot)

    protected fun signOut(views: RemoteViews, caption: String) {
        views.setTextViewText(R.id.studybuddy_widget_caption, caption)
        views.setTextViewText(R.id.studybuddy_widget_value, SIGNED_OUT)
        views.setTextViewText(R.id.studybuddy_widget_detail, "")
        views.setTextViewText(R.id.studybuddy_widget_detail_two, "")
        views.setTextViewText(R.id.studybuddy_widget_detail_three, "")
    }

    private fun openApp(context: Context): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("studybuddyWidget", tapAction)
        }
        val requestCode = javaClass.name.hashCode()
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}

class FocusWidgetProvider : StudyBuddyWidgetProvider() {
    override val tapAction = "focus"

    override fun render(views: RemoteViews, snapshot: WidgetSnapshot) {
        if (!snapshot.signedIn) return signOut(views, "Focus")
        views.setTextViewText(R.id.studybuddy_widget_caption, "Focus")
        if (snapshot.focusActive) {
            views.setTextViewText(
                R.id.studybuddy_widget_value,
                formatDuration(snapshot.focusRemainingMinutes)
            )
            views.setTextViewText(
                R.id.studybuddy_widget_detail,
                if (snapshot.focusSubject.isNotBlank()) snapshot.focusSubject else "Session in progress"
            )
        } else {
            views.setTextViewText(
                R.id.studybuddy_widget_value,
                formatDuration(snapshot.todayFocusMinutes)
            )
            views.setTextViewText(R.id.studybuddy_widget_detail, "focused today")
        }
        views.setTextViewText(R.id.studybuddy_widget_detail_two, "")
        views.setTextViewText(R.id.studybuddy_widget_detail_three, "")
    }
}

class UsageWidgetProvider : StudyBuddyWidgetProvider() {
    override val tapAction = "discipline"

    override fun render(views: RemoteViews, snapshot: WidgetSnapshot) {
        if (!snapshot.signedIn) return signOut(views, "Today")
        views.setTextViewText(R.id.studybuddy_widget_caption, "Today")
        views.setTextViewText(
            R.id.studybuddy_widget_value,
            formatDuration(snapshot.todayScreenMinutes)
        )
        views.setTextViewText(
            R.id.studybuddy_widget_detail,
            "Study ${formatDuration(snapshot.todayStudyMinutes)}"
        )
        views.setTextViewText(
            R.id.studybuddy_widget_detail_two,
            "Doomscroll ${formatDuration(snapshot.todayDoomscrollMinutes)}"
        )
        views.setTextViewText(R.id.studybuddy_widget_detail_three, "Blocked ${snapshot.blockedToday}")
    }
}

class StudyCalendarWidgetProvider : StudyBuddyWidgetProvider() {
    override val tapAction = "schedule"

    override fun render(views: RemoteViews, snapshot: WidgetSnapshot) {
        val month = SimpleDateFormat("MMMM", Locale.getDefault()).format(Calendar.getInstance().time)
        if (!snapshot.signedIn) return signOut(views, month)
        val progress = if (snapshot.daysInMonth > 0) {
            (100 * snapshot.dayOfMonth) / snapshot.daysInMonth
        } else {
            0
        }
        views.setTextViewText(R.id.studybuddy_widget_caption, month)
        views.setTextViewText(R.id.studybuddy_widget_value, "$progress%")
        views.setTextViewText(
            R.id.studybuddy_widget_detail,
            "day ${snapshot.dayOfMonth} of ${snapshot.daysInMonth}"
        )
        views.setTextViewText(R.id.studybuddy_widget_detail_two, "")
        views.setTextViewText(R.id.studybuddy_widget_detail_three, "")
    }
}

class StudyGoalWidgetProvider : StudyBuddyWidgetProvider() {
    override val tapAction = "goals"

    override fun render(views: RemoteViews, snapshot: WidgetSnapshot) {
        if (!snapshot.signedIn) return signOut(views, "This week")
        val target = snapshot.dailyFocusGoalMinutes.toLong() * 7L
        val progress = if (target > 0L) {
            ((100L * snapshot.weekFocusMinutes) / target).coerceIn(0L, 999L)
        } else {
            0L
        }
        views.setTextViewText(R.id.studybuddy_widget_caption, "This week")
        views.setTextViewText(
            R.id.studybuddy_widget_value,
            formatDuration(snapshot.weekFocusMinutes)
        )
        views.setTextViewText(
            R.id.studybuddy_widget_detail,
            "$progress% of ${formatDuration(target)}"
        )
        views.setTextViewText(
            R.id.studybuddy_widget_detail_two,
            "${snapshot.weekActiveDays} active days"
        )
        views.setTextViewText(R.id.studybuddy_widget_detail_three, "")
    }
}

class UnlockCountWidgetProvider : StudyBuddyWidgetProvider() {
    override val tapAction = "discipline"

    override fun render(views: RemoteViews, snapshot: WidgetSnapshot) {
        if (!snapshot.signedIn) return signOut(views, "Resisted")
        views.setTextViewText(R.id.studybuddy_widget_caption, "Resisted")
        views.setTextViewText(R.id.studybuddy_widget_value, "${snapshot.blockedToday}")
        views.setTextViewText(
            R.id.studybuddy_widget_detail,
            "distractions stopped today"
        )
        views.setTextViewText(R.id.studybuddy_widget_detail_two, "")
        views.setTextViewText(R.id.studybuddy_widget_detail_three, "")
    }
}

/** Fans a single refresh request out to every StudyBuddy widget. */
object WidgetRefresh {
    private val providers = listOf(
        FocusWidgetProvider::class.java,
        UsageWidgetProvider::class.java,
        StudyCalendarWidgetProvider::class.java,
        StudyGoalWidgetProvider::class.java,
        UnlockCountWidgetProvider::class.java
    )

    fun all(context: Context) {
        val manager = AppWidgetManager.getInstance(context) ?: return
        for (provider in providers) {
            val receiver = provider.getDeclaredConstructor(Context::class.java).newInstance(context)
            val component = android.content.ComponentName(context, provider)
            val ids = runCatching { manager.getAppWidgetIds(component) }.getOrNull() ?: continue
            if (ids.isEmpty()) continue
            receiver.onUpdate(context, manager, ids)
        }
    }
}
