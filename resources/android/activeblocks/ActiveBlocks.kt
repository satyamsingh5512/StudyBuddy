package `in`.satym.studybuddy.activeblocks

import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/**
 * Status of the active blocks surfaces: the floating chip and the usage standing notification.
 */
data class ActiveBlocksStatus(
    val chipEnabled: Boolean,
    val chipRunning: Boolean,
    val standingEnabled: Boolean,
    val overlayPermission: Boolean
)

/**
 * Public API for active-blocks surfaces: a floating chip summarizing what is currently
 * blocked, plus an ongoing usage notification showing screen time and focus progress.
 *
 * Both surfaces are optional and controlled independently. The chip requires overlay
 * permission; the notification does not.
 */
object ActiveBlocks {
    private const val PREFS_NAME = "studybuddy_activeblocks"
    private const val KEY_CHIP_ENABLED = "chip_enabled"
    private const val KEY_STANDING_ENABLED = "standing_enabled"
    private const val KEY_CHIP_X = "chip_x"
    private const val KEY_CHIP_Y = "chip_y"
    private const val KEY_HIDDEN_UNTIL_DATE = "hidden_until_date"

    private const val STANDING_WORK_NAME = "studybuddy-usage-standing"

    /**
     * Enable or disable the floating chip. When enabled and overlay permission is granted,
     * the chip service starts immediately.
     */
    fun setChipEnabled(context: Context, enabled: Boolean) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(KEY_CHIP_ENABLED, enabled).apply()
        if (enabled) {
            ActiveBlocksChipService.start(context)
        } else {
            ActiveBlocksChipService.stop(context)
        }
    }

    /**
     * Check if the floating chip is enabled.
     */
    fun chipEnabled(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_CHIP_ENABLED, false)
    }

    /**
     * Enable or disable the usage standing notification. When enabled, a periodic worker
     * refreshes the notification every 15 minutes.
     */
    fun setStandingNotificationEnabled(context: Context, enabled: Boolean) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(KEY_STANDING_ENABLED, enabled).apply()
        if (enabled) {
            enqueueStandingWorker(context)
            refreshStandingNotification(context)
        } else {
            cancelStandingWorker(context)
            UsageStandingNotification.cancel(context)
        }
    }

    /**
     * Check if the usage standing notification is enabled.
     */
    fun standingNotificationEnabled(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_STANDING_ENABLED, false)
    }

    /**
     * Refresh the usage standing notification on demand. Runs on a background thread internally.
     */
    fun refreshStandingNotification(context: Context) {
        UsageStandingNotification.refresh(context)
    }

    /**
     * Get the current status of both surfaces and overlay permission.
     */
    fun status(context: Context): ActiveBlocksStatus {
        val enabled = chipEnabled(context)
        val running = if (enabled) {
            // A crude check: the service is "running" if it would start when restore runs.
            // Actual process state is not reliably queryable.
            hasOverlayPermission(context)
        } else {
            false
        }
        return ActiveBlocksStatus(
            chipEnabled = enabled,
            chipRunning = running,
            standingEnabled = standingNotificationEnabled(context),
            overlayPermission = hasOverlayPermission(context)
        )
    }

    internal fun hasOverlayPermission(context: Context): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(context)
        } else {
            true
        }

    internal fun chipX(context: Context): Int {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getInt(KEY_CHIP_X, 100)
    }

    internal fun chipY(context: Context): Int {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getInt(KEY_CHIP_Y, 200)
    }

    internal fun setChipPosition(context: Context, x: Int, y: Int) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putInt(KEY_CHIP_X, x).putInt(KEY_CHIP_Y, y).apply()
    }

    internal fun hiddenUntilDate(context: Context): String? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_HIDDEN_UNTIL_DATE, null)
    }

    internal fun setHiddenUntilDate(context: Context, date: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_HIDDEN_UNTIL_DATE, date).apply()
    }

    private fun enqueueStandingWorker(context: Context) {
        val request = PeriodicWorkRequestBuilder<UsageStandingWorker>(15, TimeUnit.MINUTES)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            STANDING_WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            request
        )
    }

    private fun cancelStandingWorker(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(STANDING_WORK_NAME)
    }
}