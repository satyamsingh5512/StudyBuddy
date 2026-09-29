package `in`.satym.studybuddy.toolkit

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import `in`.satym.studybuddy.activeblocks.ActiveBlocks
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplineDatabase
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplinePreferences
import `in`.satym.studybuddy.digitaldiscipline.FocusState
import `in`.satym.studybuddy.focuslauncher.FocusLauncher
import `in`.satym.studybuddy.nudges.FocusNudges
import `in`.satym.studybuddy.nudges.StudyReminders
import `in`.satym.studybuddy.shortsblock.AppRule
import `in`.satym.studybuddy.shortsblock.BlockedWindow
import `in`.satym.studybuddy.shortsblock.ShortsBlock
import `in`.satym.studybuddy.shortsblock.ShortsBlockConfig
import `in`.satym.studybuddy.sounds.FocusSounds
import `in`.satym.studybuddy.zen.ZenMode
import `in`.satym.studybuddy.zen.ZenSchedule
import `in`.satym.studybuddy.zen.ZenWindow
import java.util.Calendar
import java.util.UUID
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * The only WebView-facing facade for the study toolkit: focus sounds, scheduled Zen
 * windows, leave-focus nudges and study reminders, short-form feed blocking, the
 * distraction-free home screen, and guided permission setup.
 *
 * The shape mirrors DigitalDisciplinePlugin on purpose. Every call runs on a single
 * background thread because most of these features touch SharedPreferences, Room or
 * PackageManager; every call resolves a plain JSObject of primitives so no Android
 * framework object ever crosses the bridge; and every failure is reported as one of a
 * small set of generic messages so an exception cannot leak package lists, file paths
 * or system state into JavaScript.
 *
 * Input from the WebView is untrusted and validated here rather than in the feature
 * packages, so a malformed call is rejected before it can be persisted.
 */
@CapacitorPlugin(name = "StudyToolkit")
class StudyToolkitPlugin : Plugin() {
    private lateinit var executor: ExecutorService

