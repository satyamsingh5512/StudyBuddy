package `in`.satym.studybuddy.zen

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.util.concurrent.Executors

/**
 * Receives scheduled Zen mode transition alarms.
 *
 * Action "in.satym.studybuddy.zen.TRANSITION" triggers a window start or end.
 * Action "in.satym.studybuddy.zen.MANUAL_EXIT" ends a manual Zen session.
 *
 * Not exported; only fired by AlarmManager within this app.
 */
class ZenAlarmReceiver : BroadcastReceiver() {
    private val executor = Executors.newSingleThreadExecutor()

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        
        // Use goAsync() to allow background work beyond onReceive's lifetime
        val pendingResult = goAsync()
        
        executor.execute {
            try {
                when (action) {
                    "in.satym.studybuddy.zen.TRANSITION" -> {
                        ZenMode.apply(context)
                        ZenMode.reschedule(context)
                    }
                    "in.satym.studybuddy.zen.MANUAL_EXIT" -> {
                        ZenMode.exitNow(context)
                    }
                }
            } finally {
                pendingResult.finish()
            }
        }
    }
}
