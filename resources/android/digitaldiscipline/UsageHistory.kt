package `in`.satym.studybuddy.digitaldiscipline

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Build

/**
 * One raw platform usage event, decoupled from [UsageEvents.Event] so the folding
 * logic below is plain Kotlin and can be unit tested on the JVM.
 */
data class RawUsageEvent(
    val type: Int,
    val packageName: String,
    val className: String?,
    val timestampMs: Long
)

/** Per-package foreground time and unlock count for one local calendar day. */
data class DayUsageTotals(
    val foregroundMsByPackage: Map<String, Long>,
    /** Null when the platform cannot report unlocks (below Android 9). */
    val unlockCount: Int?,
    /** Events whose timestamp falls inside the day. Zero means "no data", not "no usage". */
    val eventsInWindow: Int,
    val firstEventInWindowMs: Long?
) {
    val screenTimeMs: Long get() = foregroundMsByPackage.values.sum()
    val hasData: Boolean get() = eventsInWindow > 0
}

/**
 * Turns the platform usage event stream into per-app foreground durations the same
 * way the system's own screen-time view does: an app is in the foreground from the
 * first of its activities resuming until the last of them pauses, the screen turns
 * off, or the device shuts down. Intervals are clipped to the requested window, so
 * an app that was already open at midnight is split correctly across the two days.
 *
 * Event type values are the stable public constants from [UsageEvents.Event].
 */
object UsageEventFolder {
    const val ACTIVITY_RESUMED = 1          // MOVE_TO_FOREGROUND before API 29
    const val ACTIVITY_PAUSED = 2           // MOVE_TO_BACKGROUND before API 29
    const val SCREEN_NON_INTERACTIVE = 16   // API 28
    const val KEYGUARD_HIDDEN = 18          // API 28, one per unlock
    const val ACTIVITY_STOPPED = 23         // API 29
    const val DEVICE_SHUTDOWN = 26          // API 29

    /**
     * @param windowStartMs local midnight that starts the day (inclusive)
     * @param windowEndMs end of the day, or "now" for today (exclusive)
     * @param unlocksSupported false below Android 9, where KEYGUARD_HIDDEN does not exist
     */
    fun fold(
        events: List<RawUsageEvent>,
        windowStartMs: Long,
        windowEndMs: Long,
        excludedPackages: Set<String> = emptySet(),
        unlocksSupported: Boolean = true
    ): DayUsageTotals {
        val totals = HashMap<String, Long>()
        // package -> activity classes currently resumed, and when the package came forward.
        val openClasses = HashMap<String, MutableSet<String>>()
        val openedAt = HashMap<String, Long>()
        var unlocks = 0
        var inWindow = 0
        var firstInWindow: Long? = null

        fun credit(packageName: String, from: Long, to: Long) {
            val start = maxOf(from, windowStartMs)
            val end = minOf(to, windowEndMs)
            if (end > start) totals[packageName] = (totals[packageName] ?: 0L) + (end - start)
        }

        fun closePackage(packageName: String, at: Long) {
            val since = openedAt.remove(packageName) ?: return
            openClasses.remove(packageName)
            credit(packageName, since, at)
        }

        fun closeAll(at: Long) {
            for (packageName in openedAt.keys.toList()) closePackage(packageName, at)
        }

        for (event in events.sortedBy { it.timestampMs }) {
            val at = event.timestampMs
            if (at >= windowEndMs) break
            if (at >= windowStartMs) {
                inWindow += 1
                if (firstInWindow == null) firstInWindow = at
            }
            val cls = event.className ?: ""
            when (event.type) {
                ACTIVITY_RESUMED -> {
                    if (event.packageName in excludedPackages) continue
                    val classes = openClasses.getOrPut(event.packageName) { mutableSetOf() }
                    if (classes.isEmpty()) openedAt[event.packageName] = at
                    classes += cls
                }
                ACTIVITY_PAUSED, ACTIVITY_STOPPED -> {
                    val classes = openClasses[event.packageName] ?: continue
                    // STOPPED normally follows PAUSED for a class already removed; that is a no-op.
                    if (!classes.remove(cls)) continue
                    if (classes.isEmpty()) closePackage(event.packageName, at)
                }
                SCREEN_NON_INTERACTIVE, DEVICE_SHUTDOWN -> closeAll(at)
                KEYGUARD_HIDDEN -> if (at >= windowStartMs) unlocks += 1
            }
        }
        // Anything still open at the end of the window was in use until then.
        closeAll(windowEndMs)

        return DayUsageTotals(
            foregroundMsByPackage = totals.filterValues { it > 0L },
            unlockCount = if (unlocksSupported) unlocks else null,
            eventsInWindow = inWindow,
            firstEventInWindowMs = firstInWindow
        )
    }

    /**
     * The platform ages usage events out after a device-dependent number of days.
     * The oldest day that still has events is usually cut off part-way through, so
     * recording it would store a screen time that is too low and looks real. It is
     * treated as truncated when the day before it has no events at all and its own
     * first event arrives well after midnight.
     */
    fun isLikelyTruncated(day: DayUsageTotals, dayStartMs: Long, olderDayHasData: Boolean): Boolean {
        if (olderDayHasData) return false
        val first = day.firstEventInWindowMs ?: return true
        return first - dayStartMs > TRUNCATION_GAP_MS
    }

    private const val TRUNCATION_GAP_MS = 3L * 60L * 60L * 1000L
}

/** Outcome of [UsageAnalyticsEngine.backfillHistory]. */
data class UsageBackfillResult(
    val daysWritten: Int,
    val daysAlreadyFinal: Int,
    val oldestDate: String?,
    val truncatedOldestDropped: Boolean
)

/** Reads a local calendar day of usage events from [UsageStatsManager]. */
class DeviceUsageReader(private val context: Context) {
    private val manager: UsageStatsManager? =
        context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager

    val available: Boolean get() = manager != null

    /**
     * Reads events from a short lead-in before [dayStartMs] so an app that was
     * already in the foreground at midnight is attributed correctly, then folds them.
     */
    fun readDay(dayStartMs: Long, dayEndMs: Long): DayUsageTotals {
        val usage = manager ?: throw IllegalStateException("Usage statistics service is unavailable.")
        val events = usage.queryEvents(dayStartMs - LEAD_IN_MS, dayEndMs)
        val raw = ArrayList<RawUsageEvent>()
        val event = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            val type = event.eventType
            if (type !in RELEVANT_TYPES) continue
            raw += RawUsageEvent(type, event.packageName ?: "", event.className, event.timeStamp)
        }
        return UsageEventFolder.fold(
            events = raw,
            windowStartMs = dayStartMs,
            windowEndMs = dayEndMs,
            excludedPackages = setOf(context.packageName),
            unlocksSupported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
        )
    }

    private companion object {
        const val LEAD_IN_MS = 2L * 60L * 60L * 1000L
        val RELEVANT_TYPES = setOf(
            UsageEventFolder.ACTIVITY_RESUMED,
            UsageEventFolder.ACTIVITY_PAUSED,
            UsageEventFolder.ACTIVITY_STOPPED,
            UsageEventFolder.SCREEN_NON_INTERACTIVE,
            UsageEventFolder.DEVICE_SHUTDOWN,
            UsageEventFolder.KEYGUARD_HIDDEN
        )
    }
}
