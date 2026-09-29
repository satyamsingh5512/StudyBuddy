package `in`.satym.studybuddy.nudges

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import `in`.satym.studybuddy.MainActivity
import `in`.satym.studybuddy.R
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplineDatabase
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplinePreferences
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.concurrent.Executors

/**
 * Daily study reminders at user-chosen times with optional app-launch actions.
 *
 * Implementation uses AlarmManager to schedule only the NEXT reminder. After
 * each reminder fires, it reschedules the next one. Receivers restore the
 * schedule after reboot, package replacement, time changes.
 *
 * Features:
 *  - Scheduled times (minutes-of-day) + enabled days-of-week
 *  - Up to 3 study-app quick-launch actions
 *  - Optional "idle nudge" when today's focus time is 0
 */
object StudyReminders {
    private const val CHANNEL_ID = "studybuddy-study-reminder"
    private const val NOTIFICATION_ID = 9331
    private const val ACTION_REMIND = "in.satym.studybuddy.nudges.REMIND"
    private const val REQUEST_CODE_REMINDER = 9332
    private const val MAX_APP_ACTIONS = 3

    data class StudyReminderConfig(
        val enabled: Boolean,
        val timesMinutesOfDay: List<Int>,
        val enabledDays: Set<Int>,
        val idleNudgeEnabled: Boolean
    )

    /**
     * Configure the reminder schedule. This cancels any existing alarm and
     * reschedules based on the new settings.
     */
    fun setSchedule(context: Context, times: List<Int>, days: Set<Int>, enabled: Boolean) {
        val prefs = NudgesPreferences(context)
        val schedule = NudgesPreferences.ReminderSchedule(
            enabled = enabled,
            timesMinutesOfDay = times,
            enabledDays = days,
            idleNudgeEnabled = prefs.reminderSchedule().idleNudgeEnabled
        )
        prefs.setReminderSchedule(schedule)
        reschedule(context)
    }

    fun schedule(context: Context): List<Int> {
        return NudgesPreferences(context).reminderSchedule().timesMinutesOfDay
    }

    fun config(context: Context): StudyReminderConfig {
        val schedule = NudgesPreferences(context).reminderSchedule()
        return StudyReminderConfig(
            schedule.enabled,
            schedule.timesMinutesOfDay,
            schedule.enabledDays,
            schedule.idleNudgeEnabled
        )
    }

    /**
     * Reschedule the next reminder based on current settings.
     * Called after configuration changes and by receivers after each reminder fires.
     */
    internal fun reschedule(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val intent = Intent(context, StudyReminderReceiver::class.java).apply {
            action = ACTION_REMIND
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            REQUEST_CODE_REMINDER,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Cancel any existing alarm
        alarmManager.cancel(pendingIntent)

        val schedule = NudgesPreferences(context).reminderSchedule()
        if (!schedule.enabled || schedule.timesMinutesOfDay.isEmpty() || schedule.enabledDays.isEmpty()) {
            return
        }

        val nextTrigger = ReminderMath.nextTrigger(
            schedule.timesMinutesOfDay,
            schedule.enabledDays,
            Calendar.getInstance()
        ) ?: return

        // Schedule exact when allowed, otherwise inexact
        val triggerMs = nextTrigger.timeInMillis
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (alarmManager.canScheduleExactAlarms()) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMs, pendingIntent)
            } else {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMs, pendingIntent)
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMs, pendingIntent)
        } else {
            alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerMs, pendingIntent)
        }
    }

    internal fun postReminder(context: Context) {
        val manager = NotificationManagerCompat.from(context)

        // Check notification permission on API 33+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (!manager.areNotificationsEnabled()) return
        }

        createChannel(context)

        val ddPrefs = DigitalDisciplinePreferences(context)
        val userId = ddPrefs.userId()

        val nudgePrefs = NudgesPreferences(context)
        val schedule = nudgePrefs.reminderSchedule()

        // Check if idle nudge should fire
        val isIdle = if (userId != null && schedule.idleNudgeEnabled) {
            checkIfIdle(context, userId)
        } else false

        val (title, text) = if (isIdle) {
            context.getString(R.string.studybuddy_nudges_reminder_idle_title) to
                    context.getString(R.string.studybuddy_nudges_reminder_idle_text)
        } else {
            context.getString(R.string.studybuddy_nudges_reminder_title) to
                    context.getString(R.string.studybuddy_nudges_reminder_text)
        }

        val openIntent = PendingIntent.getActivity(
            context,
            NOTIFICATION_ID,
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_studybuddy)
            .setContentTitle(title)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(openIntent)

        // Add up to 3 study app actions
        val studyPackages = nudgePrefs.studyPackages().take(MAX_APP_ACTIONS)
        val pm = context.packageManager
        studyPackages.forEachIndexed { index, packageName ->
            val launchIntent = pm.getLaunchIntentForPackage(packageName)
            if (launchIntent != null) {
                val appLabel = getAppLabel(context, packageName)
                val actionIntent = PendingIntent.getActivity(
                    context,
                    NOTIFICATION_ID + 10 + index,
                    launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                builder.addAction(
                    0,
                    context.getString(R.string.studybuddy_nudges_reminder_action_open, appLabel),
                    actionIntent
                )
            }
        }

        manager.notify(NOTIFICATION_ID, builder.build())
    }

    private fun checkIfIdle(context: Context, userId: String): Boolean {
        val dao = DigitalDisciplineDatabase.get(context).dao()
        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val todayKey = dateFormat.format(Calendar.getInstance().time)
        val summary = dao.dailySummary(userId, todayKey)
        return (summary?.focusTimeMs ?: 0L) == 0L
    }

    private fun getAppLabel(context: Context, packageName: String): String {
        return try {
            val pm = context.packageManager
            val info = pm.getApplicationInfo(packageName, 0)
            pm.getApplicationLabel(info).toString()
        } catch (e: PackageManager.NameNotFoundException) {
            packageName
        }
    }

    private fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        val channel = NotificationChannel(
            CHANNEL_ID,
            context.getString(R.string.studybuddy_nudges_reminder_channel_name),
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = context.getString(R.string.studybuddy_nudges_reminder_channel_description)
            setShowBadge(true)
        }
        manager.createNotificationChannel(channel)
    }
}

/**
 * Receives scheduled study reminder alarms.
 *
 * Posts the notification and then reschedules the next reminder using goAsync
 * to ensure the work completes before the receiver is killed.
 */
class StudyReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != "in.satym.studybuddy.nudges.REMIND") return

        val pending = goAsync()
        val executor = Executors.newSingleThreadExecutor()
        executor.execute {
            try {
                StudyReminders.postReminder(context)
                StudyReminders.reschedule(context)
            } finally {
                pending.finish()
                executor.shutdown()
            }
        }
    }
}

/**
 * Restores the reminder schedule after system events that clear alarms:
 * - BOOT_COMPLETED
 * - MY_PACKAGE_REPLACED
 * - TIME_SET (user changed the time)
 * - TIMEZONE_CHANGED
 */
class NudgesRestoreReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED -> {
                // Reschedule all nudges on a background thread
                val pending = goAsync()
                val executor = Executors.newSingleThreadExecutor()
                executor.execute {
                    try {
                        StudyReminders.reschedule(context)
                    } finally {
                        pending.finish()
                        executor.shutdown()
                    }
                }
            }
        }
    }
}
