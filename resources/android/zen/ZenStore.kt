package `in`.satym.studybuddy.zen

import android.content.Context
import android.content.SharedPreferences

/**
 * Persistent storage for Zen mode configuration.
 *
 * Stores windows as JSON, master enable state, and the interruption filter that
 * was active before Zen mode took control. That original filter is restored when
 * Zen exits, so StudyBuddy never turns DND *off* if the user had it on themselves.
 */
class ZenStore(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("studybuddy_zen", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_WINDOWS = "windows"
        private const val KEY_MASTER_ENABLED = "masterEnabled"
        private const val KEY_ORIGINAL_FILTER = "originalInterruptionFilter"
        private const val KEY_ZEN_OWNS_DND = "zenOwnsDnd"
        private const val KEY_MANUAL_ENDS_AT = "manualEndsAtMs"
        
        /** Default value when no filter has been recorded yet. */
        const val NO_FILTER_RECORDED = -1
    }

    /**
     * Returns the list of configured windows. Empty list if none.
     */
    fun windows(): List<ZenWindow> {
        val json = prefs.getString(KEY_WINDOWS, null) ?: return emptyList()
        return try {
            ZenSchedule.fromJson(json)
        } catch (e: Exception) {
            emptyList()
        }
    }

    /**
     * Replaces the stored windows. Capped at [ZenSchedule.MAX_WINDOWS].
     */
    fun setWindows(windows: List<ZenWindow>) {
        val json = ZenSchedule.toJson(windows)
        prefs.edit().putString(KEY_WINDOWS, json).apply()
    }

    /**
     * Master enable flag. When false, no windows activate even if individually enabled.
     */
    fun masterEnabled(): Boolean = prefs.getBoolean(KEY_MASTER_ENABLED, false)

    /**
     * Sets the master enable flag.
     */
    fun setMasterEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_MASTER_ENABLED, enabled).apply()
    }

    /**
     * The interruption filter (NotificationManager.getCurrentInterruptionFilter value)
     * that was active before Zen mode turned DND on. [NO_FILTER_RECORDED] means no
     * original filter has been stored yet.
     */
    fun originalInterruptionFilter(): Int = prefs.getInt(KEY_ORIGINAL_FILTER, NO_FILTER_RECORDED)

    /**
     * Records the original interruption filter, so it can be restored when Zen exits.
     */
    fun setOriginalInterruptionFilter(filter: Int) {
        prefs.edit().putInt(KEY_ORIGINAL_FILTER, filter).apply()
    }

    /**
     * Whether Zen mode currently owns the DND state. When true, exiting Zen will
     * restore the original filter. When false, the user turned DND on themselves
     * and Zen will not turn it off.
     */
    fun zenOwnsDnd(): Boolean = prefs.getBoolean(KEY_ZEN_OWNS_DND, false)

    /**
     * Records whether Zen mode owns DND.
     */
    fun setZenOwnsDnd(owns: Boolean) {
        prefs.edit().putBoolean(KEY_ZEN_OWNS_DND, owns).apply()
    }

    /**
     * Clears ownership and original filter, used when Zen exits.
     */
    fun clearDndOwnership() {
        prefs.edit()
            .putBoolean(KEY_ZEN_OWNS_DND, false)
            .putInt(KEY_ORIGINAL_FILTER, NO_FILTER_RECORDED)
            .putLong(KEY_MANUAL_ENDS_AT, 0L)
            .apply()
    }

    /**
     * Wall-clock end of a manually started Zen session, or 0 when none is running.
     *
     * Recorded separately from the schedule because the scheduled evaluation in
     * ZenMode.apply would otherwise see "no window is active now" during a manual
     * session and exit it early, silently cutting a session the user asked for.
     */
    fun manualEndsAtMs(): Long = prefs.getLong(KEY_MANUAL_ENDS_AT, 0L)

    fun setManualEndsAtMs(atMs: Long) {
        prefs.edit().putLong(KEY_MANUAL_ENDS_AT, atMs).apply()
    }
}
