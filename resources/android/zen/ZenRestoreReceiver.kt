package `in`.satym.studybuddy.zen

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.util.concurrent.Executors

/**
 * Restores Zen mode scheduling after system events that invalidate the alarm.
 *
 * Listens for:
 * - BOOT_COMPLETED: device restarted, AlarmManager cleared
 * - MY_PACKAGE_REPLACED: app updated, alarms may be lost
 * - TIME_SET: user changed device time manually
 * - TIMEZONE_CHANGED: timezone changed, affecting local midnight calculations
 *
 * All of these require rescheduling the next transition and re-evaluating whether
 * a window should be active now.
 */
class ZenRestoreReceiver : BroadcastReceiver() {
    private val executor = Executors.newSingleThreadExecutor()

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        
        when (action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED -> {
                // Use goAsync() to allow background work beyond onReceive's lifetime
                val pendingResult = goAsync()
                
                executor.execute {
                    try {
                        ZenMode.apply(context)
                        ZenMode.reschedule(context)
                    } finally {
                        pendingResult.finish()
                    }
                }
            }
        }
    }
}
