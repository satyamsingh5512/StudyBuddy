package `in`.satym.studybuddy.digitaldiscipline

import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.SystemClock
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

class FocusEngine(private val dao: DigitalDisciplineDao) {
    private fun readState(value: String): FocusState = runCatching { FocusState.valueOf(value) }.getOrDefault(FocusState.SYSTEM_INTERRUPTION)

    private fun event(session: FocusSessionEntity, type: String, detail: String, at: Long) {
        dao.insertFocusEvent(FocusSessionEventEntity(newLocalId(), session.id, session.userId, type, detail.take(300), at))
    }

    private fun transition(session: FocusSessionEntity, target: FocusState, detail: String, now: Long): FocusSessionEntity {
        val current = readState(session.state)
        require(FocusTransitions.permits(current, target)) { "Cannot transition focus from $current to $target." }
        var accumulated = session.accumulatedElapsedMs
        var elapsedStart = session.startedElapsedRealtimeMs
        var ended: Long? = session.endedWallClockMs
        if (current == FocusState.ACTIVE && target != FocusState.ACTIVE) {
            elapsedStart?.let { accumulated += (SystemClock.elapsedRealtime() - it).coerceAtLeast(0L) }
            elapsedStart = null
        }
        if (target == FocusState.ACTIVE && current != FocusState.ACTIVE) elapsedStart = SystemClock.elapsedRealtime()
        if (target == FocusState.COMPLETED || target == FocusState.INTERRUPTED) ended = now
        val next = session.copy(
            state = target.name,
            accumulatedElapsedMs = accumulated,
            startedElapsedRealtimeMs = elapsedStart,
            endedWallClockMs = ended,
            interruptionReason = if (target == FocusState.INTERRUPTED || target == FocusState.SYSTEM_INTERRUPTION) detail else session.interruptionReason,
            syncState = SyncState.PENDING.name,
            updatedAtMs = now
        )
        dao.upsertFocus(next)
        event(next, "focus_${target.name.lowercase()}", detail, now)
        return next
    }

    fun start(userId: String, mode: FocusMode, durationMs: Long, subject: String, control: ControlLevel): FocusSessionEntity {
        val current = dao.activeFocus(userId)
        require(current == null) { "A local focus session is already active." }
        val now = System.currentTimeMillis()
        val session = FocusSessionEntity(
            id = newLocalId(), userId = userId, mode = mode.name, state = FocusState.IDLE.name,
            configuredDurationMs = durationMs.coerceIn(0L, 24L * 60L * 60L * 1000L), accumulatedElapsedMs = 0L,
            startedWallClockMs = now, startedElapsedRealtimeMs = null, endedWallClockMs = null,
            subject = subject.take(160), controlLevel = control.name, interruptionReason = null,
            syncState = SyncState.PENDING.name, createdAtMs = now, updatedAtMs = now
        )
        dao.upsertFocus(session)
        event(session, "focus_created", "mode=${mode.name}", now)
        val configuring = transition(session, FocusState.CONFIGURING, "configuration saved locally", now)
        val ready = transition(configuring, FocusState.READY, "enforcement capability resolved", now)
        return transition(ready, FocusState.ACTIVE, "focus started", now)
    }

    fun pause(userId: String): FocusSessionEntity = transition(requireActive(userId), FocusState.PAUSED, "user_paused", System.currentTimeMillis())
    fun resume(userId: String): FocusSessionEntity = transition(requireActive(userId), FocusState.ACTIVE, "user_resumed", System.currentTimeMillis())
    fun complete(userId: String): FocusSessionEntity {
        val completing = transition(requireActive(userId), FocusState.COMPLETING, "completion requested", System.currentTimeMillis())
        return transition(completing, FocusState.COMPLETED, "completed", System.currentTimeMillis())
    }
    fun interrupt(userId: String, reason: String): FocusSessionEntity = transition(requireActive(userId), FocusState.INTERRUPTED, reason, System.currentTimeMillis())

    fun status(userId: String): FocusSessionEntity? {
        val current = dao.activeFocus(userId) ?: return null
        if (readState(current.state) == FocusState.ACTIVE && current.startedElapsedRealtimeMs != null && SystemClock.elapsedRealtime() < current.startedElapsedRealtimeMs) {
            // Reboot resets elapsedRealtime. Preserve history but do not invent a duration.
            return transition(current, FocusState.SYSTEM_INTERRUPTION, "device_reboot_or_monotonic_clock_reset", System.currentTimeMillis())
        }
        return current
    }

    fun elapsedMs(session: FocusSessionEntity): Long {
        val active = if (readState(session.state) == FocusState.ACTIVE) {
            session.startedElapsedRealtimeMs?.let { (SystemClock.elapsedRealtime() - it).coerceAtLeast(0L) } ?: 0L
        } else 0L
        return session.accumulatedElapsedMs + active
    }

