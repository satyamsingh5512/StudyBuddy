package `in`.satym.studybuddy.shortsblock

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.provider.Settings
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/**
 * Configuration for short-form video blocking and app restrictions during focus.
 *
 * @property youtubeEnabled Block YouTube Shorts detection.
 * @property instagramEnabled Block Instagram Reels/Clips detection.
 * @property facebookEnabled Block Facebook Reels detection.
 * @property snapchatEnabled Block Snapchat Spotlight detection.
 * @property onlyDuringFocus Only block when an active focus session is running.
 * @property dailyAllowanceMinutes Minutes of short-form content allowed before blocking, per day. 0 = no allowance.
 * @property blockedPackages List of package names to block during focus sessions.
 * @property protectSettings If true, prevent disabling accessibility or uninstalling during focus.
 * @property customIdRules Map of package name -> list of view ID substrings that indicate short-form content.
 * @property swipeLimit Daily swipe limit in short-form feeds. 0 = disabled.
 * @property blockInBrowsers Block short-form URLs in supported browsers.
 * @property blockTikTok Block TikTok entirely (whole-app block).
 */
data class ShortsBlockConfig(
    val youtubeEnabled: Boolean = true,
    val instagramEnabled: Boolean = true,
    val facebookEnabled: Boolean = false,
    val snapchatEnabled: Boolean = false,
    val onlyDuringFocus: Boolean = false,
    val dailyAllowanceMinutes: Int = 0,
    val blockedPackages: List<String> = emptyList(),
    val protectSettings: Boolean = false,
    val customIdRules: Map<String, List<String>> = emptyMap(),
    val swipeLimit: Int = 0,
    val blockInBrowsers: Boolean = true,
    val blockTikTok: Boolean = false
)

/**
 * Public API for the shorts blocking feature.
 *
 * All settings are opt-in and stored locally. The AccessibilityService must be
 * explicitly enabled by the user in Android settings; this object merely records
 * the user's preferences for what happens once the service runs.
 */
object ShortsBlock {
    private const val PREFS_NAME = "studybuddy_shortsblock"
    private const val KEY_YOUTUBE_ENABLED = "youtube_enabled"
    private const val KEY_INSTAGRAM_ENABLED = "instagram_enabled"
    private const val KEY_FACEBOOK_ENABLED = "facebook_enabled"
    private const val KEY_SNAPCHAT_ENABLED = "snapchat_enabled"
    private const val KEY_ONLY_DURING_FOCUS = "only_during_focus"
    private const val KEY_DAILY_ALLOWANCE = "daily_allowance_minutes"
    private const val KEY_BLOCKED_PACKAGES = "blocked_packages"
    private const val KEY_PROTECT_SETTINGS = "protect_settings"
    private const val KEY_CUSTOM_RULES = "custom_id_rules"
    private const val KEY_STATS_DATE = "stats_date"
    private const val KEY_STATS_BLOCKED_COUNT = "stats_blocked_count"
    private const val KEY_STATS_SHORTS_SECONDS = "stats_shorts_seconds"
    private const val KEY_STATS_BROWSER_BLOCKS = "stats_browser_blocks"
    private const val KEY_SWIPE_LIMIT = "swipe_limit"
    private const val KEY_BLOCK_IN_BROWSERS = "block_in_browsers"
    private const val KEY_BLOCK_TIKTOK = "block_tiktok"
    private const val KEY_APP_RULES = "app_rules"

