package `in`.satym.studybuddy.digitaldiscipline

import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import `in`.satym.studybuddy.widgets.WidgetRefresh
import org.json.JSONObject
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * The only WebView-facing facade for Digital Discipline. Calls accept primitive,
 * validated values and return stable JSON shapes—never Android framework objects.
 */
@CapacitorPlugin(name = "DigitalDiscipline")
class DigitalDisciplinePlugin : Plugin() {
    private lateinit var executor: ExecutorService
    private lateinit var database: DigitalDisciplineDatabase
    private lateinit var dao: DigitalDisciplineDao
    private lateinit var preferences: DigitalDisciplinePreferences
    private lateinit var capabilities: CapabilityManager
    private lateinit var focus: FocusEngine
    private lateinit var usage: UsageAnalyticsEngine
    private lateinit var sync: AggregateSyncEngine
    private lateinit var managed: ManagedDeviceManager

    override fun load() {
        super.load()
        executor = Executors.newSingleThreadExecutor()
        database = DigitalDisciplineDatabase.get(getContext())
        dao = database.dao()
        preferences = DigitalDisciplinePreferences(getContext())
        capabilities = CapabilityManager(getContext())
        focus = FocusEngine(dao)
        usage = UsageAnalyticsEngine(getContext(), dao)
        sync = AggregateSyncEngine(getContext(), dao)
        managed = ManagedDeviceManager(getContext())
    }

    override fun handleOnDestroy() {
        if (::executor.isInitialized) executor.shutdownNow()
        super.handleOnDestroy()
    }

    private fun asynchronous(call: PluginCall, work: () -> JSObject) {
        executor.execute {
            try {
                call.resolve(work())
            } catch (error: IllegalArgumentException) {
                call.reject(error.message ?: "Invalid Digital Discipline request")
            } catch (error: IllegalStateException) {
                call.reject(error.message ?: "Digital Discipline is unavailable in this state")
            } catch (_: SecurityException) {
                call.reject("The required Android permission is no longer granted")
            } catch (_: Exception) {
                // Do not leak secrets, package details, or keystore errors through the bridge.
                call.reject("Digital Discipline could not complete this request")
            }
        }
    }

    private fun requireUser(call: PluginCall): String {
        val userId = (call.getString("userId", "") ?: "").trim()
        require(userId.isNotBlank()) { "A signed-in StudyBuddy user id is required." }
        preferences.setUserId(userId)
        dao.upsertProfile(UserLocalProfileEntity(userId, "", System.currentTimeMillis()))
        return userId
    }

    private fun focusJson(session: FocusSessionEntity?): JSObject {
        val result = JSObject()
        if (session == null) {
            result.put("active", false)
            result.put("state", FocusState.IDLE.name)
            return result
        }
        result.put("active", session.state in setOf(FocusState.CONFIGURING.name, FocusState.READY.name, FocusState.ACTIVE.name, FocusState.PAUSED.name, FocusState.COMPLETING.name, FocusState.SYSTEM_INTERRUPTION.name))
        result.put("id", session.id)
        result.put("state", session.state)
        result.put("mode", session.mode)
        result.put("durationMs", session.configuredDurationMs)
        result.put("elapsedMs", focus.elapsedMs(session))
        result.put("subject", session.subject)
        result.put("controlLevel", session.controlLevel)
        result.put("interruptionReason", session.interruptionReason)
        result.put("startedAtMs", session.startedWallClockMs)
        return result
    }

    private fun emittedFocusJson(session: FocusSessionEntity?): JSObject = focusJson(session).also {
        notifyListeners("focusStateChanged", it)
    }

    private fun summaryJson(summary: DailyUsageSummaryEntity): JSObject = JSObject().apply {
        put("available", true)
        put("localDate", summary.localDate)
        put("screenTimeMs", summary.screenTimeMs)
        put("studyTimeMs", summary.studyTimeMs)
        put("focusTimeMs", summary.focusTimeMs)
        put("distractionTimeMs", summary.distractionTimeMs)
        put("doomscrollTimeMs", summary.doomscrollTimeMs)
        put("blockedAttempts", summary.blockedAttempts)
        put("interventions", summary.interventions)
        put("estimatedRecoveredMs", summary.estimatedRecoveredMs)
        put("updatedAtMs", summary.updatedAtMs)
    }

