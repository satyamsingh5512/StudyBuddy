package `in`.satym.studybuddy.zen

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import `in`.satym.studybuddy.R
import `in`.satym.studybuddy.digitaldiscipline.ControlLevel
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplineDatabase
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplinePreferences
import `in`.satym.studybuddy.digitaldiscipline.FocusEngine
import `in`.satym.studybuddy.digitaldiscipline.FocusMode
import java.util.Calendar
import java.util.TimeZone
import java.util.concurrent.Executors

/**
 * Current Zen mode status snapshot.
 */
data class ZenStatus(
    val enabled: Boolean,
    val active: Boolean,
    val activeWindowId: String?,
    val nextChangeAtMs: Long?,
    val hasPolicyAccess: Boolean
)

/**
 * Scheduled Zen mode: recurring do-not-disturb study windows.
 *
 * Why this exists:
 * Users set aside specific hours each day for focused study. Zen mode turns DND
 * on and off automatically, without requiring manual toggling each session. When
 * a window has [ZenWindow.startFocus] enabled, it also starts a native focus
 * session through the existing FocusEngine, so the study time counts toward goals.
 *
 * Policy access (ACCESS_NOTIFICATION_POLICY) is required on API 23+ to control
 * DND. Below API 23 this feature is unavailable. The user grants this through a
 * system settings screen; StudyBuddy cannot force it on.
 *
 * Zen mode respects the user's own DND preference: if the user had DND on before
 * Zen activated, exiting Zen restores that state rather than turning DND off.
 */
object ZenMode {
    private val executor = Executors.newSingleThreadExecutor()
    private const val CHANNEL_ID = "studybuddy_zen"
    private const val NOTIFICATION_ID = 9320
    private const val MANUAL_WINDOW_ID = "__manual__"

    /**
     * Checks if the app has notification policy access (required to control DND).
     * Returns false on API < 23 where DND control is unavailable.
     */
    fun hasPolicyAccess(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return false
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        return nm.isNotificationPolicyAccessGranted
    }

