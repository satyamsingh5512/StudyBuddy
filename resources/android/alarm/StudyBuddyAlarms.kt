package `in`.satym.studybuddy.alarm

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import `in`.satym.studybuddy.R
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.UUID

/**
 * StudyBuddy alarms: an `AlarmManager` schedule with snooze, dismissal, and
 * reboot/timezone re-arming.
 *
 * The web app already schedules reminder *notifications* through Capacitor. This
 * adds what a notification cannot do:
 *
 *  - survive app death and reboot, because the trigger lives in AlarmManager
 *  - snooze for a further interval without touching the original trigger
 *  - a full-screen intent so an alarm can actually surface over a locked screen
 *  - re-arming after a timezone or clock change, since an absolute UTC trigger
 *    would otherwise fire at the wrong local time
 *
 * A snoozed alarm keeps its original trigger id, so restoring it is a single
 * reschedule rather than a growing list of pending alarms.
 */
object AlarmContract {
    const val ACTION_FIRE = "in.satym.studybuddy.alarm.FIRE"
    const val ACTION_SNOOZE = "in.satym.studybuddy.alarm.SNOOZE"
    const val ACTION_DISMISS = "in.satym.studybuddy.alarm.DISMISS"
    const val ACTION_RESTORE = "in.satym.studybuddy.alarm.RESTORE"

    const val EXTRA_ID = "id"
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"
    const val EXTRA_SNOOZE_MINUTES = "snoozeMinutes"
    const val EXTRA_SOURCE = "source"

    /** A wall-clock instant, so the alarm still means the same local time after DST shifts. */
    const val EXTRA_TRIGGER_AT_WALL_CLOCK = "triggerAtWallClock"

    const val DEFAULT_SNOOZE_MINUTES = 9

    const val CHANNEL_ID = "studybuddy-alarms"
    const val NOTIFICATION_CHANNEL_ID = "studybuddy-alarms-firing"
}

/** One scheduled alarm, as handed to the native layer by the web app. */
data class AlarmSpec(
    val id: Int,
    val title: String,
    val body: String,
    val triggerAtWallClockMs: Long,
    val snoozeMinutes: Int = AlarmContract.DEFAULT_SNOOZE_MINUTES
)

class AlarmScheduler(private val context: Context) {
    private val alarmManager: AlarmManager? = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
    private val store = AlarmStore(context)

