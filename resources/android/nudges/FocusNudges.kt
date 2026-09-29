package `in`.satym.studybuddy.nudges

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import `in`.satym.studybuddy.MainActivity
import `in`.satym.studybuddy.R
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplineDatabase
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplinePreferences
import `in`.satym.studybuddy.digitaldiscipline.FocusEngine
import `in`.satym.studybuddy.digitaldiscipline.FocusState
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Gentle reminders when the user switches away from StudyBuddy or their chosen
 * study apps during an active focus session.
 *
 * Design principles matching the rest of StudyBuddy:
 *  - Neutral, supportive copy; never shaming.
 *  - Rate-limited: at most once per 3 minutes, max 5 per session.
 *  - Cheap on the main thread; actual checks happen on a background executor.
 *  - Ignores system packages, launchers, and the user's allowed study apps.
 *
 * Entry point: `onForegroundApp(context, packageName)` called by an
 * AccessibilityService on window changes.
 */
object FocusNudges {
    private const val CHANNEL_ID = "studybuddy-focus-nudge"
    internal const val NOTIFICATION_ID = 9330
    private const val MIN_INTERVAL_MS = 3 * 60 * 1000L // 3 minutes
    private const val MAX_NUDGES_PER_SESSION = 5

    private val executor: ExecutorService = Executors.newSingleThreadExecutor()

    /**
     * Called on each foreground app change. Must be cheap on the main thread.
     * Actual focus checking happens asynchronously.
     */
    fun onForegroundApp(context: Context, packageName: String) {
        // Quick main-thread filters
        if (!shouldCheck(context, packageName)) return

        executor.execute {
            checkAndNotify(context.applicationContext, packageName)
        }
    }

    private fun shouldCheck(context: Context, packageName: String): Boolean {
        // Ignore our own package
        if (packageName == context.packageName) return false

        // Ignore common system/launcher packages
        if (isSystemPackage(packageName)) return false

        // Ignore user's study apps
        val prefs = NudgesPreferences(context)
        if (!prefs.focusNudgesEnabled()) return false
        if (packageName in prefs.studyPackages()) return false

        return true
    }

    private fun isSystemPackage(packageName: String): Boolean {
        // Common system packages that should never trigger a nudge
        return packageName in setOf(
            "com.android.systemui",
            "com.android.launcher",
            "com.android.launcher3",
            "com.google.android.apps.nexuslauncher",
            "com.android.settings",
            "com.android.vending", // Play Store
            "com.google.android.packageinstaller"
        ) || packageName.startsWith("com.android.systemui") ||
                packageName.startsWith("com.sec.android.app.launcher") || // Samsung
                packageName.startsWith("com.miui.home") || // Xiaomi
                packageName.startsWith("com.huawei.android.launcher") // Huawei
    }

    private fun checkAndNotify(context: Context, packageName: String) {
        val ddPrefs = DigitalDisciplinePreferences(context)
        val userId = ddPrefs.userId() ?: return

        val dao = DigitalDisciplineDatabase.get(context).dao()
        val session = dao.activeFocus(userId) ?: return

        // Check if session is actually ACTIVE
        val state = runCatching { FocusState.valueOf(session.state) }
            .getOrDefault(FocusState.SYSTEM_INTERRUPTION)
        if (state != FocusState.ACTIVE) return

        val prefs = NudgesPreferences(context)

        // Rate limiting checks
        val count = prefs.sessionNudgeCount(session.id)
        if (count >= MAX_NUDGES_PER_SESSION) return

        val lastNudgeMs = prefs.sessionLastNudgeMs(session.id)
        val now = System.currentTimeMillis()
        if (now - lastNudgeMs < MIN_INTERVAL_MS) return

        // Update rate limit state
        prefs.incrementSessionNudgeCount(session.id)
        prefs.setSessionLastNudgeMs(session.id, now)

        // Post notification
        postNudge(context, session.id, session.configuredDurationMs, FocusEngine(dao).elapsedMs(session))
    }

    private fun postNudge(context: Context, sessionId: String, configuredMs: Long, elapsedMs: Long) {
        val manager = NotificationManagerCompat.from(context)

        // Check notification permission on API 33+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (!manager.areNotificationsEnabled()) return
        }

        createChannel(context)

        val remainingMs = (configuredMs - elapsedMs).coerceAtLeast(0L)
        val remainingMin = ((remainingMs + 59_999L) / 60_000L).coerceAtLeast(1L).toInt()

        val openIntent = PendingIntent.getActivity(
            context,
            NOTIFICATION_ID,
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val endIntent = PendingIntent.getBroadcast(
            context,
            NOTIFICATION_ID + 1,
            Intent(context, NudgeActionReceiver::class.java).apply {
                action = ACTION_END_SESSION
                putExtra(EXTRA_SESSION_ID, sessionId)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_studybuddy)
            .setContentTitle(context.getString(R.string.studybuddy_nudges_focus_notification_title))
            .setContentText(context.getString(R.string.studybuddy_nudges_focus_notification_text, remainingMin))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(openIntent)
            .addAction(0, context.getString(R.string.studybuddy_nudges_focus_action_return), openIntent)
            .addAction(0, context.getString(R.string.studybuddy_nudges_focus_action_end), endIntent)
            .build()

        manager.notify(NOTIFICATION_ID, notification)
    }

    private fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        val channel = NotificationChannel(
            CHANNEL_ID,
            context.getString(R.string.studybuddy_nudges_focus_channel_name),
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = context.getString(R.string.studybuddy_nudges_focus_channel_description)
            setShowBadge(true)
        }
        manager.createNotificationChannel(channel)
    }

    // Public API for UI settings
    fun setEnabled(context: Context, enabled: Boolean) {
        NudgesPreferences(context).setFocusNudgesEnabled(enabled)
    }

    fun enabled(context: Context): Boolean {
        return NudgesPreferences(context).focusNudgesEnabled()
    }

    fun setStudyPackages(context: Context, packages: List<String>) {
        NudgesPreferences(context).setStudyPackages(packages)
    }

    fun studyPackages(context: Context): List<String> {
        return NudgesPreferences(context).studyPackages()
    }

    internal const val ACTION_END_SESSION = "in.satym.studybuddy.nudges.END_SESSION"
    internal const val EXTRA_SESSION_ID = "session_id"
}

/**
 * Receives actions from focus nudge notifications.
 *
 * The "End session" action broadcasts here, which then interrupts the focus
 * session via FocusEngine.
 */
class NudgeActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != FocusNudges.ACTION_END_SESSION) return

        val sessionId = intent.getStringExtra(FocusNudges.EXTRA_SESSION_ID) ?: return

        // Use goAsync since we're doing database work
        val pending = goAsync()
        val executor = Executors.newSingleThreadExecutor()
        executor.execute {
            try {
                // FocusEngine.interrupt throws when no session is active, which is a
                // normal race here: the user may have ended the session in the app
                // between the notification being posted and the action being tapped.
                runCatching {
                    val ddPrefs = DigitalDisciplinePreferences(context)
                    val userId = ddPrefs.userId()
                    if (userId != null) {
                        val dao = DigitalDisciplineDatabase.get(context).dao()
                        val engine = FocusEngine(dao)
                        val current = dao.activeFocus(userId)
                        if (current?.id == sessionId) {
                            engine.interrupt(userId, "nudge_ended")
                        }
                    }
                }
                NotificationManagerCompat.from(context).cancel(FocusNudges.NOTIFICATION_ID)
            } finally {
                pending.finish()
                executor.shutdown()
            }
        }
    }
}