    /**
     * Read the current configuration.
     */
    fun config(context: Context): ShortsBlockConfig {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val customRulesJson = prefs.getString(KEY_CUSTOM_RULES, null)
        val customRules = if (customRulesJson != null) {
            parseCustomRules(customRulesJson)
        } else {
            emptyMap()
        }
        val blockedJson = prefs.getString(KEY_BLOCKED_PACKAGES, null)
        val blocked = if (blockedJson != null) {
            parseStringArray(blockedJson)
        } else {
            emptyList()
        }
        return ShortsBlockConfig(
            youtubeEnabled = prefs.getBoolean(KEY_YOUTUBE_ENABLED, true),
            instagramEnabled = prefs.getBoolean(KEY_INSTAGRAM_ENABLED, true),
            facebookEnabled = prefs.getBoolean(KEY_FACEBOOK_ENABLED, false),
            snapchatEnabled = prefs.getBoolean(KEY_SNAPCHAT_ENABLED, false),
            onlyDuringFocus = prefs.getBoolean(KEY_ONLY_DURING_FOCUS, false),
            dailyAllowanceMinutes = prefs.getInt(KEY_DAILY_ALLOWANCE, 0),
            blockedPackages = blocked,
            protectSettings = prefs.getBoolean(KEY_PROTECT_SETTINGS, false),
            customIdRules = customRules,
            swipeLimit = prefs.getInt(KEY_SWIPE_LIMIT, 0),
            blockInBrowsers = prefs.getBoolean(KEY_BLOCK_IN_BROWSERS, true),
            blockTikTok = prefs.getBoolean(KEY_BLOCK_TIKTOK, false)
        )
    }