    /**
     * Exact alarms are only permitted when the user has granted the special
     * access. Without it we still schedule, but with an inexact trigger: a
     * reminder a few minutes late is far better than no reminder at all, and
     * silently dropping the alarm would be worse than either.
     */
    fun canScheduleExact(): Boolean {
        val manager = alarmManager ?: return false
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) manager.canScheduleExactAlarms() else true
    }

    fun schedule(spec: AlarmSpec): Boolean {
        val manager = alarmManager ?: return false
        val at = spec.triggerAtWallClockMs
        if (at <= System.currentTimeMillis()) return false

        val trigger = if (canScheduleExact()) {
            AlarmManager.RTC_WAKEUP
        } else {
            AlarmManager.RTC
        }
        val operation = firePendingIntent(spec.id, spec)
        val canExact = canScheduleExact()
        runCatching {
            if (canExact) manager.setExactAndAllowWhileIdle(trigger, at, operation)
            else manager.set(trigger, at, operation)
        }.onFailure { return false }

        store.upsert(
            StoredAlarm(
                id = spec.id,
                title = spec.title,
                body = spec.body,
                triggerAtWallClockMs = at,
                snoozeMinutes = spec.snoozeMinutes,
                state = STATE_SCHEDULED
            )
        )
        return true
    }

    fun cancel(id: Int) {
        alarmManager?.cancel(firePendingIntent(id, null))
        store.delete(id)
    }

    fun cancelAll() {
        for (alarm in store.all()) cancel(alarm.id)
    }

    /**
     * Re-arms every stored alarm that has not yet fired. Called after boot, and
     * after a clock or timezone change, because AlarmManager's absolute triggers
     * are cleared by a reboot and a fixed UTC instant would otherwise land at the
     * wrong local time once the offset moves.
     */
    fun restorePending() {
        val now = System.currentTimeMillis()
        for (alarm in store.all()) {
            if (alarm.state == STATE_FIRED || alarm.state == STATE_DISMISSED) continue
            if (alarm.triggerAtWallClockMs <= now) continue
            schedule(alarm.toSpec())
        }
    }

    fun snooze(id: Int): Boolean {
        val stored = store.find(id) ?: return false
        val minutes = stored.snoozeMinutes.coerceIn(1, 120)
        val spec = stored.copy(
            triggerAtWallClockMs = System.currentTimeMillis() + minutes * 60_000L,
            state = STATE_SNOOZED
        )
        store.upsert(spec)
        // Reschedule the same trigger id so the original pending intent is
        // replaced rather than a second alarm being added alongside it.
        return schedule(spec.toSpec())
    }

    fun dismiss(id: Int) {
        alarmManager?.cancel(firePendingIntent(id, null))
        store.delete(id)
    }

    fun markFired(id: Int) {
        store.find(id)?.let { store.upsert(it.copy(state = STATE_FIRED)) }
    }

    private fun firePendingIntent(id: Int, spec: AlarmSpec?): PendingIntent {
        val intent = Intent(context, AlarmReceiver::class.java).apply {
            action = AlarmContract.ACTION_FIRE
            putExtra(AlarmContract.EXTRA_ID, id)
            putExtra(AlarmContract.EXTRA_TITLE, spec?.title.orEmpty())
            putExtra(AlarmContract.EXTRA_BODY, spec?.body.orEmpty())
            putExtra(AlarmContract.EXTRA_SNOOZE_MINUTES, spec?.snoozeMinutes ?: AlarmContract.DEFAULT_SNOOZE_MINUTES)
            putExtra(AlarmContract.EXTRA_TRIGGER_AT_WALL_CLOCK, spec?.triggerAtWallClockMs ?: 0L)
        }
        return PendingIntent.getBroadcast(
            context,
            id,
            intent,
            // updateCurrent so a rescheduled alarm replaces the extras of the
            // already-registered pending intent.
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    companion object {
        const val STATE_SCHEDULED = "scheduled"
        const val STATE_SNOOZED = "snoozed"
        const val STATE_FIRED = "fired"
        const val STATE_DISMISSED = "dismissed"
    }
}

data class StoredAlarm(
    val id: Int,
    val title: String,
    val body: String,
    val triggerAtWallClockMs: Long,
    val snoozeMinutes: Int,
    val state: String
) {
    fun toSpec() = AlarmSpec(id, title, body, triggerAtWallClockMs, snoozeMinutes)
}

/**
 * Alarms that must outlive the process. A SharedPreferences file is used rather
 * than Room because this is a tiny, flat, single-writer record that has to be
 * readable from a cold `BroadcastReceiver` before any database is open.
 */
class AlarmStore(context: Context) {
    private val prefs = context.getSharedPreferences("studybuddy_alarms", Context.MODE_PRIVATE)

    fun upsert(alarm: StoredAlarm) {
        prefs.edit()
            .putString(key(alarm.id, "title"), alarm.title)
            .putString(key(alarm.id, "body"), alarm.body)
            .putLong(key(alarm.id, "trigger"), alarm.triggerAtWallClockMs)
            .putInt(key(alarm.id, "snooze"), alarm.snoozeMinutes)
            .putString(key(alarm.id, "state"), alarm.state)
            .apply()
    }

    fun find(id: Int): StoredAlarm? {
        if (!prefs.contains(key(id, "trigger"))) return null
        return StoredAlarm(
            id = id,
            title = prefs.getString(key(id, "title"), "").orEmpty(),
            body = prefs.getString(key(id, "body"), "").orEmpty(),
            triggerAtWallClockMs = prefs.getLong(key(id, "trigger"), 0L),
            snoozeMinutes = prefs.getInt(key(id, "snooze"), AlarmContract.DEFAULT_SNOOZE_MINUTES),
            state = prefs.getString(key(id, "state"), AlarmScheduler.STATE_SCHEDULED).orEmpty()
        )
    }

    fun all(): List<StoredAlarm> = prefs.all.keys
        .filter { it.startsWith(PREFIX) }
        .mapNotNull { key ->
            // Keys are "<prefix><id>.<field>"; the id is recoverable from any field.
            val id = key.removePrefix(PREFIX).substringBefore('.').toIntOrNull() ?: return@mapNotNull null
            id
        }
        .distinct()
        .mapNotNull { find(it) }

    fun delete(id: Int) {
        prefs.edit()
            .remove(key(id, "title"))
            .remove(key(id, "body"))
            .remove(key(id, "trigger"))
            .remove(key(id, "snooze"))
            .remove(key(id, "state"))
            .apply()
    }

    private fun key(id: Int, field: String) = "$PREFIX$id.$field"

    companion object {
        private const val PREFIX = "alarm."
    }
}

/** Receives the AlarmManager trigger and posts the alarm notification. */
class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != AlarmContract.ACTION_FIRE) return
        val id = intent.getIntExtra(AlarmContract.EXTRA_ID, 0)
        val title = intent.getStringExtra(AlarmContract.EXTRA_TITLE).orEmpty().take(120)
        val body = intent.getStringExtra(AlarmContract.EXTRA_BODY).orEmpty().take(400)
        val snoozeMinutes = intent.getIntExtra(
            AlarmContract.EXTRA_SNOOZE_MINUTES,
            AlarmContract.DEFAULT_SNOOZE_MINUTES
        )
        AlarmScheduler(context).markFired(id)
        AlarmNotifications.post(context, id, title, body, snoozeMinutes)
    }
}

