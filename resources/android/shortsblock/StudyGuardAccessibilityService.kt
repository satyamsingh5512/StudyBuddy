package `in`.satym.studybuddy.shortsblock

import android.accessibilityservice.AccessibilityService
import android.content.SharedPreferences
import android.os.Build
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import `in`.satym.studybuddy.digitaldiscipline.BlockedAttemptEntity
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplineDatabase
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplinePreferences
import `in`.satym.studybuddy.digitaldiscipline.FocusState
import `in`.satym.studybuddy.digitaldiscipline.newLocalId
import `in`.satym.studybuddy.nudges.FocusNudges
import java.util.Calendar
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Accessibility service that detects and optionally blocks short-form video content
 * (YouTube Shorts, Instagram Reels, etc.) and enforces app restrictions during focus.
 *
 * Why AccessibilityService:
 * Unlike UsageStatsManager or DeviceAdmin, AccessibilityService can observe the
 * current screen content in real time and identify specific UI patterns (e.g., a
 * Shorts feed versus regular YouTube). This precision allows blocking only the
 * distraction, not the entire app.
 *
 * What is read:
 * This service inspects view IDs, text labels, and content descriptions of the
 * foreground app to detect short-form patterns. It never reads message content,
 * passwords, or data from other apps unless that app is explicitly configured
 * for blocking.
 *
 * Privacy:
 * All inspection happens locally on the device. No screen content, package names,
 * or usage patterns are transmitted to any server. The service only acts when a
 * configured rule matches, and only the configured action (press BACK or HOME) occurs.
 *
 * Approval:
 * This service is used in a personal build with the owner's explicit consent.
 * It is not distributed via Play Store and is not intended for general release.
 */
class StudyGuardAccessibilityService : AccessibilityService() {

    private companion object {
        /** Upper bound on nodes touched by a single recycle pass. */
        const val MAX_RECYCLE_NODES = 600

        /** Upper bound on nodes scanned while checking for a risky settings screen. */
        const val MAX_SETTINGS_SCAN_NODES = 200

        /** AOSP settings package; the only one this service will ever inspect. */
        const val SETTINGS_PACKAGE = "com.android.settings"

        /** Package installer packages for uninstall dialog detection. */
        val INSTALLER_PACKAGES = setOf(
            "com.google.android.packageinstaller",
            "com.android.packageinstaller"
        )

        /** TikTok package names for whole-app blocking. */
        val TIKTOK_PACKAGES = setOf(
            "com.zhiliaoapp.musically",
            "com.ss.android.ugc.trill"
        )

        /** Packages with built-in detection rules, checked before the stored config. */
        val KNOWN_SHORT_FORM_PACKAGES = setOf(
            "com.google.android.youtube",
            "com.instagram.android",
            "com.facebook.katana",
            "com.snapchat.android"
        )
    }

    private lateinit var database: DigitalDisciplineDatabase
    private lateinit var preferences: DigitalDisciplinePreferences
    private lateinit var executor: ExecutorService
    private lateinit var configPrefs: SharedPreferences
    private lateinit var strictPrefs: SharedPreferences
    private lateinit var prefsListener: SharedPreferences.OnSharedPreferenceChangeListener

    private val debounceMap = mutableMapOf<String, Long>()
    private val debounceIntervalMs = 700L
    private val cooldownMap = mutableMapOf<String, Long>()
    private val cooldownIntervalMs = 1500L

    /** Minimum gap between foreground-usage writes, so accrual costs one write per 5 s. */
    private val accrualIntervalMs = 5_000L

    private var lastShortsDetectedMs = 0L
    private var currentForegroundApp: String? = null

    /**
     * When the foreground app's usage was last banked. Every millisecond is credited at
     * most once because this marker only ever moves forward, so accrual during a stint
     * and the final top-up when the app leaves the foreground cannot double count.
     */
    private var foregroundAccruedAtMs = 0L

    /**
     * Cached configuration to avoid parsing JSON on every accessibility event.
     * Refreshed when SharedPreferences change.
     */
    @Volatile
    private var cachedConfig: ShortsBlockConfig = ShortsBlockConfig()

    @Volatile
    private var cachedAppRules: List<AppRule> = emptyList()

