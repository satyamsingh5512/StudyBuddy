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

    companion object {
        /** Upper bound on one import. Most devices retain far less event history than this. */
        const val MAX_BACKFILL_DAYS = 60
        /** Consecutive event-less days that mark the end of the platform's retained log. */
        const val MAX_EMPTY_RUN = 2
    }

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
        val reader = DeviceUsageReader(context)
        if (!reader.available) throw IllegalStateException("Usage statistics service is unavailable.")
        val totals = reader.readDay(start, now)
        // Event-based totals clip exactly at local midnight. Only fall back to the
        // coarser daily buckets when the event log has nothing for today at all.
        val perPackage = if (totals.hasData) totals.foregroundMsByPackage else legacyTodayBuckets(start, now)
        val summary = writeDay(userId, date, start, now, perPackage, totals.unlockCount.takeIf { totals.hasData }, now)
        rollUpWeek(userId)
        return summary
    }

    /**
     * Imports the device's own usage history for past days, the same record the
     * system screen-time dashboard reads, so a new install shows real history
     * instead of starting empty.
     *
     * - Reads newest to oldest and stops after [MAX_EMPTY_RUN] consecutive days with
     *   no events: that is where the platform has aged the log out.
     * - A day already recomputed after it ended is final and is skipped, so repeat
     *   runs are cheap and never overwrite good rows with a shorter, aged-out log.
     * - The oldest day that still has events is dropped if it looks cut off, rather
     *   than stored as an artificially low screen time.
     * - Days without events are not written, so a gap reads as "no data", never as
     *   zero usage.
     *
     * Everything stays in the local database; nothing is uploaded.
     */
    fun backfillHistory(userId: String, days: Int): UsageBackfillResult {
        val safeDays = days.coerceIn(1, MAX_BACKFILL_DAYS)
        val reader = DeviceUsageReader(context)
        if (!reader.available) throw IllegalStateException("Usage statistics service is unavailable.")
        val now = System.currentTimeMillis()
        val today = Calendar.getInstance().apply {
            timeInMillis = now
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }

        data class PastDay(val date: String, val start: Long, val end: Long, val totals: DayUsageTotals)
        val read = mutableListOf<PastDay>()
        var skippedFinal = 0
        var emptyRun = 0
        for (offset in 1..safeDays) {
            val dayStart = (today.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, -offset) }
            // Calendar arithmetic, not 24h multiples, so DST days are 23 or 25 hours long.
            val dayEnd = (dayStart.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, 1) }
            val date = dateFormatter.format(Date(dayStart.timeInMillis))
            val existing = dao.dailySummary(userId, date)
            if (existing != null && existing.updatedAtMs >= dayEnd.timeInMillis) {
                skippedFinal += 1
                emptyRun = 0
                continue
            }
            val totals = reader.readDay(dayStart.timeInMillis, dayEnd.timeInMillis)
            if (!totals.hasData) {
                emptyRun += 1
                if (emptyRun >= MAX_EMPTY_RUN) break
                continue
            }
            emptyRun = 0
            read += PastDay(date, dayStart.timeInMillis, dayEnd.timeInMillis, totals)
        }

        // `read` is newest first; the last entry is the oldest day that still had events.
        val oldest = read.lastOrNull()
        val oldestHasOlderData = oldest != null && run {
            val olderStart = Calendar.getInstance().apply { timeInMillis = oldest.start; add(Calendar.DAY_OF_YEAR, -1) }.timeInMillis
            reader.readDay(olderStart, oldest.start).hasData
        }
        var truncatedDropped = false
        val toWrite = if (oldest != null && UsageEventFolder.isLikelyTruncated(oldest.totals, oldest.start, oldestHasOlderData)) {
            truncatedDropped = true
            read.dropLast(1)
        } else read

        for (day in toWrite) {
            writeDay(userId, day.date, day.start, day.end, day.totals.foregroundMsByPackage, day.totals.unlockCount, now)
        }
        if (toWrite.isNotEmpty()) rollUpRecentWeeks(userId, (safeDays + 6) / 7 + 1)
        return UsageBackfillResult(
            daysWritten = toWrite.size,
            daysAlreadyFinal = skippedFinal,
            oldestDate = toWrite.lastOrNull()?.date,
            truncatedOldestDropped = truncatedDropped
        )
    }

    /**
     * Writes one day's summary plus its per-app rows. Focus, blocked attempts and
     * interventions are bounded to the day, so a past day is not credited with
     * activity that happened after it.
     */
    private fun writeDay(
        userId: String,
        date: String,
        start: Long,
        end: Long,
        foregroundMsByPackage: Map<String, Long>,
        unlockCount: Int?,
        now: Long
    ): DailyUsageSummaryEntity {
        val protected = dao.protectedApps(userId).associateBy { it.packageName }
        val snapshots = mutableListOf<UsageSnapshotEntity>()
        val applications = mutableListOf<UsageApplicationEntity>()
        var screenTime = 0L
        var distractionTime = 0L
        for ((packageName, rawDuration) in foregroundMsByPackage) {
            val duration = rawDuration.coerceAtLeast(0L)
            if (duration == 0L || packageName == context.packageName) continue
            screenTime += duration
            val config = protected[packageName]
            if (config?.policy == AppPolicy.WARN.name || config?.policy == AppPolicy.INTERVENE.name || config?.policy == AppPolicy.BLOCK.name) {
                distractionTime += duration
            }
            val label = try {
                context.packageManager.getApplicationLabel(context.packageManager.getApplicationInfo(packageName, 0)).toString()
            } catch (_: PackageManager.NameNotFoundException) { packageName }
            applications += UsageApplicationEntity(userId, packageName, label, config?.category ?: "OTHER", config != null, now)
            snapshots += UsageSnapshotEntity(
                id = "day:$date:$packageName", userId = userId, packageName = packageName,
                startAtMs = start, endAtMs = end, foregroundMs = duration, capturedAtMs = now
            )
        }
        val focusEngine = FocusEngine(dao)
        val focus = dao.focusBetween(userId, start, end).sumOf { focusEngine.elapsedMs(it) }
        val attempts = dao.blockedAttemptCountBetween(userId, start, end)
        val interventions = dao.interventionCountBetween(userId, start, end)
        // This is deliberately an estimate: count only configured ten-second interventions.
        val recovered = interventions.toLong() * 10_000L
        val summary = DailyUsageSummaryEntity(
            userId, date, screenTime, studyTimeMs = focus, focusTimeMs = focus,
            distractionTimeMs = distractionTime, doomscrollTimeMs = distractionTime,
            blockedAttempts = attempts, interventions = interventions, estimatedRecoveredMs = recovered,
            updatedAtMs = now, unlockCount = unlockCount
        )
        dao.upsertUsageApplications(applications)
        // Replace, not merge: an app that dropped out of a recomputed day must not linger.
        dao.deleteDaySnapshots(userId, "day:$date:")
        dao.upsertUsageSnapshots(snapshots)
        dao.upsertDailySummary(summary)
        return summary
    }

    /** Pre-existing bucket path, kept only as a fallback when the event log is empty. */
    private fun legacyTodayBuckets(start: Long, now: Long): Map<String, Long> {
        val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return emptyMap()
        val totals = HashMap<String, Long>()
        for (stat in manager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, now).orEmpty()) {
            val duration = stat.totalTimeInForeground.coerceAtLeast(0L)
            if (duration > 0L) totals[stat.packageName] = (totals[stat.packageName] ?: 0L) + duration
        }
        return totals
    }

    /**
     * Collapses the daily summaries of the current calendar week into
     * `weekly_usage_summaries`.
     *
     * The weekly table existed without a producer, so nothing ever read from it.
     * The rollup is recomputed from the daily rows rather than incremented, so a
     * re-run after a corrected day is idempotent instead of double-counting.
     * Week start follows the device locale, matching the calendar week the user
     * actually sees rather than a fixed Sunday.
     */
    fun rollUpWeek(userId: String): WeeklyUsageSummaryEntity? {
        val now = System.currentTimeMillis()
        val calendar = Calendar.getInstance().apply { timeInMillis = now }
        val weekStartDate = (calendar.clone() as Calendar).apply {
            set(Calendar.DAY_OF_WEEK, firstDayOfWeek)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val weekKey = dateFormatter.format(Date(weekStartDate.timeInMillis))
        val days = dao.dailySummariesBetween(userId, weekKey)
        if (days.isEmpty()) return null
        val summary = WeeklyUsageSummaryEntity(
            userId = userId,
            weekStart = weekKey,
            screenTimeMs = days.sumOf { it.screenTimeMs },
            studyTimeMs = days.sumOf { it.studyTimeMs },
            focusTimeMs = days.sumOf { it.focusTimeMs },
            doomscrollTimeMs = days.sumOf { it.doomscrollTimeMs },
            updatedAtMs = now
        )
        dao.upsertWeeklySummary(summary)
        return summary
    }

    /** Recomputes the trailing weeks, used by the reports view on demand. */
    fun rollUpRecentWeeks(userId: String, weeks: Int): Int {
        val safeWeeks = weeks.coerceIn(1, 52)
        var written = 0
        for (offset in 0 until safeWeeks) {
            val weekStart = (Calendar.getInstance() as Calendar).apply {
                add(Calendar.DAY_OF_YEAR, -7 * offset)
                set(Calendar.DAY_OF_WEEK, firstDayOfWeek)
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            val weekEnd = (weekStart.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, 6) }
            val days = dao.dailySummariesInRange(
                userId,
                dateFormatter.format(Date(weekStart.timeInMillis)),
                dateFormatter.format(Date(weekEnd.timeInMillis))
            )
            if (days.isEmpty()) continue
            dao.upsertWeeklySummary(
                WeeklyUsageSummaryEntity(
                    userId = userId,
                    weekStart = dateFormatter.format(Date(weekStart.timeInMillis)),
                    screenTimeMs = days.sumOf { it.screenTimeMs },
                    studyTimeMs = days.sumOf { it.studyTimeMs },
                    focusTimeMs = days.sumOf { it.focusTimeMs },
                    doomscrollTimeMs = days.sumOf { it.doomscrollTimeMs },
                    updatedAtMs = System.currentTimeMillis()
                )
            )
            written += 1
        }
        return written
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
            val engine = UsageAnalyticsEngine(applicationContext, DigitalDisciplineDatabase.get(applicationContext).dao())
            engine.aggregateToday(userId)
            // Runs every 6h, so without this the last hours of each day were never
            // recorded unless the app happened to be opened before midnight. Days
            // already finalised are skipped, so this is cheap.
            engine.backfillHistory(userId, 7)
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
