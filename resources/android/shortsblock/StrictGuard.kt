package `in`.satym.studybuddy.shortsblock

import android.content.Context

/**
 * Strict anti-tamper mode settings and logic.
 *
 * Why this exists:
 * The existing protect-settings feature backs the user out of the system accessibility
 * settings screen during focus to prevent accidentally or impulsively disabling the
 * service. Strict mode extends this to also guard against force-stopping, uninstalling,
 * or clearing StudyBuddy's data while a focus session is active or when strictAlways
 * is enabled.
 *
 * Cool-off period:
 * Strict mode can trap the user if implemented naively. To prevent permanent lock-out,
 * turning strict mode *off* does not take effect immediately when strictAlways is true.
 * Instead, the request is recorded with a timestamp, and the mode remains active until
 * the cool-off period expires. The default cool-off is 10 minutes (configurable, 0..120).
 * During the cool-off, the user can still cancel the pending disable.
 *
 * A cool-off is NOT required when strictMode is true but strictAlways is false, because
 * in that case strict protection only applies during an active focus session. Ending
 * the focus session immediately disengages strict mode, and ending focus is already a
 * deliberate multi-step action. The cool-off exists solely to protect against impulsive
 * disabling when strictAlways = true.
 *
 * Privacy:
 * Strict mode only inspects Settings app screens and package installer dialogs. No
 * screen content is logged or transmitted; only the fact that a risky screen was
 * detected and backed out of is recorded locally.
 */
data class StrictModeSettings(
    val strictMode: Boolean,
    val strictAlways: Boolean,
    val strictCooloffMinutes: Int,
    val pendingDisableAtMs: Long?
) {
    init {
        require(strictCooloffMinutes in 0..120) { "strictCooloffMinutes must be 0..120" }
    }
}

/**
 * Strict mode persistence and status queries.
 */
object StrictGuard {
    private const val PREFS_NAME = "studybuddy_shortsblock_strict"
    private const val KEY_STRICT_MODE = "strict_mode"
    private const val KEY_STRICT_ALWAYS = "strict_always"
    private const val KEY_COOLOFF_MINUTES = "cooloff_minutes"
    private const val KEY_PENDING_DISABLE_AT_MS = "pending_disable_at_ms"

    /**
     * Read the current strict mode settings.
     *
     * The stored cool-off is coerced rather than trusted. [StrictModeSettings] rejects
     * an out-of-range value in its initialiser, and this is read from the accessibility
     * service on a blocking decision path, so a preferences file left behind by an
     * older or interrupted write must not be able to throw there.
     */
    fun settings(context: Context): StrictModeSettings {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return StrictModeSettings(
            strictMode = prefs.getBoolean(KEY_STRICT_MODE, false),
            strictAlways = prefs.getBoolean(KEY_STRICT_ALWAYS, false),
            strictCooloffMinutes = prefs.getInt(KEY_COOLOFF_MINUTES, 10).coerceIn(0, 120),
            pendingDisableAtMs = if (prefs.contains(KEY_PENDING_DISABLE_AT_MS)) {
                prefs.getLong(KEY_PENDING_DISABLE_AT_MS, 0L)
            } else null
        )
    }

