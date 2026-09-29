package `in`.satym.studybuddy.activeblocks

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Receiver that restarts the chip service and re-enqueues the standing notification worker
 * after boot or app update, if they were previously enabled.
 */
class ActiveBlocksRestoreReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) {
            return
        }

        // Restart chip if it was enabled and overlay permission is still granted
        if (ActiveBlocks.chipEnabled(context) && ActiveBlocks.hasOverlayPermission(context)) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(Intent(context, ActiveBlocksChipService::class.java))
            } else {
                context.startService(Intent(context, ActiveBlocksChipService::class.java))
            }
        }

        // Re-enqueue standing notification worker if it was enabled
        if (ActiveBlocks.standingNotificationEnabled(context)) {
            ActiveBlocks.setStandingNotificationEnabled(context, true)
        }
    }
}