    private fun diagnosticsJson(): JSObject = JSObject().apply {
        for ((key, value) in capabilities.diagnostics(managed)) put(key, value)
        put("controlLevel", if (managed.isDeviceOwner()) ControlLevel.MANAGED.name else if (preferences.consumerMonitoringEnabled()) ControlLevel.CONSUMER.name else ControlLevel.STANDARD.name)
        put("consumerMonitoringEnabled", preferences.consumerMonitoringEnabled())
        put("focusBubbleEnabled", preferences.focusBubbleEnabled())
        put("featureFlags", JSObject().apply { preferences.featureFlags().forEach { (key, value) -> put(key, value) } })
    }

    @PluginMethod
    fun getCapabilities(call: PluginCall) = asynchronous(call) { diagnosticsJson() }

    /**
     * Replaces the native alarm schedule with the supplied alarms. The list is
     * authoritative: anything not present is cancelled, so the native set can
     * never drift away from what the user sees.
     */
    @PluginMethod
    fun syncNativeAlarms(call: PluginCall) = asynchronous(call) {
        val scheduler = `in`.satym.studybuddy.alarm.AlarmScheduler(getContext())
        val requested = call.getArray("alarms") ?: JSArray()
        val keep = mutableSetOf<Int>()
        val scheduled = mutableListOf<Int>()
        val rejected = mutableListOf<Int>()
        val past = mutableListOf<Int>()

        for (index in 0 until requested.length()) {
            val entry = requested.optJSONObject(index) ?: continue
            val id = entry.optInt("id", 0)
            if (id <= 0) continue
            keep += id
            val triggerAt = entry.optLong("triggerAtMs", 0L)
            if (triggerAt <= System.currentTimeMillis()) {
                past += id
                continue
            }
            val spec = `in`.satym.studybuddy.alarm.AlarmSpec(
                id = id,
                title = entry.optString("title", "").take(120),
                body = entry.optString("body", "").take(400),
                triggerAtWallClockMs = triggerAt,
                snoozeMinutes = entry.optInt("snoozeMinutes", 9).coerceIn(1, 120)
            )
            if (scheduler.schedule(spec)) scheduled += id else rejected += id
        }

        val removed = mutableListOf<Int>()
        for (stored in `in`.satym.studybuddy.alarm.AlarmStore(getContext()).all()) {
            if (!keep.contains(stored.id)) {
                scheduler.cancel(stored.id)
                removed += stored.id
            }
        }

        JSObject().apply {
            put("scheduled", JSArray().apply { scheduled.forEach { put(it) } })
            put("rejected", JSArray().apply { rejected.forEach { put(it) } })
            put("past", JSArray().apply { past.forEach { put(it) } })
            put("removed", JSArray().apply { removed.forEach { put(it) } })
            put("exactAllowed", scheduler.canScheduleExact())
        }
    }

    @PluginMethod
    fun cancelNativeAlarm(call: PluginCall) = asynchronous(call) {
        val id = call.getInt("id", 0) ?: 0
        if (id <= 0) throw IllegalArgumentException("A positive alarm id is required.")
        `in`.satym.studybuddy.alarm.AlarmScheduler(getContext()).cancel(id)
        JSObject().apply { put("cancelled", id) }
    }

    @PluginMethod
    fun listNativeAlarms(call: PluginCall) = asynchronous(call) {
        val items = JSArray()
        for (alarm in `in`.satym.studybuddy.alarm.AlarmStore(getContext()).all()) {
            items.put(JSObject().apply {
                put("id", alarm.id)
                put("title", alarm.title)
                put("body", alarm.body)
                put("triggerAtMs", alarm.triggerAtWallClockMs)
                put("snoozeMinutes", alarm.snoozeMinutes)
                put("state", alarm.state)
            })
        }
        JSObject().apply { put("alarms", items) }
    }

    /**
     * Turns the draggable focus bubble on or off. The bubble only starts and stops
     * focus sessions; it never blocks, suspends, or force-stops an app.
     */
    @PluginMethod
    fun setFocusBubble(call: PluginCall) = asynchronous(call) {
        val enable = call.getBoolean("enabled", false) ?: false
        if (enable && !capabilities.hasOverlayPermission()) {
            return@asynchronous JSObject().apply {
                put("enabled", false)
                put("explanation", "The focus bubble needs the overlay permission before it can appear over other apps.")
            }
        }
        preferences.setFocusBubbleEnabled(enable)
        if (enable) {
            `in`.satym.studybuddy.bubble.ProductiveModeService.start(getContext())
        } else {
            `in`.satym.studybuddy.bubble.ProductiveModeService.stop(getContext())
        }
        JSObject().apply { put("enabled", enable) }
    }