    @Volatile
    private var cachedStrictSettings: StrictModeSettings = StrictModeSettings(
        strictMode = false,
        strictAlways = false,
        strictCooloffMinutes = 10,
        pendingDisableAtMs = null
    )

    /**
     * Room forbids queries on the main thread, and every accessibility callback runs
     * there. The focus state is therefore refreshed on the executor and read from
     * these fields when a blocking decision has to be made synchronously. The window
     * of staleness is one refresh interval, which only ever means a block is applied
     * or skipped a second or two late — never a wrong write to the database.
     */
    @Volatile
    private var cachedFocusActive: Boolean = false

    @Volatile
    private var cachedFocusSessionId: String? = null

    @Volatile
    private var cachedFocusAtMs: Long = 0L

    private val focusCacheTtlMs = 5_000L

    override fun onCreate() {
        super.onCreate()
        database = DigitalDisciplineDatabase.get(applicationContext)
        preferences = DigitalDisciplinePreferences(applicationContext)
        executor = Executors.newSingleThreadExecutor()
        
        // Load initial config
        cachedConfig = ShortsBlock.config(this)
        cachedAppRules = ShortsBlock.appRules(this)
        cachedStrictSettings = StrictGuard.settings(this)

        // Listen for config changes
        configPrefs = getSharedPreferences("studybuddy_shortsblock", MODE_PRIVATE)
        // Strict mode lives in its own preferences file, so it needs its own
        // registration: without this a strict toggle made in the app would not reach
        // the running service until it was restarted.
        strictPrefs = getSharedPreferences("studybuddy_shortsblock_strict", MODE_PRIVATE)
        prefsListener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
            // Refresh cached config on any change
            cachedConfig = ShortsBlock.config(this@StudyGuardAccessibilityService)
            cachedAppRules = ShortsBlock.appRules(this@StudyGuardAccessibilityService)
            cachedStrictSettings = StrictGuard.settings(this@StudyGuardAccessibilityService)
        }
        configPrefs.registerOnSharedPreferenceChangeListener(prefsListener)
        strictPrefs.registerOnSharedPreferenceChangeListener(prefsListener)

        // Prune old usage data on service start
        if (!executor.isShutdown) {
            executor.execute { AppUsageTracker.pruneOldData(this@StudyGuardAccessibilityService) }
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        // Register preferences listeners again in case onCreate was skipped.
        // Registering an already-registered listener is a no-op.
        registerPrefsListeners()
    }

    override fun onDestroy() {
        unregisterPrefsListeners()
        if (::executor.isInitialized) {
            executor.shutdownNow()
        }
        super.onDestroy()
    }

    override fun onUnbind(intent: android.content.Intent?): Boolean {
        unregisterPrefsListeners()
        return super.onUnbind(intent)
    }

    private fun registerPrefsListeners() {
        if (!::prefsListener.isInitialized) return
        if (::configPrefs.isInitialized) {
            configPrefs.registerOnSharedPreferenceChangeListener(prefsListener)
        }
        if (::strictPrefs.isInitialized) {
            strictPrefs.registerOnSharedPreferenceChangeListener(prefsListener)
        }
    }