/** Handles the alarm's Snooze and Dismiss actions. */
class AlarmActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getIntExtra(AlarmContract.EXTRA_ID, 0)
        when (intent.action) {
            AlarmContract.ACTION_SNOOZE -> AlarmScheduler(context).snooze(id)
            AlarmContract.ACTION_DISMISS -> AlarmScheduler(context).dismiss(id)
        }
    }
}

/**
 * Re-arms alarms after events that silently invalidate them. Android clears
 * AlarmManager's pending intents on reboot, and a wall-clock instant moves when
 * the timezone or clock changes.
 */
class AlarmRestoreReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED -> AlarmScheduler(context).restorePending()
        }
    }
}

object AlarmNotifications {
    private const val NOTIFICATION_BASE = 9500
    private val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())

    fun post(context: Context, id: Int, title: String, body: String, snoozeMinutes: Int) {
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        createChannel(manager)

        val open = PendingIntent.getActivity(
            context,
            id,
            Intent(context, `in`.satym.studybuddy.MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val snooze = action(context, AlarmContract.ACTION_SNOOZE, id, 0)
        val dismiss = action(context, AlarmContract.ACTION_DISMISS, id, 1)

        val whenText = timeFormat.format(System.currentTimeMillis())
        val builder = NotificationCompat.Builder(context, AlarmContract.NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_studybuddy)
            .setContentTitle(if (title.isBlank()) "StudyBuddy reminder" else title)
            .setContentText(if (body.isBlank()) "Scheduled for $whenText" else body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(open)
            .addAction(0, "Snooze $snooze min", snooze)
            .addAction(0, "Dismiss", dismiss)

        // A full-screen intent is what makes an alarm visible on a locked screen.
        // Android 14+ restricts this to alarm-clock apps and will silently ignore
        // it otherwise, so it is only set where the platform still honours it and
        // the notification remains a normal heads-up one everywhere else.
        if (canUseFullScreen(context)) {
            builder.setFullScreenIntent(open, true)
        }
        manager.notify(NOTIFICATION_BASE + (id % 400), builder.build())
    }

    private fun canUseFullScreen(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true
        // On 14+ the app must be recognised as an alarm app to use this at all.
        val alarm = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return false
        return runCatching { alarm.canScheduleExactAlarms() }.getOrDefault(false)
    }

    private fun createChannel(manager: NotificationManager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            AlarmContract.NOTIFICATION_CHANNEL_ID,
            "Alarms",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "StudyBuddy scheduled reminders"
            setSound(
                android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_ALARM),
                android.media.AudioAttributes.Builder()
                    .setUsage(android.media.AudioAttributes.USAGE_ALARM)
                    .build()
            )
            enableVibration(true)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        manager.createNotificationChannel(channel)
    }

    private fun action(context: Context, action: String, id: Int, slot: Int): PendingIntent {
        val intent = Intent(context, AlarmActionReceiver::class.java).apply {
            this.action = action
            putExtra(AlarmContract.EXTRA_ID, id)
        }
        return PendingIntent.getBroadcast(
            context,
            // Distinct request codes, otherwise the two actions collapse onto one
            // PendingIntent and only the last action survives.
            (id * 31) + slot,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}