    /**
     * Update strict mode settings.
     *
     * When strictMode is set to false and strictAlways is true, the disable is not
     * applied immediately. Instead, pendingDisableAtMs is set to now + cooloff, and
     * the mode remains active until that time.
     */
    fun setSettings(context: Context, settings: StrictModeSettings) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().apply {
            putBoolean(KEY_STRICT_MODE, settings.strictMode)
            putBoolean(KEY_STRICT_ALWAYS, settings.strictAlways)
            putInt(KEY_COOLOFF_MINUTES, settings.strictCooloffMinutes)
            if (settings.pendingDisableAtMs != null) {
                putLong(KEY_PENDING_DISABLE_AT_MS, settings.pendingDisableAtMs)
            } else {
                remove(KEY_PENDING_DISABLE_AT_MS)
            }
            apply()
        }
    }

    /**
     * Request that strict mode be disabled.
     *
     * If strictAlways is true, the request is recorded with a timestamp and the mode
     * remains active until the cool-off expires. If strictAlways is false, the mode
     * is disabled immediately.
     *
     * An already-running cool-off is kept rather than restarted. Asking a second time
     * must not push the deadline further away: the UI shows a countdown, and a repeated
     * tap (or a re-sent call) would otherwise silently reset it and make the wait
     * unbounded in practice.
     *
     * @return The updated settings.
     */
    fun requestDisable(context: Context): StrictModeSettings {
        val current = settings(context)
        val nowMs = System.currentTimeMillis()

        return if (current.strictAlways) {
            // Strict always enabled: require cool-off
            val existing = current.pendingDisableAtMs
            val pendingAt = if (existing != null && existing > nowMs) {
                existing
            } else {
                nowMs + current.strictCooloffMinutes * 60_000L
            }
            val updated = current.copy(pendingDisableAtMs = pendingAt)
            setSettings(context, updated)
            updated
        } else {
            // Strict only during focus: disable immediately
            val updated = current.copy(strictMode = false, pendingDisableAtMs = null)
            setSettings(context, updated)
            updated
        }
    }

    /**
     * Cancel a pending disable request.
     */
    fun cancelPendingDisable(context: Context): StrictModeSettings {
        val current = settings(context)
        val updated = current.copy(pendingDisableAtMs = null)
        setSettings(context, updated)
        return updated
    }

    /**
     * Check if strict protection is currently active.
     *
     * @param isFocusActive Whether an active focus session exists.
     * @return True if protection should be enforced.
     */
    fun isActive(context: Context, isFocusActive: Boolean): Boolean {
        val settings = settings(context)
        if (!settings.strictMode) return false

        // Check if a pending disable has expired
        val pending = settings.pendingDisableAtMs
        if (pending != null && System.currentTimeMillis() >= pending) {
            // Cool-off expired: disable strict mode
            setSettings(context, settings.copy(strictMode = false, pendingDisableAtMs = null))
            return false
        }

        // Strict mode is on and not expired: check activation conditions
        return settings.strictAlways || isFocusActive
    }

    /**
     * Strict status summary for the WebView bridge.
     *
     * [isActive] is evaluated first and the settings are re-read afterwards, because
     * that call is what expires a cool-off: reading the settings first would report
     * `strictMode = true` alongside a `pendingUntilMs` already in the past, and the UI
     * applies this payload directly, so it would show the toggle still on with a
     * countdown stuck at zero.
     *
     * @return Map with keys: active, strictMode, strictAlways, cooloffMinutes, pendingUntilMs
     */
    fun statusMap(context: Context, isFocusActive: Boolean): Map<String, Any?> {
        val active = isActive(context, isFocusActive)
        val settings = settings(context)
        return mapOf(
            "active" to active,
            "strictMode" to settings.strictMode,
            "strictAlways" to settings.strictAlways,
            "cooloffMinutes" to settings.strictCooloffMinutes,
            "pendingUntilMs" to settings.pendingDisableAtMs
        )
    }
}

/**
 * Detection rules for risky settings screens and uninstall dialogs.
 *
 * All scans are bounded to prevent hanging on complex layouts.
 */
object StrictProtectionRules {
    private const val MAX_SCAN_NODES = 200

    /**
     * Check if the current screen is StudyBuddy's App Info page with dangerous actions.
     *
     * Detects: "StudyBuddy" + any of "Force stop", "Uninstall", "Clear storage", "Disable"
     */
    fun isStudyBuddyAppInfo(root: AccessibilityNodeView): Boolean {
        var hasStudyBuddy = false
        var hasDangerousAction = false

        val queue = ArrayDeque<AccessibilityNodeView>()
        queue.add(root)
        var scanned = 0

        while (queue.isNotEmpty() && scanned < MAX_SCAN_NODES) {
            val node = queue.removeFirst()
            scanned += 1

            val text = node.text?.toString()?.lowercase() ?: ""
            val desc = node.contentDescription?.toString()?.lowercase() ?: ""
            val combined = text + " " + desc

            if (combined.contains("studybuddy")) hasStudyBuddy = true
            if (combined.contains("force stop") ||
                combined.contains("uninstall") ||
                combined.contains("clear storage") ||
                combined.contains("disable")
            ) {
                hasDangerousAction = true
            }

            if (hasStudyBuddy && hasDangerousAction) return true

            for (i in 0 until node.childCount()) {
                val child = node.childAt(i)
                if (child != null) queue.add(child)
            }
        }

        return false
    }