    /** Pushes fresh values to the home-screen widgets; cheap and idempotent. */
    @PluginMethod
    fun refreshWidgets(call: PluginCall) = asynchronous(call) {
        WidgetRefresh.all(getContext())
        JSObject().apply { put("refreshed", true) }
    }

    @PluginMethod
    fun setFocusGoal(call: PluginCall) = asynchronous(call) {
        requireUser(call)
        val minutes = (call.getInt("dailyMinutes", 0) ?: 0).coerceIn(5, 24 * 60)
        preferences.setFocusDailyGoalMinutes(minutes)
        WidgetRefresh.all(getContext())
        JSObject().apply { put("dailyMinutes", minutes) }
    }

    @PluginMethod
    fun getPermissionStatus(call: PluginCall) = asynchronous(call) { diagnosticsJson() }

    @PluginMethod
    fun openUsageAccessSettings(call: PluginCall) {
        getActivity().runOnUiThread {
            try { getActivity().startActivity(capabilities.usageAccessIntent()) ; call.resolve(diagnosticsJson()) }
            catch (_: Exception) { call.reject("Unable to open Usage Access settings") }
        }
    }

    @PluginMethod
    fun openOverlaySettings(call: PluginCall) {
        getActivity().runOnUiThread {
            try { getActivity().startActivity(capabilities.overlayIntent()) ; call.resolve(diagnosticsJson()) }
            catch (_: Exception) { call.reject("Unable to open overlay settings") }
        }
    }

    @PluginMethod
    fun openNotificationSettings(call: PluginCall) {
        getActivity().runOnUiThread {
            try { getActivity().startActivity(capabilities.notificationIntent()) ; call.resolve(diagnosticsJson()) }
            catch (_: Exception) { call.reject("Unable to open notification settings") }
        }
    }

    @PluginMethod
    fun openBatteryOptimizationSettings(call: PluginCall) {
        getActivity().runOnUiThread {
            try { getActivity().startActivity(capabilities.batteryIntent()) ; call.resolve(diagnosticsJson()) }
            catch (_: Exception) { call.reject("Unable to open battery optimization settings") }
        }
    }

    @PluginMethod
    fun setFeatureFlags(call: PluginCall) = asynchronous(call) {
        requireUser(call)
        val values = mutableMapOf<String, Boolean>()
        val flags = call.data.optJSONObject("flags") ?: JSONObject()
        for (name in listOf("usageAnalytics", "antiDoomscroll", "strictFocus", "hardcoreFocus", "studyRoomFocus", "managedDeviceMode", "accessibilityIntegration")) {
            if (flags.has(name)) values[name] = flags.optBoolean(name)
        }
        // Accessibility is only a stored rollout flag: no AccessibilityService is registered or enabled here.
        preferences.setFeatureFlags(values)
        if (values["usageAnalytics"] == true) sync.scheduleUsageAggregation()
        diagnosticsJson()
    }

    @PluginMethod
    fun setConsumerMonitoring(call: PluginCall) = asynchronous(call) {
        requireUser(call)
        val enable = call.getBoolean("enabled", false) ?: false
        if (enable && (!capabilities.hasUsageAccess() || !capabilities.hasOverlayPermission())) {
            return@asynchronous diagnosticsJson().apply {
                put("enabled", false)
                put("explanation", "Consumer interventions require user-granted Usage Access and overlay permission.")
            }
        }
        preferences.setConsumerMonitoring(enable)
        val service = Intent(getContext(), ConsumerEnforcementService::class.java)
        if (enable) ContextCompat.startForegroundService(getContext(), service) else getContext().stopService(service)
        diagnosticsJson().apply { put("enabled", enable) }
    }