    private fun requireActive(userId: String): FocusSessionEntity = dao.activeFocus(userId)
        ?: throw IllegalStateException("No local focus session is active.")
}

class UsageAnalyticsEngine(private val context: Context, private val dao: DigitalDisciplineDao) {
    private val dateFormatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    private fun startOfDay(now: Long): Pair<Long, String> {
        val calendar = Calendar.getInstance().apply {
            timeInMillis = now
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        return calendar.timeInMillis to dateFormatter.format(Date(now))
    }

    fun aggregateToday(userId: String): DailyUsageSummaryEntity {
        val now = System.currentTimeMillis()
        val (start, date) = startOfDay(now)
        val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
            ?: throw IllegalStateException("Usage statistics service is unavailable.")
        val protected = dao.protectedApps(userId).associateBy { it.packageName }
        val stats = manager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, now).orEmpty()
        val snapshots = mutableListOf<UsageSnapshotEntity>()
        val applications = mutableListOf<UsageApplicationEntity>()
        var screenTime = 0L
        var distractionTime = 0L
        for (stat in stats) {
            val duration = stat.totalTimeInForeground.coerceAtLeast(0L)
            if (duration == 0L || stat.packageName == context.packageName) continue
            screenTime += duration
            val config = protected[stat.packageName]
            if (config?.policy == AppPolicy.WARN.name || config?.policy == AppPolicy.INTERVENE.name || config?.policy == AppPolicy.BLOCK.name) {
                distractionTime += duration
            }
            val label = try {
                context.packageManager.getApplicationLabel(context.packageManager.getApplicationInfo(stat.packageName, 0)).toString()
            } catch (_: PackageManager.NameNotFoundException) { stat.packageName }
            applications += UsageApplicationEntity(userId, stat.packageName, label, config?.category ?: "OTHER", config != null, now)
            snapshots += UsageSnapshotEntity(
                id = "day:$date:${stat.packageName}", userId = userId, packageName = stat.packageName,
                startAtMs = start, endAtMs = now, foregroundMs = duration, capturedAtMs = now
            )
        }
        val focus = dao.focusSince(userId, start).sumOf { FocusEngine(dao).elapsedMs(it) }
        val attempts = dao.blockedAttemptCount(userId, start)
        val interventions = dao.interventionCount(userId, start)
        // This is deliberately an estimate: count only configured ten-second interventions.
        val recovered = interventions.toLong() * 10_000L
        val summary = DailyUsageSummaryEntity(
            userId, date, screenTime, studyTimeMs = focus, focusTimeMs = focus,
            distractionTimeMs = distractionTime, doomscrollTimeMs = distractionTime,
            blockedAttempts = attempts, interventions = interventions, estimatedRecoveredMs = recovered, updatedAtMs = now
        )
        dao.upsertUsageApplications(applications)
        dao.upsertUsageSnapshots(snapshots)
        dao.upsertDailySummary(summary)
        return summary
    }
}

class AggregateSyncEngine(private val context: Context, private val dao: DigitalDisciplineDao) {
    fun enqueue(userId: String, entityType: String, aggregatePayloadJson: String): SyncQueueItemEntity {
        val now = System.currentTimeMillis()
        val item = SyncQueueItemEntity(newLocalId(), userId, entityType, aggregatePayloadJson, SyncState.PENDING.name, 0, now, now, null)
        dao.upsertSync(item)
        val work = androidx.work.OneTimeWorkRequestBuilder<AggregateSyncWorker>()
            .setInputData(workDataOf("userId" to userId))
            .setBackoffCriteria(androidx.work.BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES)
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork("studybuddy-discipline-sync-$userId", ExistingWorkPolicy.KEEP, work)
        return item
    }

    fun scheduleUsageAggregation() {
        val work = PeriodicWorkRequestBuilder<UsageAggregationWorker>(6, TimeUnit.HOURS)
            .setConstraints(androidx.work.Constraints.Builder().setRequiresBatteryNotLow(true).build())
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork("studybuddy-discipline-usage-aggregation", ExistingPeriodicWorkPolicy.UPDATE, work)
    }
}

class UsageAggregationWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val preferences = DigitalDisciplinePreferences(applicationContext)
        val userId = preferences.userId() ?: return Result.success()
        return try {
            UsageAnalyticsEngine(applicationContext, DigitalDisciplineDatabase.get(applicationContext).dao()).aggregateToday(userId)
            Result.success()
        } catch (_: SecurityException) {
            // Usage Access may be revoked. Do not retry/poll or wake the device.
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }
}

class AggregateSyncWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        // No server aggregate-sync route exists yet. Intentionally retain PENDING items
        // locally rather than upload usage data to an undeclared endpoint or discard it.
        // This worker validates durable scheduling and is safe to evolve when an explicit
        // minimum-data cloud contract is approved.
        return Result.success()
    }
}