    /**
     * Update the configuration.
     */
    fun setConfig(context: Context, config: ShortsBlockConfig) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().apply {
            putBoolean(KEY_YOUTUBE_ENABLED, config.youtubeEnabled)
            putBoolean(KEY_INSTAGRAM_ENABLED, config.instagramEnabled)
            putBoolean(KEY_FACEBOOK_ENABLED, config.facebookEnabled)
            putBoolean(KEY_SNAPCHAT_ENABLED, config.snapchatEnabled)
            putBoolean(KEY_ONLY_DURING_FOCUS, config.onlyDuringFocus)
            putInt(KEY_DAILY_ALLOWANCE, config.dailyAllowanceMinutes)
            putString(KEY_BLOCKED_PACKAGES, serializeStringArray(config.blockedPackages))
            putBoolean(KEY_PROTECT_SETTINGS, config.protectSettings)
            putString(KEY_CUSTOM_RULES, serializeCustomRules(config.customIdRules))
            putInt(KEY_SWIPE_LIMIT, config.swipeLimit)
            putBoolean(KEY_BLOCK_IN_BROWSERS, config.blockInBrowsers)
            putBoolean(KEY_BLOCK_TIKTOK, config.blockTikTok)
            apply()
        }
    }

    /**
     * Check if the accessibility service is currently enabled.
     *
     * The secure setting is a colon-separated list of flattened component names.
     * Most builds store the fully qualified form, but the short form (`pkg/.Class`)
     * also occurs, so both are accepted.
     */
    fun isServiceEnabled(context: Context): Boolean {
        val className = StudyGuardAccessibilityService::class.java.name
        val full = "${context.packageName}/$className"
        val short = "${context.packageName}/${className.removePrefix(context.packageName)}"
        val enabledServices = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        return enabledServices.split(':').any {
            it.trim().equals(full, ignoreCase = true) || it.trim().equals(short, ignoreCase = true)
        }
    }

    /**
     * Intent to open Android accessibility settings.
     */
    fun accessibilitySettingsIntent(): Intent =
        Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }

    /**
     * Get the list of app-specific usage rules.
     */
    fun appRules(context: Context): List<AppRule> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = prefs.getString(KEY_APP_RULES, null) ?: return emptyList()
        return try {
            val array = JSONArray(json)
            (0 until array.length()).map { AppRule.fromJson(array.getJSONObject(it)) }
        } catch (e: Exception) {
            emptyList()
        }
    }

    /**
     * Set the list of app-specific usage rules. Max 50 rules.
     */
    fun setAppRules(context: Context, rules: List<AppRule>) {
        require(rules.size <= 50) { "Maximum 50 app rules allowed" }
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val array = JSONArray()
        rules.forEach { array.put(it.toJson()) }
        prefs.edit().putString(KEY_APP_RULES, array.toString()).apply()
    }

    /**
     * Get today's foreground usage in seconds for all tracked apps.
     */
    fun usageTodaySeconds(context: Context): Map<String, Long> =
        AppUsageTracker.allTodaySeconds(context)

    /**
     * Request that strict mode be disabled.
     *
     * If strictAlways is true, the request is recorded with a cool-off timestamp
     * and the mode remains active until the cool-off expires.
     *
     * @param isFocusActive Whether a focus session is running, used only to report
     *   whether protection is still in effect in the returned status.
     * @return The updated strict mode status map.
     */
    fun requestStrictDisable(context: Context, isFocusActive: Boolean = false): Map<String, Any?> {
        StrictGuard.requestDisable(context)
        return StrictGuard.statusMap(context, isFocusActive)
    }

    /**
     * Current strict mode settings, for callers that need the raw values rather
     * than the bridge-shaped status map.
     */
    fun strictSettings(context: Context): StrictModeSettings = StrictGuard.settings(context)

    /**
     * Apply a strict mode change requested by the user.
     *
     * This is the only write path the WebView reaches, and it deliberately refuses to
     * lower a protection directly:
     *
     * - Switching strict mode **off** never writes `strictMode = false` while it is on. It
     *   always goes through [requestStrictDisable], so a cool-off applies whenever one is
     *   owed. The other two fields in the same call are ignored, because honouring them
     *   would let a single request shorten the cool-off it is trying to escape.
     * - While strict mode is on **and** always-on, `strictAlways` cannot be cleared and
     *   the cool-off cannot be shortened. Both would otherwise be a way to reach an
     *   immediate disable without waiting. Raising either is allowed at any time.
     *
     * When strict mode is already off there is nothing in force to escape, so the two
     * remaining fields are simply recorded for next time.
     *
     * Enabling strict mode clears any pending disable: the user has changed their mind.
     *
     * @return The updated strict mode status map.
     */
    fun applyStrictSettings(
        context: Context,
        strictMode: Boolean,
        strictAlways: Boolean,
        strictCooloffMinutes: Int,
        isFocusActive: Boolean = false
    ): Map<String, Any?> {
        require(strictCooloffMinutes in 0..120) { "strictCooloffMinutes must be 0..120" }
        val current = StrictGuard.settings(context)

        if (!strictMode) {
            if (!current.strictMode) {
                StrictGuard.setSettings(
                    context,
                    StrictModeSettings(
                        strictMode = false,
                        strictAlways = strictAlways,
                        strictCooloffMinutes = strictCooloffMinutes,
                        pendingDisableAtMs = null
                    )
                )
                return StrictGuard.statusMap(context, isFocusActive)
            }
            return requestStrictDisable(context, isFocusActive)
        }

        val lockedDown = current.strictMode && current.strictAlways
        StrictGuard.setSettings(
            context,
            StrictModeSettings(
                strictMode = true,
                strictAlways = if (lockedDown) true else strictAlways,
                strictCooloffMinutes = if (lockedDown) {
                    maxOf(strictCooloffMinutes, current.strictCooloffMinutes)
                } else {
                    strictCooloffMinutes
                },
                pendingDisableAtMs = null
            )
        )
        return StrictGuard.statusMap(context, isFocusActive)
    }

    /**
     * Get the current strict mode status.
     *
     * @param isFocusActive Whether an active focus session exists (must be passed from caller).
     * @return Map with keys: active, strictMode, strictAlways, cooloffMinutes, pendingUntilMs
     */
    fun strictStatus(context: Context, isFocusActive: Boolean): Map<String, Any?> =
        StrictGuard.statusMap(context, isFocusActive)

    /**
     * Extended stats including reels swiped and browser blocks.
     *
     * @return Map with keys: blockedToday, shortsSecondsToday, reelsSwiped, browserBlocks
     */
    fun todayStatsExtended(context: Context): Map<String, Any> {
        val (blocked, seconds) = todayStats(context)
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val today = todayKey()
        val recorded = prefs.getString(KEY_STATS_DATE, null)
        val browserBlocks = if (recorded == today) {
            prefs.getInt(KEY_STATS_BROWSER_BLOCKS, 0)
        } else {
            0
        }
        return mapOf(
            "blockedToday" to blocked,
            "shortsSecondsToday" to seconds,
            "reelsSwiped" to ReelSwipeLimiter.todayCount(context),
            "browserBlocks" to browserBlocks
        )
    }

    /**
     * Record a browser short-form block today.
     */
    internal fun recordBrowserBlock(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        rollDayIfNeeded(prefs)
        val count = prefs.getInt(KEY_STATS_BROWSER_BLOCKS, 0)
        prefs.edit().putInt(KEY_STATS_BROWSER_BLOCKS, count + 1).apply()
    }

    /**
     * Move the counters on to today if the stored date has changed.
     *
     * Every day-scoped counter in this file sits behind one shared date stamp, so
     * whichever counter is written first on a new day has to clear the others. Without
     * that, yesterday's figures stay readable under today's date: the blocked count and
     * browser-block count would be reported as today's, and — worse — a stale seconds
     * total would make [allowanceExhausted] true before the user had watched anything,
     * silently voiding a configured daily allowance every morning.
     *
     * Reads deliberately do not roll the day; they already return zero when the stored
     * date is not today, and a read should not write.
     */
    private fun rollDayIfNeeded(prefs: SharedPreferences) {
        val today = todayKey()
        if (prefs.getString(KEY_STATS_DATE, null) == today) return
        prefs.edit()
            .putString(KEY_STATS_DATE, today)
            .putInt(KEY_STATS_BLOCKED_COUNT, 0)
            .putLong(KEY_STATS_SHORTS_SECONDS, 0L)
            .putInt(KEY_STATS_BROWSER_BLOCKS, 0)
            .apply()
    }

    /**
     * Today's blocking stats: (blocked shorts/reels count, total shorts viewing seconds).
     */
    fun todayStats(context: Context): Pair<Int, Long> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val today = todayKey()
        val recorded = prefs.getString(KEY_STATS_DATE, null)
        if (recorded != today) {
            return Pair(0, 0L)
        }
        val blocked = prefs.getInt(KEY_STATS_BLOCKED_COUNT, 0)
        val seconds = prefs.getLong(KEY_STATS_SHORTS_SECONDS, 0L)
        return Pair(blocked, seconds)
    }

    /**
     * Record that a shorts/reels block occurred today.
     */
    internal fun recordBlock(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        rollDayIfNeeded(prefs)
        val count = prefs.getInt(KEY_STATS_BLOCKED_COUNT, 0)
        prefs.edit().putInt(KEY_STATS_BLOCKED_COUNT, count + 1).apply()
    }

    /**
     * Add seconds of shorts viewing to today's total.
     */
    internal fun addShortsSeconds(context: Context, seconds: Long) {
        if (seconds <= 0) return
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        rollDayIfNeeded(prefs)
        val current = prefs.getLong(KEY_STATS_SHORTS_SECONDS, 0L)
        prefs.edit().putLong(KEY_STATS_SHORTS_SECONDS, current + seconds).apply()
    }

    /**
     * Check if the daily allowance (if any) has been exhausted.
     */
    internal fun allowanceExhausted(context: Context, config: ShortsBlockConfig): Boolean {
        if (config.dailyAllowanceMinutes <= 0) return false
        val (_, seconds) = todayStats(context)
        return seconds >= config.dailyAllowanceMinutes * 60L
    }

    private fun todayKey(): String {
        val calendar = Calendar.getInstance()
        return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(calendar.time)
    }

    private fun parseStringArray(json: String): List<String> {
        val array = JSONArray(json)
        return List(array.length()) { i -> array.getString(i) }
    }

    private fun serializeStringArray(list: List<String>): String {
        val array = JSONArray()
        list.forEach { array.put(it) }
        return array.toString()
    }

    private fun parseCustomRules(json: String): Map<String, List<String>> {
        val obj = JSONObject(json)
        val map = mutableMapOf<String, List<String>>()
        obj.keys().forEach { pkg ->
            val rules = obj.getJSONArray(pkg)
            map[pkg] = List(rules.length()) { i -> rules.getString(i) }
        }
        return map
    }

    private fun serializeCustomRules(map: Map<String, List<String>>): String {
        val obj = JSONObject()
        map.forEach { (pkg, rules) ->
            val array = JSONArray()
            rules.forEach { array.put(it) }
            obj.put(pkg, array)
        }
        return obj.toString()
    }
}
