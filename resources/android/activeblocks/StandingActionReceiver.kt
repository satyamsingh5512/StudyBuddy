package `in`.satym.studybuddy.activeblocks

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/**
 * Receiver for actions triggered from the usage standing notification.
 *
 * Currently handles only one action: hiding the notification until tomorrow.
 */
class StandingActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        when (intent?.action) {
            ACTION_HIDE_TODAY -> {
                val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().time)
                ActiveBlocks.setHiddenUntilDate(context, today)
                UsageStandingNotification.cancel(context)
            }
        }
    }

    companion object {
        const val ACTION_HIDE_TODAY = "in.satym.studybuddy.activeblocks.HIDE_TODAY"
    }
}