    @PluginMethod
    fun startFocus(call: PluginCall) = asynchronous(call) {
        val userId = requireUser(call)
        val mode = runCatching { FocusMode.valueOf((call.getString("mode", FocusMode.NORMAL.name) ?: FocusMode.NORMAL.name).uppercase()) }.getOrElse { FocusMode.NORMAL }
        val level = runCatching { ControlLevel.valueOf((call.getString("controlLevel", ControlLevel.STANDARD.name) ?: ControlLevel.STANDARD.name).uppercase()) }.getOrElse { ControlLevel.STANDARD }
        if (level == ControlLevel.MANAGED) check(managed.isDeviceOwner()) { "Hardcore managed focus requires explicit Device Owner provisioning." }
        if (mode == FocusMode.HARDCORE) check(UnlockCredentialVerifier(dao).configured(userId)) { "Configure a local unlock credential before starting Hardcore Focus." }
        val durationMinutes = (call.getInt("durationMinutes", 0) ?: 0).coerceIn(0, 24 * 60)
        val session = focus.start(userId, mode, durationMinutes.toLong() * 60_000L, (call.getString("subject", "") ?: ""), level)
        if (preferences.consumerMonitoringEnabled()) ContextCompat.startForegroundService(getContext(), Intent(getContext(), ConsumerEnforcementService::class.java))
        emittedFocusJson(session)
    }

    @PluginMethod
    fun pauseFocus(call: PluginCall) = asynchronous(call) { emittedFocusJson(focus.pause(requireUser(call))) }

    @PluginMethod
    fun resumeFocus(call: PluginCall) = asynchronous(call) { emittedFocusJson(focus.resume(requireUser(call))) }

    @PluginMethod
    fun completeFocus(call: PluginCall) = asynchronous(call) {
        val userId = requireUser(call)
        val session = focus.complete(userId)
        getContext().stopService(Intent(getContext(), ConsumerEnforcementService::class.java))
        // The daily summary only counts a completed session, so refresh it before
        // deciding whether a progress notification is warranted.
        runCatching { usage.aggregateToday(userId) }
        runCatching { `in`.satym.studybuddy.rewards.ProgressNotifier(getContext()).notifyIfWorthwhile(userId) }
        WidgetRefresh.all(getContext())
        emittedFocusJson(session)
    }

    @PluginMethod
    fun interruptFocus(call: PluginCall) = asynchronous(call) {
        val userId = requireUser(call)
        val session = focus.interrupt(userId, (call.getString("reason", "user_interrupted") ?: "user_interrupted").take(160))
        getContext().stopService(Intent(getContext(), ConsumerEnforcementService::class.java))
        emittedFocusJson(session)
    }

    @PluginMethod
    fun getFocusStatus(call: PluginCall) = asynchronous(call) { focusJson(focus.status(requireUser(call))) }

    @PluginMethod
    fun saveProtectedApps(call: PluginCall) = asynchronous(call) {
        val userId = requireUser(call)
        val apps = call.getArray("apps") ?: JSArray()
        val now = System.currentTimeMillis()
        val records = mutableListOf<ProtectedAppEntity>()
        for (index in 0 until apps.length()) {
            val app = apps.optJSONObject(index) ?: continue
            val packageName = app.optString("packageName", "").trim()
            if (!packageName.matches(Regex("[A-Za-z0-9_.$]+"))) continue
            val policy = runCatching { AppPolicy.valueOf(app.optString("policy", AppPolicy.WARN.name).uppercase()) }.getOrDefault(AppPolicy.WARN)
            records += ProtectedAppEntity(userId, packageName, app.optString("displayName", packageName).take(160), app.optString("category", "OTHER").uppercase().take(32), policy.name, app.optString("scheduleType", "FOCUS_SESSIONS").uppercase().take(32), app.optString("customScheduleJson", "{}"), now)
        }
        dao.upsertProtectedApps(records)
        JSObject().apply { put("saved", records.size) }
    }

    @PluginMethod
    fun getProtectedApps(call: PluginCall) = asynchronous(call) {
        val items = JSArray()
        for (app in dao.protectedApps(requireUser(call))) {
            items.put(JSObject().apply {
                put("packageName", app.packageName); put("displayName", app.displayName); put("category", app.category)
                put("policy", app.policy); put("scheduleType", app.scheduleType); put("customScheduleJson", app.customScheduleJson)
            })
        }
        JSObject().apply { put("apps", items) }
    }