    /**
     * Check if the current screen is the Accessibility settings page for StudyGuard.
     *
     * Detects: "StudyGuard" or "studybuddy" + "accessibility" or "services"
     */
    fun isStudyGuardAccessibilitySettings(root: AccessibilityNodeView): Boolean {
        var hasService = false
        var hasAccessibility = false

        val queue = ArrayDeque<AccessibilityNodeView>()
        queue.add(root)
        var scanned = 0

        while (queue.isNotEmpty() && scanned < MAX_SCAN_NODES) {
            val node = queue.removeFirst()
            scanned += 1

            val text = node.text?.toString()?.lowercase() ?: ""
            val desc = node.contentDescription?.toString()?.lowercase() ?: ""
            val combined = text + " " + desc

            if (combined.contains("studyguard") || combined.contains("studybuddy")) {
                hasService = true
            }
            if (combined.contains("accessibility") || combined.contains("services")) {
                hasAccessibility = true
            }

            if (hasService && hasAccessibility) return true

            for (i in 0 until node.childCount()) {
                val child = node.childAt(i)
                if (child != null) queue.add(child)
            }
        }

        return false
    }

    /**
     * Check if the current screen is a Device Admin deactivation screen for StudyBuddy.
     *
     * Detects: "StudyBuddy" + "deactivate" or "device administrator"
     */
    fun isDeviceAdminDeactivation(root: AccessibilityNodeView): Boolean {
        var hasStudyBuddy = false
        var hasDeactivate = false

        val queue = ArrayDeque<AccessibilityNodeView>()
        queue.add(root)
        var scanned = 0

        while (queue.isNotEmpty() && scanned < MAX_SCAN_NODES) {
            val node = queue.removeFirst()
            scanned += 1

            val text = node.text?.toString()?.lowercase() ?: ""
            val desc = node.contentDescription?.toString()?.lowercase() ?: ""
            val combined = text + " " + desc

            if (combined.contains("studybuddy")) hasStudyBuddy = true
            if (combined.contains("deactivate") || combined.contains("device administrator")) {
                hasDeactivate = true
            }

            if (hasStudyBuddy && hasDeactivate) return true

            for (i in 0 until node.childCount()) {
                val child = node.childAt(i)
                if (child != null) queue.add(child)
            }
        }

        return false
    }

    /**
     * Check if the current screen is a package installer uninstall dialog for StudyBuddy.
     *
     * Detects: "StudyBuddy" + "uninstall" in package installer packages.
     */
    fun isUninstallDialog(root: AccessibilityNodeView): Boolean {
        var hasStudyBuddy = false
        var hasUninstall = false

        val queue = ArrayDeque<AccessibilityNodeView>()
        queue.add(root)
        var scanned = 0

        while (queue.isNotEmpty() && scanned < MAX_SCAN_NODES) {
            val node = queue.removeFirst()
            scanned += 1

            val text = node.text?.toString()?.lowercase() ?: ""
            val desc = node.contentDescription?.toString()?.lowercase() ?: ""
            val combined = text + " " + desc

            if (combined.contains("studybuddy")) hasStudyBuddy = true
            if (combined.contains("uninstall")) hasUninstall = true

            if (hasStudyBuddy && hasUninstall) return true

            for (i in 0 until node.childCount()) {
                val child = node.childAt(i)
                if (child != null) queue.add(child)
            }
        }

        return false
    }
}