    private fun unregisterPrefsListeners() {
        if (!::prefsListener.isInitialized) return
        if (::configPrefs.isInitialized) {
            configPrefs.unregisterOnSharedPreferenceChangeListener(prefsListener)
        }
        if (::strictPrefs.isInitialized) {
            strictPrefs.unregisterOnSharedPreferenceChangeListener(prefsListener)
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        val packageName = event.packageName?.toString() ?: return

        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                handleForegroundAppChange(packageName)
            }
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,
            AccessibilityEvent.TYPE_VIEW_SCROLLED,
            AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED -> {
                handleContentChange(packageName, event.eventType)
            }
        }
    }

    override fun onInterrupt() {
        // System requests the service to stop. Nothing to clean up in-flight.
    }

    /**
     * Handle a foreground app change (TYPE_WINDOW_STATE_CHANGED).
     */
    private fun handleForegroundAppChange(packageName: String) {
        // Bank the previous app's outstanding time, but only when the foreground app has
        // actually changed. TYPE_WINDOW_STATE_CHANGED also fires for dialogs, new
        // activities and the keyboard within one app, and restarting the clock on those
        // would discard almost all of the elapsed time — a per-app daily limit would then
        // never be reached no matter how long the app was used.
        val previous = currentForegroundApp
        if (previous != packageName) {
            if (previous != null) {
                accrueForegroundUsage(previous, SystemClock.elapsedRealtime(), minimumGapMs = 1_000L)
            }
            currentForegroundApp = packageName
            foregroundAccruedAtMs = SystemClock.elapsedRealtime()
        }

        if (packageName == this.packageName) return

        // Handle strict mode protection first
        if (handleStrictProtection(packageName)) return

        // Launchers, SystemUI and the rest of the platform are never nudged about or
        // blocked; they are not something a user chose to open.
        if (packageName.startsWith("com.android.") && packageName != SETTINGS_PACKAGE) return

        // Let the nudges feature know which app came to the front
        runCatching { FocusNudges.onForegroundApp(this, packageName) }

        // Check TikTok whole-app block
        if (cachedConfig.blockTikTok && packageName in TIKTOK_PACKAGES) {
            handleTikTokBlock(packageName)
            return
        }

        // Check app limits and schedules
        val matchingRule = cachedAppRules.firstOrNull { it.packageName == packageName }
        if (matchingRule != null) {
            val now = Calendar.getInstance()
            val inWindow = AppLimits.isInBlockedWindow(matchingRule, now)
            val limitExceeded = AppUsageTracker.limitExceeded(this, matchingRule)

            if (inWindow || limitExceeded) {
                handleAppRuleBlock(packageName, matchingRule, inWindow)
                return
            }
        }

        // Check if this is a blocked app during focus
        if (cachedConfig.blockedPackages.contains(packageName)) {
            handleBlockedApp(packageName)
        }
    }

    /**
     * Bank the time [packageName] has spent in the foreground since it was last banked.
     *
     * Accrual is incremental rather than one lump when the app leaves the foreground. A
     * stint ends only when another app comes forward, so a single long sitting would
     * otherwise arrive as one oversized delta and be clipped by the per-addition cap in
     * [AppUsageTracker.addSeconds] — a daily limit could then never be reached from one
     * sitting. Splitting it into pieces also keeps the cap doing its real job: while the
     * device is asleep no accessibility events arrive, so a screen-off gap contributes
     * one capped increment instead of hours of phantom use.
     *
     * [minimumGapMs] throttles the SharedPreferences write; the caller passes a small
     * value when the app is leaving the foreground and the remainder must not be lost.
     */
    private fun accrueForegroundUsage(
        packageName: String,
        nowMs: Long,
        minimumGapMs: Long = accrualIntervalMs
    ) {
        val since = foregroundAccruedAtMs
        if (since <= 0L) {
            foregroundAccruedAtMs = nowMs
            return
        }
        val deltaMs = nowMs - since
        // A negative delta means elapsedRealtime restarted; drop the interval rather
        // than crediting a negative or absurd duration.
        if (deltaMs < minimumGapMs) {
            if (deltaMs < 0L) foregroundAccruedAtMs = nowMs
            return
        }
        foregroundAccruedAtMs = nowMs
        val seconds = deltaMs / 1000L
        if (seconds > 0L) {
            AppUsageTracker.addSeconds(this, packageName, seconds)
        }
    }

    /**
     * Handle content changes, scrolling, and text changes that may reveal short-form content.
     */
    private fun handleContentChange(packageName: String, eventType: Int) {
        // Any event from the app in front is evidence it is still being used, so the
        // running stint is banked here rather than only when the app is left.
        if (packageName == currentForegroundApp) {
            accrueForegroundUsage(packageName, SystemClock.elapsedRealtime())
        }

        // Handle browser URL detection on TYPE_VIEW_TEXT_CHANGED
        if (eventType == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED &&
            cachedConfig.blockInBrowsers &&
            BrowserShortsRule.isBrowser(packageName)
        ) {
            val now = SystemClock.elapsedRealtime()
            val lastScan = debounceMap[packageName] ?: 0L
            if (now - lastScan < debounceIntervalMs) return
            debounceMap[packageName] = now

            val root = rootInActiveWindow ?: return
            val wrapper = AndroidNodeView(root)
            try {
                val detected = BrowserShortsRule.detectUrl(wrapper, packageName)
                if (detected != null) {
                    handleBrowserShortsDetected(packageName, now)
                }
            } finally {
                recycleTree(wrapper)
            }
            return
        }

        // Debounce first for short-form detection
        val now = SystemClock.elapsedRealtime()
        val lastScan = debounceMap[packageName] ?: 0L
        if (now - lastScan < debounceIntervalMs) return
        debounceMap[packageName] = now

        val isTarget = packageName in KNOWN_SHORT_FORM_PACKAGES ||
            cachedConfig.customIdRules.containsKey(packageName)

        if (!isTarget) return

        // Check cooldown to prevent rapid-fire blocks
        val lastBlock = cooldownMap[packageName] ?: 0L
        if (now - lastBlock < cooldownIntervalMs) return

        val root = rootInActiveWindow ?: return
        val wrapper = AndroidNodeView(root)

        try {
            val detected = ShortFormDetector.detect(wrapper, packageName, cachedConfig)
            if (detected) {
                // Record swipe if TYPE_VIEW_SCROLLED and detection is positive
                if (eventType == AccessibilityEvent.TYPE_VIEW_SCROLLED) {
                    ReelSwipeLimiter.recordSwipe(this, now)
                }
                handleShortsDetected(packageName, now)
            } else {
                // If no longer detected but was recently, count the viewing time. The
                // marker has to be set: elapsedRealtime is small just after a reboot, so
                // an unset marker would otherwise fall inside the 5 s window and credit
                // seconds for a feed that was never on screen.
                if (lastShortsDetectedMs != 0L && now - lastShortsDetectedMs < 5000L) {
                    val viewedSeconds = (now - lastShortsDetectedMs) / 1000L
                    ShortsBlock.addShortsSeconds(this, viewedSeconds)
                }
                lastShortsDetectedMs = 0L
            }
        } finally {
            recycleTree(wrapper)
        }
    }

    /**
     * Handle strict mode protection for settings screens and uninstall dialogs.
     *
     * @return True if protection was applied (caller should abort further processing).
     */
    private fun handleStrictProtection(packageName: String): Boolean {
        // Cheap gate off the cached copy first: almost every window change happens
        // with strict mode off, and this avoids reading preferences at all in that case.
        if (!cachedStrictSettings.strictMode) return false
        if (!StrictGuard.isActive(this, isActiveFocusSession())) return false

        val root = rootInActiveWindow ?: return false
        val wrapper = AndroidNodeView(root)

        try {
            val risky = when {
                packageName == SETTINGS_PACKAGE -> {
                    StrictProtectionRules.isStudyBuddyAppInfo(wrapper) ||
                        StrictProtectionRules.isStudyGuardAccessibilitySettings(wrapper) ||
                        StrictProtectionRules.isDeviceAdminDeactivation(wrapper)
                }
                packageName in INSTALLER_PACKAGES -> {
                    StrictProtectionRules.isUninstallDialog(wrapper)
                }
                else -> false
            }

            if (risky) {
                performGlobalAction(GLOBAL_ACTION_BACK)
                return true
            }
        } finally {
            recycleTree(wrapper)
        }

        return false
    }

    /**
     * Handle TikTok whole-app block.
     */
    private fun handleTikTokBlock(packageName: String) {
        if (!shouldBlockNow()) return

        val now = SystemClock.elapsedRealtime()
        val lastBlock = cooldownMap[packageName] ?: 0L
        if (now - lastBlock < cooldownIntervalMs) return
        cooldownMap[packageName] = now

        performGlobalAction(GLOBAL_ACTION_HOME)
        ShortsBlockedActivity.launchForBlockedApp(this, "TikTok")
        recordBlockedAttempt(packageName, "TIKTOK_WHOLE_APP_BLOCKED")
    }

    /**
     * Handle app rule block (daily limit or time window).
     */
    private fun handleAppRuleBlock(packageName: String, rule: AppRule, inWindow: Boolean) {
        val now = SystemClock.elapsedRealtime()
        val lastBlock = cooldownMap[packageName] ?: 0L
        if (now - lastBlock < cooldownIntervalMs) return
        cooldownMap[packageName] = now

        performGlobalAction(GLOBAL_ACTION_HOME)

        if (inWindow) {
            val endTime = AppLimits.nextWindowEndTime(rule, Calendar.getInstance()) ?: "later"
            ShortsBlockedActivity.launchForAppWindow(this, appLabel(packageName), endTime)
            recordBlockedAttempt(packageName, "APP_WINDOW_BLOCKED")
        } else {
            ShortsBlockedActivity.launchForAppLimit(this, appLabel(packageName), rule.dailyLimitMinutes)
            recordBlockedAttempt(packageName, "APP_LIMIT_REACHED")
        }
    }

    /**
     * Handle detection of short-form content.
     */
    private fun handleShortsDetected(packageName: String, nowMs: Long) {
        if (lastShortsDetectedMs == 0L) {
            lastShortsDetectedMs = nowMs
        }

        // Check if blocking is required
        if (!shouldBlockNow()) return

        // Check swipe limit first
        if (ReelSwipeLimiter.limitExceeded(this, cachedConfig.swipeLimit)) {
            performGlobalAction(GLOBAL_ACTION_BACK)
            cooldownMap[packageName] = nowMs
            ShortsBlock.recordBlock(this)
            ShortsBlockedActivity.launchForSwipeLimit(this, ReelSwipeLimiter.todayCount(this))
            recordBlockedAttempt(packageName, "SWIPE_LIMIT_REACHED")
            val viewedSeconds = (nowMs - lastShortsDetectedMs) / 1000L
            ShortsBlock.addShortsSeconds(this, viewedSeconds)
            lastShortsDetectedMs = 0L
            return
        }

        // A daily allowance of 0 means "no allowance at all", so blocking applies
        // immediately. Only when an allowance is configured and still has time left
        // do we let the feed run and bank the viewing seconds against it.
        if (cachedConfig.dailyAllowanceMinutes > 0 && !ShortsBlock.allowanceExhausted(this, cachedConfig)) {
            val viewedSeconds = (nowMs - lastShortsDetectedMs) / 1000L
            if (viewedSeconds > 0L) {
                ShortsBlock.addShortsSeconds(this, viewedSeconds)
                lastShortsDetectedMs += viewedSeconds * 1000L
            }
            return
        }

        // Block: press BACK and show intervention
        performGlobalAction(GLOBAL_ACTION_BACK)
        cooldownMap[packageName] = nowMs
        ShortsBlock.recordBlock(this)

        val platformName = when (packageName) {
            "com.google.android.youtube" -> "YouTube Shorts"
            "com.instagram.android" -> "Instagram Reels"
            "com.facebook.katana" -> "Facebook Reels"
            "com.snapchat.android" -> "Snapchat Spotlight"
            else -> "Short-form content"
        }

        ShortsBlockedActivity.launchForShorts(this, platformName)
        recordBlockedAttempt(packageName, "SHORTS_CLOSED")

        val viewedSeconds = (nowMs - lastShortsDetectedMs) / 1000L
        ShortsBlock.addShortsSeconds(this, viewedSeconds)
        lastShortsDetectedMs = 0L
    }

    /**
     * Handle browser short-form URL detection.
     */
    private fun handleBrowserShortsDetected(packageName: String, nowMs: Long) {
        if (!shouldBlockNow()) return

        val lastBlock = cooldownMap[packageName] ?: 0L
        if (nowMs - lastBlock < cooldownIntervalMs) return
        cooldownMap[packageName] = nowMs

        performGlobalAction(GLOBAL_ACTION_BACK)
        ShortsBlock.recordBrowserBlock(this)
        ShortsBlockedActivity.launchForBrowserShorts(this)
        recordBlockedAttempt(packageName, "BROWSER_SHORTS_BLOCKED")
    }

    /**
     * Handle a blocked app during focus.
     */
    private fun handleBlockedApp(packageName: String) {
        if (!isActiveFocusSession()) return

        val now = SystemClock.elapsedRealtime()
        val lastBlock = cooldownMap[packageName] ?: 0L
        if (now - lastBlock < cooldownIntervalMs) return
        cooldownMap[packageName] = now

        performGlobalAction(GLOBAL_ACTION_HOME)
        ShortsBlockedActivity.launchForBlockedApp(this, appLabel(packageName))
        recordBlockedAttempt(packageName, "APP_BLOCKED_DURING_FOCUS")
    }

    /**
     * Check if blocking should happen now based on onlyDuringFocus setting.
     */
    private fun shouldBlockNow(): Boolean {
        return if (cachedConfig.onlyDuringFocus) {
            isActiveFocusSession()
        } else {
            true
        }
    }

    /**
     * Resolves a human-readable app name. The intervention copy is shown to the user,
     * so a raw package name would read like a fault report rather than a sentence.
     */
    private fun appLabel(packageName: String): String = runCatching {
        val info = packageManager.getApplicationInfo(packageName, 0)
        packageManager.getApplicationLabel(info).toString()
    }.getOrDefault(packageName)

    /**
     * Reports the last known focus state. Never touches Room directly; it only
     * schedules a refresh when the cached value has expired.
     */
    private fun isActiveFocusSession(): Boolean {
        refreshFocusCacheIfStale()
        return cachedFocusActive
    }

    private fun refreshFocusCacheIfStale() {
        val now = SystemClock.elapsedRealtime()
        if (now - cachedFocusAtMs < focusCacheTtlMs) return
        cachedFocusAtMs = now
        if (executor.isShutdown) return
        runCatching {
            executor.execute {
                val userId = preferences.userId()
                if (userId == null) {
                    cachedFocusActive = false
                    cachedFocusSessionId = null
                    return@execute
                }
                val session = database.dao().activeFocus(userId)
                cachedFocusActive = session != null &&
                    runCatching { FocusState.valueOf(session.state) == FocusState.ACTIVE }
                        .getOrDefault(false)
                cachedFocusSessionId = if (cachedFocusActive) session?.id else null
            }
        }
    }

    /**
     * Record a blocked attempt in the database. The user id lookup and the insert
     * both happen on the executor because both touch DataStore/Room.
     */
    private fun recordBlockedAttempt(packageName: String, outcome: String) {
        val sessionId = cachedFocusSessionId
        if (executor.isShutdown) return
        runCatching {
            executor.execute {
                val userId = preferences.userId() ?: return@execute
                database.dao().insertBlockedAttempt(
                    BlockedAttemptEntity(
                        id = newLocalId(),
                        userId = userId,
                        sessionId = sessionId,
                        packageName = packageName,
                        enforcementLevel = "ACCESSIBILITY",
                        outcome = outcome,
                        atMs = System.currentTimeMillis()
                    )
                )
            }
        }
    }

    /**
     * Recursively recycle all nodes in a tree. Required on API < 33.
     *
     * The walk is bounded like the detection walk is: a pathological view hierarchy
     * must not be able to stall an accessibility callback.
     */
    private fun recycleTree(node: AccessibilityNodeView) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // recycle() is deprecated at API 33+; no-op is safe
            return
        }
        var visited = 0
        val queue = ArrayDeque<AccessibilityNodeView>()
        queue.add(node)
        while (queue.isNotEmpty() && visited < MAX_RECYCLE_NODES) {
            val n = queue.removeFirst()
            visited += 1
            for (i in 0 until n.childCount()) {
                val child = n.childAt(i)
                if (child != null) queue.add(child)
            }
            n.recycle()
        }
    }

    /**
     * Adapter from AccessibilityNodeInfo to the testable interface.
     *
     * Children are cached: AccessibilityNodeInfo.getChild allocates a fresh instance
     * on every call, so without caching the nodes walked during detection would be
     * different objects from the ones the recycle pass sees, and every scanned node
     * would leak on API levels that still require explicit recycling.
     */
    private class AndroidNodeView(private val node: AccessibilityNodeInfo) : AccessibilityNodeView {
        private var children: MutableList<AndroidNodeView?>? = null

        override val viewIdResourceName: String?
            get() = node.viewIdResourceName
        override val text: CharSequence?
            get() = node.text
        override val contentDescription: CharSequence?
            get() = node.contentDescription

        override fun childCount(): Int = node.childCount

        override fun childAt(index: Int): AccessibilityNodeView? {
            val cache = children ?: MutableList<AndroidNodeView?>(node.childCount) { null }
                .also { children = it }
            if (index !in cache.indices) return null
            cache[index]?.let { return it }
            val child = runCatching { node.getChild(index) }.getOrNull() ?: return null
            val wrapper = AndroidNodeView(child)
            cache[index] = wrapper
            return wrapper
        }

        override fun recycle() {
            @Suppress("DEPRECATION")
            runCatching { node.recycle() }
        }
    }
}