    @PluginMethod
    fun getDailyUsageSummary(call: PluginCall) = asynchronous(call) {
        val userId = requireUser(call)
        if (!capabilities.hasUsageAccess()) return@asynchronous JSObject().apply {
            put("available", false)
            put("explanation", "Usage Access is not granted. StudyBuddy continues without device usage analytics.")
        }
        summaryJson(usage.aggregateToday(userId))
    }

    /**
     * Turns encouragement notifications on or off. They are off by default and
     * only ever report progress already recorded locally.
     */
    @PluginMethod
    fun setProgressNotifications(call: PluginCall) = asynchronous(call) {
        requireUser(call)
        val enable = call.getBoolean("enabled", false) ?: false
        preferences.setProgressNotificationsEnabled(enable)
        JSObject().apply { put("enabled", enable) }
    }

    @PluginMethod
    fun getProgressState(call: PluginCall) = asynchronous(call) {
        val userId = requireUser(call)
        val notifier = `in`.satym.studybuddy.rewards.ProgressNotifier(getContext())
        val state = notifier.stateFor(userId)
        JSObject().apply {
            put("streakDays", state.streakDays)
            put("todayFocusMinutes", state.todayFocusMinutes)
            put("dailyGoalMinutes", state.dailyGoalMinutes)
            put("weekFocusMinutes", state.weekFocusMinutes)
            put("goalMet", state.goalMet())
            put("enabled", preferences.progressNotificationsEnabled())
            put("milestonesHit", JSArray().apply { state.milestonesHit.forEach { put(it) } })
        }
    }

    /**
     * Weekly rollups for the reports view. The weeks are recomputed from the daily
     * rows on read, so a corrected day is reflected without a separate repair job.
     */
    @PluginMethod
    fun getWeeklyUsageSummaries(call: PluginCall) = asynchronous(call) {
        val userId = requireUser(call)
        val weeks = (call.getInt("weeks", 8) ?: 8).coerceIn(1, 52)
        val written = usage.rollUpRecentWeeks(userId, weeks)
        val items = JSArray()
        for (week in dao.weeklySummaries(userId, weeks)) {
            items.put(JSObject().apply {
                put("weekStart", week.weekStart)
                put("screenTimeMs", week.screenTimeMs)
                put("studyTimeMs", week.studyTimeMs)
                put("focusTimeMs", week.focusTimeMs)
                put("doomscrollTimeMs", week.doomscrollTimeMs)
                put("updatedAtMs", week.updatedAtMs)
            })
        }
        WidgetRefresh.all(getContext())
        JSObject().apply {
            put("weeksWritten", written)
            put("weeks", items)
        }
    }

    @PluginMethod
    fun evaluateDoomscroll(call: PluginCall) = asynchronous(call) {
        requireUser(call)
        val policy = runCatching { AppPolicy.valueOf((call.getString("policy", AppPolicy.WARN.name) ?: AppPolicy.WARN.name).uppercase()) }.getOrDefault(AppPolicy.WARN)
        val signalsObject = call.data.optJSONObject("signals") ?: JSONObject()
        val signals = DoomscrollScorer.defaultWeights.keys.associateWith { signalsObject.optInt(it, 0).coerceIn(0, 100) }
        val result = DoomscrollScorer.evaluate(signals, threshold = (call.getInt("threshold", 10) ?: 10), policy = policy)
        JSObject().apply {
            put("score", result.score); put("threshold", result.threshold); put("triggered", result.triggered)
            put("requestedPolicy", result.requestedPolicy.name); put("effectiveAction", result.effectiveAction)
            put("reasons", JSArray(result.reasons))
        }
    }

    @PluginMethod
    fun configureUnlockCredential(call: PluginCall) = asynchronous(call) {
        val userId = requireUser(call)
        UnlockCredentialVerifier(dao).configure(userId, call.getString("credential", "") ?: "", call.getBoolean("biometricAllowed", false) ?: false)
        JSObject().apply { put("configured", true); put("secureStorage", Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) }
    }

    @PluginMethod
    fun verifyUnlockCredential(call: PluginCall) = asynchronous(call) {
        val userId = requireUser(call)
        val verified = UnlockCredentialVerifier(dao).verify(userId, call.getString("credential", "") ?: "")
        JSObject().apply { put("verified", verified) }
    }

