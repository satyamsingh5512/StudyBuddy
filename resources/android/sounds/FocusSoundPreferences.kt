package `in`.satym.studybuddy.sounds

import android.content.Context
import android.content.SharedPreferences

/**
 * Persistent storage for focus sound settings.
 *
 * Each package stores its own settings in its own SharedPreferences file to avoid
 * namespace collisions. The web app reads status via the FocusSounds public API.
 */
class FocusSoundPreferences(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences(
        "studybuddy_sounds",
        Context.MODE_PRIVATE
    )

    fun currentSoundscapeId(): String? = prefs.getString(KEY_SOUNDSCAPE_ID, null)
    fun setCurrentSoundscapeId(id: String) = prefs.edit().putString(KEY_SOUNDSCAPE_ID, id).apply()

    fun volume(): Float = prefs.getFloat(KEY_VOLUME, 0.7f)
    fun setVolume(volume: Float) = prefs.edit().putFloat(KEY_VOLUME, volume.coerceIn(0f, 1f)).apply()

    fun stopAfterMinutes(): Int = prefs.getInt(KEY_STOP_AFTER_MINUTES, 0)
    fun setStopAfterMinutes(minutes: Int) = prefs.edit().putInt(KEY_STOP_AFTER_MINUTES, minutes).apply()

    fun followFocus(): Boolean = prefs.getBoolean(KEY_FOLLOW_FOCUS, false)
    fun setFollowFocus(enabled: Boolean) = prefs.edit().putBoolean(KEY_FOLLOW_FOCUS, enabled).apply()

    fun isPlaying(): Boolean = prefs.getBoolean(KEY_IS_PLAYING, false)
    fun setPlaying(playing: Boolean) = prefs.edit().putBoolean(KEY_IS_PLAYING, playing).apply()

    fun isPaused(): Boolean = prefs.getBoolean(KEY_IS_PAUSED, false)
    fun setPaused(paused: Boolean) = prefs.edit().putBoolean(KEY_IS_PAUSED, paused).apply()

    fun endsAtMs(): Long = prefs.getLong(KEY_ENDS_AT_MS, 0L)
    fun setEndsAtMs(ms: Long) = prefs.edit().putLong(KEY_ENDS_AT_MS, ms).apply()

    fun clear() = prefs.edit().clear().apply()

    companion object {
        private const val KEY_SOUNDSCAPE_ID = "soundscape_id"
        private const val KEY_VOLUME = "volume"
        private const val KEY_STOP_AFTER_MINUTES = "stop_after_minutes"
        private const val KEY_FOLLOW_FOCUS = "follow_focus"
        private const val KEY_IS_PLAYING = "is_playing"
        private const val KEY_IS_PAUSED = "is_paused"
        private const val KEY_ENDS_AT_MS = "ends_at_ms"
    }
}