    override fun load() {
        super.load()
        executor = Executors.newSingleThreadExecutor()
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
                call.reject(error.message ?: "Invalid study toolkit request")
            } catch (error: IllegalStateException) {
                call.reject(error.message ?: "The study toolkit is unavailable in this state")
            } catch (_: SecurityException) {
                call.reject("The required Android permission is no longer granted")
            } catch (_: Exception) {
                // Never surface the underlying exception: it can carry package names,
                // file paths and vendor details that the WebView has no business seeing.
                call.reject("The study toolkit could not complete this request")
            }
        }
    }

    // ---------------------------------------------------------------- validation

    private fun clampVolume(call: PluginCall): Float {
        val raw = call.getDouble("volume") ?: DEFAULT_VOLUME.toDouble()
        require(!raw.isNaN() && !raw.isInfinite()) { "volume must be a number between 0 and 1." }
        return raw.toFloat().coerceIn(0f, 1f)
    }

    private fun requireMinutes(call: PluginCall, key: String): Int {
        val raw = call.getInt(key) ?: throw IllegalArgumentException("$key is required.")
        require(raw in MIN_MINUTES..MAX_MINUTES) { "$key must be between $MIN_MINUTES and $MAX_MINUTES." }
        return raw
    }

    private fun optionalMinutes(call: PluginCall, key: String): Int? {
        val raw = call.getInt(key) ?: return null
        if (raw <= 0) return null
        require(raw in MIN_MINUTES..MAX_MINUTES) { "$key must be between $MIN_MINUTES and $MAX_MINUTES." }
        return raw
    }

    /**
     * Package names are validated against the Android manifest grammar rather than
     * merely being non-blank, so a stored list can never be used to smuggle a path,
     * a URL or a component name into code that later builds intents from it.
     */
    private fun validatedPackages(call: PluginCall, key: String): List<String> {
        val array = call.getArray(key) ?: return emptyList()
        val values = array.toList<Any>()
        require(values.size <= MAX_PACKAGES) { "At most $MAX_PACKAGES apps can be selected." }
        val cleaned = values.mapNotNull { it as? String }.map { it.trim() }.filter { it.isNotEmpty() }
        cleaned.forEach { candidate ->
            require(PACKAGE_PATTERN.matches(candidate)) { "\"$candidate\" is not a valid Android package name." }
        }
        return cleaned.distinct()
    }

    private fun validatedMinutesOfDay(call: PluginCall, key: String): List<Int> {
        val array = call.getArray(key) ?: return emptyList()
        val values = array.toList<Any>().mapNotNull { (it as? Number)?.toInt() }
        require(values.size <= MAX_REMINDER_TIMES) { "At most $MAX_REMINDER_TIMES reminder times are supported." }
        values.forEach { require(it in 0..1439) { "Reminder times must be minutes from midnight (0-1439)." } }
        return values.distinct().sorted()
    }

    private fun validatedDays(call: PluginCall, key: String): Set<Int> {
        val array = call.getArray(key) ?: return emptySet()
        val values = array.toList<Any>().mapNotNull { (it as? Number)?.toInt() }
        values.forEach {
            require(it in Calendar.SUNDAY..Calendar.SATURDAY) { "Days must be 1 (Sunday) through 7 (Saturday)." }
        }
        return values.toSet()
    }

    // ------------------------------------------------------------------- status

    @PluginMethod
    fun getToolkitStatus(call: PluginCall) = asynchronous(call) {
        val context = getContext()
        JSObject().apply {
            put("platform", "android")
            put("sounds", soundStatusJson())
            put("zen", zenConfigJson())
            put("nudges", nudgeConfigJson())
            put("shortsBlock", shortsBlockConfigJson())
            put("appRules", appRulesJson())
            put("activeBlocks", activeBlocksJson())
            put("launcher", launcherConfigJson())
            put("permissions", permissionsJson())
            put("interruptionFilter", PermissionCoach.interruptionFilterName(context))
        }
    }

    // ------------------------------------------------------------- focus sounds

    private fun soundStatusJson(): JSObject {
        val status = FocusSounds.status(getContext())
        return JSObject().apply {
            put("playing", status.playing)
            put("paused", status.paused)
            put("soundscapeId", status.soundscapeId)
            put("volume", status.volume.toDouble())
            put("followFocus", status.followFocus)
            status.endsAtMs?.let { put("endsAtMs", it) }
        }
    }

    @PluginMethod
    fun listSoundscapes(call: PluginCall) = asynchronous(call) {
        val array = JSArray()
        FocusSounds.catalog().forEach { (id, label) ->
            array.put(JSObject().apply {
                put("id", id)
                put("label", label)
            })
        }
        JSObject().apply { put("soundscapes", array) }
    }

    @PluginMethod
    fun startFocusSound(call: PluginCall) = asynchronous(call) {
        val requestedId = (call.getString("soundscapeId") ?: "").trim()
        require(requestedId.isNotEmpty()) { "soundscapeId is required." }
        val known = FocusSounds.catalog().any { it.first == requestedId }
        require(known) { "Unknown soundscape." }

        FocusSounds.start(
            context = getContext(),
            soundscapeId = requestedId,
            volume = clampVolume(call),
            stopAfterMinutes = optionalMinutes(call, "stopAfterMinutes"),
            followFocus = call.getBoolean("followFocus", false) == true
        )
        soundStatusJson()
    }

    @PluginMethod
    fun pauseFocusSound(call: PluginCall) = asynchronous(call) {
        FocusSounds.pause(getContext())
        soundStatusJson()
    }

    @PluginMethod
    fun resumeFocusSound(call: PluginCall) = asynchronous(call) {
        FocusSounds.resume(getContext())
        soundStatusJson()
    }

    @PluginMethod
    fun stopFocusSound(call: PluginCall) = asynchronous(call) {
        FocusSounds.stop(getContext())
        soundStatusJson()
    }

    @PluginMethod
    fun setFocusSoundVolume(call: PluginCall) = asynchronous(call) {
        FocusSounds.setVolume(getContext(), clampVolume(call))
        soundStatusJson()
    }

    // ----------------------------------------------------------------- zen mode

    private fun zenWindowJson(window: ZenWindow): JSObject = JSObject().apply {
        put("id", window.id)
        put("label", window.label)
        put("daysOfWeek", JSArray(window.daysOfWeek.sorted()))
        put("startMinute", window.startMinute)
        put("endMinute", window.endMinute)
        put("enabled", window.enabled)
        put("startFocus", window.startFocus)
        put("allowPriorityOnly", window.allowPriorityOnly)
    }

    private fun zenConfigJson(): JSObject {
        val context = getContext()
        val status = ZenMode.status(context)
        val windows = JSArray()
        ZenMode.windows(context).forEach { windows.put(zenWindowJson(it)) }
        return JSObject().apply {
            put("enabled", status.enabled)
            put("active", status.active)
            put("hasPolicyAccess", status.hasPolicyAccess)
            put("activeWindowId", status.activeWindowId)
            status.nextChangeAtMs?.let { put("nextChangeAtMs", it) }
            put("windows", windows)
        }
    }

    @PluginMethod
    fun getZenConfig(call: PluginCall) = asynchronous(call) { zenConfigJson() }

    @PluginMethod
    fun setZenWindows(call: PluginCall) = asynchronous(call) {
        val array = call.getArray("windows") ?: JSArray()
        val raw = array.toList<Any>()
        require(raw.size <= ZenSchedule.MAX_WINDOWS) {
            "At most ${ZenSchedule.MAX_WINDOWS} Zen windows are supported."
        }

        val windows = raw.mapIndexed { index, element ->
            val obj = element as? org.json.JSONObject
                ?: throw IllegalArgumentException("Zen window ${index + 1} is not an object.")
            parseZenWindow(obj, index)
        }
        // A label collision is fine, but duplicate ids would make the schedule
        // ambiguous and the UI unable to address a single window.
        require(windows.map { it.id }.distinct().size == windows.size) { "Zen window ids must be unique." }

        ZenMode.setWindows(getContext(), windows)
        zenConfigJson()
    }

    private fun parseZenWindow(obj: org.json.JSONObject, index: Int): ZenWindow {
        val position = index + 1
        val id = obj.optString("id").trim().ifEmpty { UUID.randomUUID().toString() }
        require(id.length <= MAX_ID_LENGTH) { "Zen window $position has an id that is too long." }

        val label = obj.optString("label").trim().ifEmpty { "Study window" }
        require(label.length <= MAX_LABEL_LENGTH) { "Zen window $position has a label that is too long." }

        val startMinute = obj.optInt("startMinute", -1)
        val endMinute = obj.optInt("endMinute", -1)
        require(startMinute in 0..1439) { "Zen window $position has an invalid start time." }
        require(endMinute in 0..1439) { "Zen window $position has an invalid end time." }
        require(startMinute != endMinute) { "Zen window $position must not start and end at the same minute." }

        val daysArray = obj.optJSONArray("daysOfWeek")
        val days = mutableSetOf<Int>()
        if (daysArray != null) {
            for (i in 0 until daysArray.length()) {
                val day = daysArray.optInt(i, -1)
                require(day in Calendar.SUNDAY..Calendar.SATURDAY) {
                    "Zen window $position has an invalid day; use 1 (Sunday) through 7 (Saturday)."
                }
                days.add(day)
            }
        }
        require(days.isNotEmpty()) { "Zen window $position needs at least one day selected." }

        return ZenWindow(
            id = id,
            label = label,
            daysOfWeek = days,
            startMinute = startMinute,
            endMinute = endMinute,
            enabled = obj.optBoolean("enabled", true),
            startFocus = obj.optBoolean("startFocus", false),
            allowPriorityOnly = obj.optBoolean("allowPriorityOnly", true)
        )
    }

    @PluginMethod
    fun setZenEnabled(call: PluginCall) = asynchronous(call) {
        val enabled = call.getBoolean("enabled") ?: throw IllegalArgumentException("enabled is required.")
        require(!enabled || ZenMode.hasPolicyAccess(getContext())) {
            "Zen mode needs Do Not Disturb access before it can be switched on."
        }
        ZenMode.setEnabled(getContext(), enabled)
        zenConfigJson()
    }

    @PluginMethod
    fun zenEnterNow(call: PluginCall) = asynchronous(call) {
        val minutes = requireMinutes(call, "minutes")
        require(ZenMode.hasPolicyAccess(getContext())) {
            "Zen mode needs Do Not Disturb access before it can be switched on."
        }
        ZenMode.enterNow(getContext(), minutes)
        zenConfigJson()
    }

    @PluginMethod
    fun zenExitNow(call: PluginCall) = asynchronous(call) {
        ZenMode.exitNow(getContext())
        zenConfigJson()
    }

    // ------------------------------------------------------------------- nudges

    private fun nudgeConfigJson(): JSObject {
        val context = getContext()
        val reminders = StudyReminders.config(context)
        return JSObject().apply {
            put("leaveFocusEnabled", FocusNudges.enabled(context))
            put("studyPackages", JSArray(FocusNudges.studyPackages(context)))
            put("remindersEnabled", reminders.enabled)
            put("reminderTimes", JSArray(reminders.timesMinutesOfDay))
            put("reminderDays", JSArray(reminders.enabledDays.sorted()))
            put("idleNudgeEnabled", reminders.idleNudgeEnabled)
        }
    }

    @PluginMethod
    fun getNudgeConfig(call: PluginCall) = asynchronous(call) { nudgeConfigJson() }

    @PluginMethod
    fun setNudgeConfig(call: PluginCall) = asynchronous(call) {
        val context = getContext()
        val studyPackages = validatedPackages(call, "studyPackages")
        val times = validatedMinutesOfDay(call, "reminderTimes")
        val days = validatedDays(call, "reminderDays")
        val remindersEnabled = call.getBoolean("remindersEnabled", false) == true
        // Enabling reminders with nothing scheduled would silently never fire, which
        // reads as a broken feature rather than an empty one.
        require(!remindersEnabled || (times.isNotEmpty() && days.isNotEmpty())) {
            "Pick at least one reminder time and one day before switching reminders on."
        }

        FocusNudges.setEnabled(context, call.getBoolean("leaveFocusEnabled", true) == true)
        FocusNudges.setStudyPackages(context, studyPackages)
        StudyReminders.setSchedule(context, times, days, remindersEnabled)
        nudgeConfigJson()
    }

    // -------------------------------------------------------------- shorts block

    private fun shortsBlockConfigJson(): JSObject {
        val context = getContext()
        val config = ShortsBlock.config(context)
        val stats = ShortsBlock.todayStatsExtended(context)
        val strict = ShortsBlock.strictStatus(context, isFocusActive())
        return JSObject().apply {
            put("serviceEnabled", ShortsBlock.isServiceEnabled(context))
            put("youtubeEnabled", config.youtubeEnabled)
            put("instagramEnabled", config.instagramEnabled)
            put("facebookEnabled", config.facebookEnabled)
            put("snapchatEnabled", config.snapchatEnabled)
            put("onlyDuringFocus", config.onlyDuringFocus)
            put("dailyAllowanceMinutes", config.dailyAllowanceMinutes)
            put("blockedPackages", JSArray(config.blockedPackages))
            put("protectSettings", config.protectSettings)
            put("swipeLimit", config.swipeLimit)
            put("blockInBrowsers", config.blockInBrowsers)
            put("blockTikTok", config.blockTikTok)
            put("blockedToday", stats["blockedToday"])
            put("shortsSecondsToday", stats["shortsSecondsToday"])
            put("reelsSwiped", stats["reelsSwiped"])
            put("browserBlocks", stats["browserBlocks"])
            put("strictMode", strict["strictMode"])
            put("strictAlways", strict["strictAlways"])
            put("strictCooloffMinutes", strict["cooloffMinutes"])
            put("strictActive", strict["active"])
            // Absent rather than null when nothing is pending, so the UI can test for
            // the key instead of distinguishing null from zero.
            (strict["pendingUntilMs"] as? Long)?.let { put("strictPendingUntilMs", it) }
        }
    }

    @PluginMethod
    fun getShortsBlockConfig(call: PluginCall) = asynchronous(call) { shortsBlockConfigJson() }

    @PluginMethod
    fun setShortsBlockConfig(call: PluginCall) = asynchronous(call) {
        val context = getContext()
        val current = ShortsBlock.config(context)
        val allowance = call.getInt("dailyAllowanceMinutes") ?: current.dailyAllowanceMinutes
        require(allowance in 0..MAX_ALLOWANCE_MINUTES) {
            "The daily allowance must be between 0 and $MAX_ALLOWANCE_MINUTES minutes."
        }

        val blockedPackages = if (call.getArray("blockedPackages") != null) {
            validatedPackages(call, "blockedPackages")
        } else {
            current.blockedPackages
        }

        val swipeLimit = call.getInt("swipeLimit") ?: current.swipeLimit
        require(swipeLimit in 0..MAX_SWIPE_LIMIT) { "The swipe limit must be between 0 and $MAX_SWIPE_LIMIT." }

        ShortsBlock.setConfig(
            context,
            ShortsBlockConfig(
                youtubeEnabled = call.getBoolean("youtubeEnabled", current.youtubeEnabled) == true,
                instagramEnabled = call.getBoolean("instagramEnabled", current.instagramEnabled) == true,
                facebookEnabled = call.getBoolean("facebookEnabled", current.facebookEnabled) == true,
                snapchatEnabled = call.getBoolean("snapchatEnabled", current.snapchatEnabled) == true,
                onlyDuringFocus = call.getBoolean("onlyDuringFocus", current.onlyDuringFocus) == true,
                dailyAllowanceMinutes = allowance,
                blockedPackages = blockedPackages,
                protectSettings = call.getBoolean("protectSettings", current.protectSettings) == true,
                // Custom detection rules are intentionally not settable from the WebView.
                // They are matched against live view ids, so accepting arbitrary strings
                // here would let page script widen what the service inspects.
                customIdRules = current.customIdRules,
                swipeLimit = swipeLimit,
                blockInBrowsers = call.getBoolean("blockInBrowsers", current.blockInBrowsers) == true,
                blockTikTok = call.getBoolean("blockTikTok", current.blockTikTok) == true
            )
        )

        applyStrictFromCall(call)
        shortsBlockConfigJson()
    }

    /**
     * Strict mode is written through [ShortsBlock.applyStrictSettings] and never as part
     * of the plain config write, because turning it off has to pass through the cool-off
     * gate. The three strict keys are also only honoured when the caller actually sent
     * them: a config write that omits them must not restate — and so possibly reset —
     * a protection the user did not touch.
     */
    private fun applyStrictFromCall(call: PluginCall) {
        val requestedMode = call.getBoolean("strictMode")
        val requestedAlways = call.getBoolean("strictAlways")
        val requestedCooloff = call.getInt("strictCooloffMinutes")
        if (requestedMode == null && requestedAlways == null && requestedCooloff == null) return

        val context = getContext()
        val currentStrict = ShortsBlock.strictSettings(context)
        val cooloff = requestedCooloff ?: currentStrict.strictCooloffMinutes
        require(cooloff in 0..MAX_STRICT_COOLOFF_MINUTES) {
            "The cool-off must be between 0 and $MAX_STRICT_COOLOFF_MINUTES minutes."
        }
        ShortsBlock.applyStrictSettings(
            context,
            strictMode = requestedMode ?: currentStrict.strictMode,
            strictAlways = requestedAlways ?: currentStrict.strictAlways,
            strictCooloffMinutes = cooloff,
            isFocusActive = isFocusActive()
        )
    }

    /**
     * Starts the cool-off that has to elapse before strict mode switches off. Separate
     * from [setShortsBlockConfig] so the UI can offer it as its own deliberate action
     * and show the countdown that comes back.
     */
    @PluginMethod
    fun requestStrictDisable(call: PluginCall) = asynchronous(call) {
        ShortsBlock.requestStrictDisable(getContext(), isFocusActive())
        shortsBlockConfigJson()
    }

    // ------------------------------------------------------- per-app rules

    private fun appRulesJson(): JSObject {
        val rules = JSArray()
        ShortsBlock.appRules(getContext()).forEach { rule ->
            val windows = JSArray()
            rule.blockedWindows.forEach { window ->
                windows.put(JSObject().apply {
                    put("days", JSArray(window.daysOfWeek.sorted()))
                    put("startMinute", window.startMinute)
                    put("endMinute", window.endMinute)
                })
            }
            rules.put(JSObject().apply {
                put("packageName", rule.packageName)
                put("dailyLimitMinutes", rule.dailyLimitMinutes)
                put("windows", windows)
            })
        }
        return JSObject().apply { put("rules", rules) }
    }

    @PluginMethod
    fun getAppRules(call: PluginCall) = asynchronous(call) { appRulesJson() }

    @PluginMethod
    fun setAppRules(call: PluginCall) = asynchronous(call) {
        val array = call.getArray("rules") ?: JSArray()
        val raw = array.toList<Any>()
        require(raw.size <= MAX_APP_RULES) { "At most $MAX_APP_RULES app rules are supported." }

        val rules = raw.mapIndexed { index, element ->
            val obj = element as? org.json.JSONObject
                ?: throw IllegalArgumentException("App rule ${index + 1} is not an object.")
            parseAppRule(obj, index)
        }
        // Two rules for one package would make the effective limit ambiguous.
        require(rules.map { it.packageName }.distinct().size == rules.size) {
            "Each app can only have one rule."
        }

        ShortsBlock.setAppRules(getContext(), rules)
        appRulesJson()
    }

    private fun parseAppRule(obj: org.json.JSONObject, index: Int): AppRule {
        val position = index + 1
        val packageName = obj.optString("packageName").trim()
        require(PACKAGE_PATTERN.matches(packageName)) {
            "App rule $position does not name a valid Android package."
        }

        val dailyLimitMinutes = obj.optInt("dailyLimitMinutes", 0)
        require(dailyLimitMinutes in 0..MAX_DAILY_LIMIT_MINUTES) {
            "App rule $position must have a daily limit between 0 and $MAX_DAILY_LIMIT_MINUTES minutes."
        }

        val windowsArray = obj.optJSONArray("windows") ?: org.json.JSONArray()
        require(windowsArray.length() <= MAX_RULE_WINDOWS) {
            "App rule $position can have at most $MAX_RULE_WINDOWS schedules."
        }
        val windows = (0 until windowsArray.length()).map { slot ->
            val windowObj = windowsArray.optJSONObject(slot)
                ?: throw IllegalArgumentException("App rule $position has an invalid schedule.")
            parseBlockedWindow(windowObj, position, slot + 1)
        }

        return AppRule(
            packageName = packageName,
            dailyLimitMinutes = dailyLimitMinutes,
            blockedWindows = windows
        )
    }

    private fun parseBlockedWindow(obj: org.json.JSONObject, rulePosition: Int, slot: Int): BlockedWindow {
        val startMinute = obj.optInt("startMinute", -1)
        val endMinute = obj.optInt("endMinute", -1)
        require(startMinute in 0..1439) { "Schedule $slot of app rule $rulePosition has an invalid start time." }
        require(endMinute in 0..1439) { "Schedule $slot of app rule $rulePosition has an invalid end time." }

        val daysArray = obj.optJSONArray("days")
        val days = mutableSetOf<Int>()
        if (daysArray != null) {
            for (i in 0 until daysArray.length()) {
                val day = daysArray.optInt(i, -1)
                require(day in Calendar.SUNDAY..Calendar.SATURDAY) {
                    "Schedule $slot of app rule $rulePosition has an invalid day; use 1 (Sunday) through 7 (Saturday)."
                }
                days.add(day)
            }
        }
        require(days.isNotEmpty()) {
            "Schedule $slot of app rule $rulePosition needs at least one day selected."
        }

        return BlockedWindow(daysOfWeek = days, startMinute = startMinute, endMinute = endMinute)
    }

    /**
     * Today's foreground seconds per package, as a list rather than a keyed object so
     * a package name can never collide with a field the UI expects.
     */
    @PluginMethod
    fun getAppUsageToday(call: PluginCall) = asynchronous(call) {
        val usage = JSArray()
        ShortsBlock.usageTodaySeconds(getContext())
            .entries
            .sortedByDescending { it.value }
            .forEach { (packageName, seconds) ->
                usage.put(JSObject().apply {
                    put("packageName", packageName)
                    put("seconds", seconds)
                })
            }
        JSObject().apply { put("usage", usage) }
    }

    // ------------------------------------------------------------- active blocks

    private fun activeBlocksJson(): JSObject {
        val status = ActiveBlocks.status(getContext())
        return JSObject().apply {
            put("chipEnabled", status.chipEnabled)
            put("chipRunning", status.chipRunning)
            put("standingEnabled", status.standingEnabled)
            put("overlayPermission", status.overlayPermission)
        }
    }

    @PluginMethod
    fun getActiveBlocksConfig(call: PluginCall) = asynchronous(call) { activeBlocksJson() }

    @PluginMethod
    fun setActiveBlocksChip(call: PluginCall) = asynchronous(call) {
        val enabled = call.getBoolean("enabled") ?: throw IllegalArgumentException("enabled is required.")
        // Enabling without the overlay permission would start a service that stops
        // itself again immediately, which reads as a toggle that does not work.
        require(!enabled || ActiveBlocks.status(getContext()).overlayPermission) {
            "The floating chip needs permission to display over other apps."
        }
        ActiveBlocks.setChipEnabled(getContext(), enabled)
        activeBlocksJson()
    }

    @PluginMethod
    fun setStandingNotification(call: PluginCall) = asynchronous(call) {
        val enabled = call.getBoolean("enabled") ?: throw IllegalArgumentException("enabled is required.")
        ActiveBlocks.setStandingNotificationEnabled(getContext(), enabled)
        activeBlocksJson()
    }

    /**
     * Whether a focus session is running right now.
     *
     * Read from the database rather than accepted as a call parameter: strict mode uses
     * this to decide whether protection is in effect, so page script must not be able
     * to claim a session has ended in order to report strict mode as inactive. Every
     * plugin call already runs on the background executor, so the Room read is legal here.
     */
    private fun isFocusActive(): Boolean = runCatching {
        val context = getContext()
        val userId = DigitalDisciplinePreferences(context).userId()
        if (userId.isNullOrBlank()) return@runCatching false
        val session = DigitalDisciplineDatabase.get(context).dao().activeFocus(userId)
            ?: return@runCatching false
        FocusState.valueOf(session.state) == FocusState.ACTIVE
    }.getOrDefault(false)

    // ------------------------------------------------------------- focus launcher

    private fun launcherConfigJson(): JSObject {
        val context = getContext()
        return JSObject().apply {
            put("enabled", FocusLauncher.isEnabled(context))
            put("isDefaultHome", FocusLauncher.isDefaultHome(context))
            put("allowedApps", JSArray(FocusLauncher.allowedApps(context)))
        }
    }

    @PluginMethod
    fun getLauncherConfig(call: PluginCall) = asynchronous(call) { launcherConfigJson() }

    @PluginMethod
    fun setLauncherEnabled(call: PluginCall) = asynchronous(call) {
        val enabled = call.getBoolean("enabled") ?: throw IllegalArgumentException("enabled is required.")
        FocusLauncher.setEnabled(getContext(), enabled)
        launcherConfigJson()
    }

    @PluginMethod
    fun setLauncherAllowedApps(call: PluginCall) = asynchronous(call) {
        FocusLauncher.setAllowedApps(getContext(), validatedPackages(call, "packages"))
        launcherConfigJson()
    }

    @PluginMethod
    fun listLaunchableApps(call: PluginCall) = asynchronous(call) {
        val array = JSArray()
        FocusLauncher.launchableApps(getContext()).forEach { app ->
            array.put(JSObject().apply {
                put("packageName", app.packageName)
                put("label", app.label)
            })
        }
        JSObject().apply { put("apps", array) }
    }

    // ---------------------------------------------------------------- permissions

    private fun permissionsJson(): JSObject {
        val statuses = PermissionCoach.statuses(getContext())
        return JSObject().apply {
            PermissionCoach.ORDERED_KEYS.forEach { key ->
                val state = statuses[key] ?: PermissionState(granted = false, required = false)
                put(key, JSObject().apply {
                    put("granted", state.granted)
                    put("required", state.required)
                })
            }
            put("order", JSArray(PermissionCoach.ORDERED_KEYS))
        }
    }

    @PluginMethod
    fun getPermissionStatus(call: PluginCall) = asynchronous(call) { permissionsJson() }

    @PluginMethod
    fun openPermission(call: PluginCall) = asynchronous(call) {
        val key = (call.getString("key") ?: "").trim()
        require(key in PermissionCoach.ORDERED_KEYS) { "Unknown permission." }
        // startActivity and Toast both belong on the UI thread; the settings screen
        // also needs to be launched from the foreground task to appear immediately.
        val opened = runCatching {
            val activity = getActivity()
            activity.runOnUiThread { PermissionCoach.open(activity, key) }
            true
        }.getOrElse { PermissionCoach.open(getContext(), key) }

        JSObject().apply {
            put("opened", opened)
            put("key", key)
            put("guidance", PermissionCoach.guidance(getContext(), key))
        }
    }

    private companion object {
        const val DEFAULT_VOLUME = 0.7f
        const val MIN_MINUTES = 1
        const val MAX_MINUTES = 600
        const val MAX_PACKAGES = 50
        const val MAX_REMINDER_TIMES = 12
        const val MAX_ALLOWANCE_MINUTES = 600
        const val MAX_SWIPE_LIMIT = 200
        const val MAX_STRICT_COOLOFF_MINUTES = 120
        const val MAX_APP_RULES = 50
        const val MAX_RULE_WINDOWS = 6
        const val MAX_DAILY_LIMIT_MINUTES = 1440
        const val MAX_ID_LENGTH = 64
        const val MAX_LABEL_LENGTH = 60
        val PACKAGE_PATTERN = Regex("^[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z0-9_]+)+$")
    }
}