    @PluginMethod
    fun joinRoomFocus(call: PluginCall) = asynchronous(call) {
        val userId = requireUser(call)
        val roomId = (call.getString("roomId", "") ?: "").trim()
        val serverSessionId = (call.getString("serverSessionId", "") ?: "").trim()
        require(roomId.isNotEmpty() && serverSessionId.isNotEmpty()) { "Room and server session ids are required." }
        val startsAtMs = call.getLong("startsAtMs", System.currentTimeMillis()) ?: System.currentTimeMillis()
        val durationMinutes = (call.getInt("durationMinutes", 0) ?: 0).coerceIn(0, 24 * 60)
        val native = if (startsAtMs <= System.currentTimeMillis() && focus.status(userId) == null) {
            focus.start(userId, FocusMode.SHARED_ROOM, durationMinutes.toLong() * 60_000L, (call.getString("topic", "") ?: ""), ControlLevel.STANDARD)
        } else null
        dao.upsertRoomFocus(RoomFocusSessionEntity("room:$userId:$serverSessionId", userId, roomId, serverSessionId, native?.id, startsAtMs, durationMinutes.toLong() * 60_000L, native?.state ?: FocusState.READY.name, System.currentTimeMillis()))
        JSObject().apply { put("joined", true); put("nativeFocus", emittedFocusJson(native)) }
    }

    @PluginMethod
    fun getManagementStatus(call: PluginCall) = asynchronous(call) { JSObject().apply { managed.status().forEach { (key, value) -> put(key, value) } } }

    @PluginMethod
    fun configureManagedFocus(call: PluginCall) = asynchronous(call) {
        val packages = call.getArray("allowedPackages") ?: JSArray()
        val parsed = (0 until packages.length()).mapNotNull { packages.optString(it, "").takeIf { name -> name.matches(Regex("[A-Za-z0-9_.$]+")) } }
        managed.configureAllowedPackages(parsed)
        JSObject().apply { managed.status().forEach { (key, value) -> put(key, value) } }
    }

    @PluginMethod
    fun enterManagedFocusMode(call: PluginCall) = asynchronous(call) {
        val packages = call.getArray("allowedPackages") ?: JSArray()
        val parsed = (0 until packages.length()).mapNotNull { packages.optString(it, "").takeIf { name -> name.matches(Regex("[A-Za-z0-9_.$]+")) } }
        getActivity().runOnUiThread { managed.enterManagedFocusMode(getActivity(), parsed) }
        JSObject().apply { managed.status().forEach { (key, value) -> put(key, value) } }.apply { put("entered", true) }
    }

    @PluginMethod
    fun exitManagedFocusMode(call: PluginCall) = asynchronous(call) {
        getActivity().runOnUiThread { managed.exitManagedFocusMode(getActivity()) }
        JSObject().apply { managed.status().forEach { (key, value) -> put(key, value) } }.apply { put("exited", true) }
    }

    @PluginMethod
    fun deleteUsageData(call: PluginCall) = asynchronous(call) {
        val userId = requireUser(call)
        dao.deleteUsageSnapshots(userId); dao.deleteUsageApplications(userId); dao.deleteDailyUsage(userId); dao.deleteWeeklyUsage(userId)
        JSObject().apply { put("deleted", true) }
    }

    @PluginMethod
    fun clearFocusHistory(call: PluginCall) = asynchronous(call) {
        val userId = requireUser(call)
        dao.deleteFocusEvents(userId); dao.deleteFocusSessions(userId)
        JSObject().apply { put("deleted", true) }
    }

    @PluginMethod
    fun disableMonitoring(call: PluginCall) = asynchronous(call) {
        preferences.setConsumerMonitoring(false)
        getContext().stopService(Intent(getContext(), ConsumerEnforcementService::class.java))
        JSObject().apply { put("disabled", true) }
    }

    @PluginMethod
    fun getSyncStatus(call: PluginCall) = asynchronous(call) {
        val queue = dao.syncQueue(requireUser(call))
        JSObject().apply {
            put("pending", queue.count { it.state == SyncState.PENDING.name })
            put("syncing", queue.count { it.state == SyncState.SYNCING.name })
            put("synced", queue.count { it.state == SyncState.SYNCED.name })
            put("failed", queue.count { it.state == SyncState.FAILED.name })
            put("uploadsEnabled", false)
            put("explanation", "Aggregate cloud sync is queued locally but disabled until StudyBuddy has an approved minimum-data sync API.")
        }
    }
}
