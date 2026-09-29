package `in`.satym.studybuddy.activeblocks

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import `in`.satym.studybuddy.MainActivity
import `in`.satym.studybuddy.R
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplineDatabase
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplinePreferences
import `in`.satym.studybuddy.shortsblock.ShortsBlock
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.concurrent.Executors

/**
 * Ongoing, low-priority notification showing today's screen time, focus minutes,
 * unlock count, and blocked attempts.
 *
 * Refreshed periodically by UsageStandingWorker and on demand. Omits figures that
 * are unmeasured (e.g. unlock count on Android 8.1 and below) rather than showing zero.
 */
object UsageStandingNotification {
    private const val channelId = "studybuddy-usage-standing"
    private const val notificationId = 9318

    private val executor = Executors.newSingleThreadExecutor()

    /**
     * Refresh the notification with current usage data. Runs on a background thread internally.
     */
    fun refresh(context: Context) {
        if (!ActiveBlocks.standingNotificationEnabled(context)) {
            return
        }
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) {
            return
        }

        val today = todayKey()
        val hiddenUntil = ActiveBlocks.hiddenUntilDate(context)
        if (hiddenUntil == today) {
            cancel(context)
            return
        }

        executor.execute {
            createChannel(context)
            val userId = DigitalDisciplinePreferences(context).userId()
            if (userId.isNullOrBlank()) {
                cancel(context)
                return@execute
            }

            val db = DigitalDisciplineDatabase.get(context)
            val summary = db.dao().dailySummary(userId, today)
            val (shortsBlocked, _) = ShortsBlock.todayStats(context)

            val text = buildNotificationText(
                context,
                summary?.screenTimeMs ?: 0L,
                summary?.focusTimeMs ?: 0L,
                summary?.unlockCount,
                (summary?.blockedAttempts ?: 0) + shortsBlocked
            )

            val notification = buildNotification(context, text)
            NotificationManagerCompat.from(context).notify(notificationId, notification)
        }
    }

    /**
     * Cancel the standing notification.
     */
    fun cancel(context: Context) {
        NotificationManagerCompat.from(context).cancel(notificationId)
    }

    private fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            channelId,
            context.getString(R.string.studybuddy_activeblocks_standing_channel_name),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = context.getString(R.string.studybuddy_activeblocks_standing_channel_description)
            setShowBadge(false)
            setSound(null, null)
        }
        context.getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
    }

    private fun buildNotification(context: Context, text: String): android.app.Notification {
        val openIntent = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val hideIntent = PendingIntent.getBroadcast(
            context,
            0,
            Intent(context, StandingActionReceiver::class.java).apply {
                action = StandingActionReceiver.ACTION_HIDE_TODAY
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_stat_studybuddy)
            .setContentTitle(context.getString(R.string.studybuddy_activeblocks_standing_title))
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(openIntent)
            .addAction(
                0,
                context.getString(R.string.studybuddy_activeblocks_standing_hide_today),
                hideIntent
            )
            .build()
    }

    private fun buildNotificationText(
        context: Context,
        screenTimeMs: Long,
        focusTimeMs: Long,
        unlockCount: Int?,
        blockedCount: Int
    ): String {
        val parts = mutableListOf<String>()
        
        if (screenTimeMs > 0) {
            parts.add("Screen ${formatTime(screenTimeMs)}")
        }
        
        if (focusTimeMs > 0) {
            parts.add("Focus ${formatTime(focusTimeMs)}")
        }
        
        if (unlockCount != null && unlockCount > 0) {
            parts.add("$unlockCount unlock${if (unlockCount == 1) "" else "s"}")
        }
        
        if (blockedCount > 0) {
            parts.add("$blockedCount blocked")
        }

        return if (parts.isEmpty()) {
            context.getString(R.string.studybuddy_activeblocks_standing_no_activity)
        } else {
            parts.joinToString(" · ")
        }
    }

    private fun formatTime(ms: Long): String {
        val totalMinutes = ((ms + 59_999L) / 60_000L).toInt()
        val hours = totalMinutes / 60
        val minutes = totalMinutes % 60
        return if (hours > 0) {
            "${hours}h ${minutes.toString().padStart(2, '0')}m"
        } else {
            "${minutes}m"
        }
    }

    private fun todayKey(): String {
        val calendar = Calendar.getInstance()
        return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(calendar.time)
    }
}