    /**
     * Returns an Intent that opens the system DND policy access settings.
     * On API < 23, returns null.
     */
    fun policyAccessIntent(): Intent? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return null
        return Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)
    }

    /**
     * Replaces the stored windows. Capped at [ZenSchedule.MAX_WINDOWS].
     */
    fun setWindows(context: Context, windows: List<ZenWindow>) {
        ZenStore(context).setWindows(windows)
        reschedule(context)
    }

    /**
     * Returns the configured windows.
     */
    fun windows(context: Context): List<ZenWindow> = ZenStore(context).windows()

    /**
     * Sets the master enable flag. When false, all windows are dormant.
     */
    fun setEnabled(context: Context, enabled: Boolean) {
        ZenStore(context).setMasterEnabled(enabled)
        apply(context)
        reschedule(context)
    }

    /**
     * Current Zen mode status.
     */
    fun status(context: Context): ZenStatus {
        val store = ZenStore(context)
        val enabled = store.masterEnabled()
        val now = Calendar.getInstance()
        val activeWin = if (enabled) ZenSchedule.activeWindow(store.windows(), now) else null
        val next = if (enabled) {
            ZenSchedule.nextTransition(store.windows(), System.currentTimeMillis(), TimeZone.getDefault())
        } else null

        // A manual session counts as active even with the schedule switched off, so
        // the UI cannot show "Zen is off" while Do Not Disturb is in fact on.
        val manualEndsAt = store.manualEndsAtMs()
        val manualRunning = manualEndsAt > System.currentTimeMillis()

        return ZenStatus(
            enabled = enabled,
            active = activeWin != null || manualRunning,
            activeWindowId = activeWin?.id ?: if (manualRunning) MANUAL_WINDOW_ID else null,
            nextChangeAtMs = if (manualRunning) manualEndsAt else next?.first,
            hasPolicyAccess = hasPolicyAccess(context)
        )
    }

    /**
     * Manually activates Zen mode for the specified duration in minutes.
     * Creates a temporary window that expires after the duration.
     */
    fun enterNow(context: Context, minutes: Int) {
        if (!hasPolicyAccess(context)) return
        val durationMs = minutes.toLong() * 60_000L
        val endMs = System.currentTimeMillis() + durationMs
        
        val store = ZenStore(context)
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        
        // Record original filter if we don't own DND yet
        if (!store.zenOwnsDnd()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                store.setOriginalInterruptionFilter(nm.currentInterruptionFilter)
            }
            store.setZenOwnsDnd(true)
        }
        
        // Enter DND
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY)
        }

        store.setManualEndsAtMs(endMs)
        postNotification(context, true, "Manual Zen", endMs)
        scheduleManualExit(context, endMs)
    }

    /**
     * Manually exits Zen mode immediately, restoring the original DND state.
     */
    fun exitNow(context: Context) {
        val store = ZenStore(context)
        if (!store.zenOwnsDnd()) return
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val original = store.originalInterruptionFilter()
            if (original != ZenStore.NO_FILTER_RECORDED) {
                nm.setInterruptionFilter(original)
            } else {
                nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL)
            }
        }
        
        store.clearDndOwnership()
        cancelManualExit(context)
        clearNotification(context)
    }

    /**
     * Evaluates the current moment and enters or exits Zen mode accordingly.
     * Called by the alarm receiver and boot receiver.
     */
    fun apply(context: Context) {
        val store = ZenStore(context)

        // A manual session that has not reached its deadline outranks the schedule.
        // Without this check a window boundary passing mid-session would be read as
        // "no window is active", and Zen would exit a session the user asked for.
        if (store.manualEndsAtMs() > System.currentTimeMillis()) return

        if (!store.masterEnabled()) {
            // Master switch is off, exit if we're active
            if (store.zenOwnsDnd()) exitNow(context)
            return
        }

        if (!hasPolicyAccess(context)) return

        val now = Calendar.getInstance()
        val activeWin = ZenSchedule.activeWindow(store.windows(), now)

        if (activeWin != null) {
            // A window is active now
            if (!store.zenOwnsDnd()) {
                // Enter DND
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                    store.setOriginalInterruptionFilter(nm.currentInterruptionFilter)
                    val filter = if (activeWin.allowPriorityOnly) {
                        NotificationManager.INTERRUPTION_FILTER_PRIORITY
                    } else {
                        NotificationManager.INTERRUPTION_FILTER_NONE
                    }
                    nm.setInterruptionFilter(filter)
                }
                store.setZenOwnsDnd(true)
                
                // Start focus session if requested
                if (activeWin.startFocus) {
                    startFocusForWindow(context, activeWin)
                }
                
                val next = ZenSchedule.nextTransition(store.windows(), System.currentTimeMillis(), TimeZone.getDefault())
                postNotification(context, true, activeWin.label, next?.first)
            }
        } else {
            // No window is active
            if (store.zenOwnsDnd()) {
                // Exit DND
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                    val original = store.originalInterruptionFilter()
                    if (original != ZenStore.NO_FILTER_RECORDED) {
                        nm.setInterruptionFilter(original)
                    } else {
                        nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL)
                    }
                }
                store.clearDndOwnership()
                clearNotification(context)
            }
        }
    }

    /**
     * Schedules the next alarm for the upcoming window transition.
     * Cancels any previous alarm and sets exactly one new one.
     */
    fun reschedule(context: Context) {
        val store = ZenStore(context)
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, ZenAlarmReceiver::class.java).apply {
            action = "in.satym.studybuddy.zen.TRANSITION"
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            9321, // Single request code so it replaces
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Cancel previous
        am.cancel(pendingIntent)

        if (!store.masterEnabled()) return

        val next = ZenSchedule.nextTransition(
            store.windows(),
            System.currentTimeMillis(),
            TimeZone.getDefault()
        ) ?: return

        val (atMs, _, _) = next

        scheduleWakeup(am, atMs, pendingIntent)
    }

    /**
     * Schedules a single wake-up alarm at the most exact level the platform allows.
     *
     * setExactAndAllowWhileIdle and setAndAllowWhileIdle both arrived in API 23, so
     * minSdk 22 has to fall back to setExact or the call is a NoSuchMethodError on a
     * real API 22 device. Exact scheduling is also revocable at runtime from API 31,
     * so canScheduleExactAlarms is consulted rather than assumed.
     */
    private fun scheduleWakeup(am: AlarmManager, atMs: Long, pendingIntent: PendingIntent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (am.canScheduleExactAlarms()) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pendingIntent)
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pendingIntent)
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pendingIntent)
        } else {
            am.setExact(AlarmManager.RTC_WAKEUP, atMs, pendingIntent)
        }
    }

    private fun startFocusForWindow(context: Context, window: ZenWindow) {
        executor.execute {
            try {
                val prefs = DigitalDisciplinePreferences(context)
                val userId = prefs.userId() ?: return@execute
                val dao = DigitalDisciplineDatabase.get(context).dao()
                
                // Only start if no focus is already active
                if (dao.activeFocus(userId) != null) return@execute
                
                val durationMs = if (window.endMinute > window.startMinute) {
                    (window.endMinute - window.startMinute).toLong() * 60_000L
                } else {
                    // Midnight crossing
                    ((1440 - window.startMinute) + window.endMinute).toLong() * 60_000L
                }
                
                FocusEngine(dao).start(
                    userId = userId,
                    mode = FocusMode.DEEP_WORK,
                    durationMs = durationMs,
                    subject = window.label,
                    control = ControlLevel.STANDARD
                )
            } catch (e: Exception) {
                // Silent failure; focus start is a nice-to-have, not critical
            }
        }
    }

    private fun scheduleManualExit(context: Context, endMs: Long) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, ZenAlarmReceiver::class.java).apply {
            action = "in.satym.studybuddy.zen.MANUAL_EXIT"
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            9322,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        scheduleWakeup(am, endMs, pendingIntent)
    }

    private fun cancelManualExit(context: Context) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, ZenAlarmReceiver::class.java).apply {
            action = "in.satym.studybuddy.zen.MANUAL_EXIT"
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            9322,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        am.cancel(pendingIntent)
    }

    private fun postNotification(context: Context, active: Boolean, label: String, endsAtMs: Long?) {
        createChannelIfNeeded(context)
        
        val notificationManager = NotificationManagerCompat.from(context)
        
        // Check notification permission on API 33+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (!notificationManager.areNotificationsEnabled()) return
        }
        
        val title = if (active) {
            context.getString(R.string.studybuddy_zen_active_title)
        } else {
            context.getString(R.string.studybuddy_zen_ended_title)
        }
        
        val text = if (active) {
            context.getString(R.string.studybuddy_zen_active_text, label)
        } else {
            context.getString(R.string.studybuddy_zen_ended_text)
        }
        
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_studybuddy)
            .setContentTitle(title)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(active)
            .setAutoCancel(!active)
            .build()
        
        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    private fun clearNotification(context: Context) {
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }

    private fun createChannelIfNeeded(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val existing = nm.getNotificationChannel(CHANNEL_ID)
        if (existing != null) return
        
        val channel = NotificationChannel(
            CHANNEL_ID,
            context.getString(R.string.studybuddy_zen_channel_name),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = context.getString(R.string.studybuddy_zen_channel_desc)
            setShowBadge(false)
        }
        nm.createNotificationChannel(channel)
    }
}
