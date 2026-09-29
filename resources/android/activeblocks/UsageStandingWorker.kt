package `in`.satym.studybuddy.activeblocks

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Periodic worker that refreshes the usage standing notification every 15 minutes.
 *
 * Enqueued when the standing notification is enabled, cancelled when disabled.
 */
class UsageStandingWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        if (!ActiveBlocks.standingNotificationEnabled(applicationContext)) {
            return@withContext Result.success()
        }
        UsageStandingNotification.refresh(applicationContext)
        Result.success()
    }
}
