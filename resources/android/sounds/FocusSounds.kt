package `in`.satym.studybuddy.sounds

import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Public API for focus sound playback.
 *
 * This is the interface other code should call. The web app (via a Capacitor plugin)
 * can start, pause, resume, stop, and query status of the focus sound service.
 */
data class FocusSoundStatus(
    val playing: Boolean,
    val paused: Boolean,
    val soundscapeId: String?,
    val volume: Float,
    val endsAtMs: Long?,
    val followFocus: Boolean
)

object FocusSounds {
    /**
     * Start playing a soundscape.
     *
     * @param context Android context
     * @param soundscapeId one of the Soundscape enum IDs (e.g., "white_noise", "rain")
     * @param volume 0.0 to 1.0
     * @param stopAfterMinutes optional auto-stop timer (0 or null = no timer)
     * @param followFocus when true, service auto-stops once there is no active focus session
     */
    fun start(
        context: Context,
        soundscapeId: String,
        volume: Float = 0.7f,
        stopAfterMinutes: Int? = null,
        followFocus: Boolean = false
    ) {
        val preferences = FocusSoundPreferences(context)
        preferences.setCurrentSoundscapeId(soundscapeId)
        preferences.setVolume(volume)
        preferences.setStopAfterMinutes(stopAfterMinutes ?: 0)
        preferences.setFollowFocus(followFocus)
        preferences.setPlaying(true)
        preferences.setPaused(false)

        val endsAtMs = if (stopAfterMinutes != null && stopAfterMinutes > 0) {
            System.currentTimeMillis() + stopAfterMinutes * 60_000L
        } else {
            0L
        }
        preferences.setEndsAtMs(endsAtMs)

        val intent = Intent(context, FocusSoundService::class.java)
        // startForegroundService only exists from API 26; below that a plain
        // startService still allows the service to call startForeground itself.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }

    /**
     * Pause playback (does not stop the service).
     */
    fun pause(context: Context) {
        val preferences = FocusSoundPreferences(context)
        preferences.setPaused(true)

        val intent = Intent(context, FocusSoundService::class.java).apply {
            action = FocusSoundService.ACTION_PAUSE
        }
        context.startService(intent)
    }

    /**
     * Resume playback.
     */
    fun resume(context: Context) {
        val preferences = FocusSoundPreferences(context)
        preferences.setPaused(false)

        val intent = Intent(context, FocusSoundService::class.java).apply {
            action = FocusSoundService.ACTION_RESUME
        }
        context.startService(intent)
    }

    /**
     * Stop playback and destroy the service.
     */
    fun stop(context: Context) {
        val preferences = FocusSoundPreferences(context)
        preferences.setPlaying(false)
        preferences.setPaused(false)

        val intent = Intent(context, FocusSoundService::class.java).apply {
            action = FocusSoundService.ACTION_STOP
        }
        context.startService(intent)
    }

    /**
     * Change volume. Persists the value and, when the service is running, hands it
     * straight to the AudioTrack so the change is audible immediately rather than
     * only on the next start.
     *
     * @param volume 0.0 to 1.0
     */
    fun setVolume(context: Context, volume: Float) {
        val clamped = volume.coerceIn(0f, 1f)
        val preferences = FocusSoundPreferences(context)
        preferences.setVolume(clamped)

        if (!preferences.isPlaying()) return
        val intent = Intent(context, FocusSoundService::class.java).apply {
            action = FocusSoundService.ACTION_SET_VOLUME
            putExtra(FocusSoundService.EXTRA_VOLUME, clamped)
        }
        // A running foreground service accepts startService on every API level.
        runCatching { context.startService(intent) }
    }

    /**
     * Query current playback status.
     */
    fun status(context: Context): FocusSoundStatus {
        val preferences = FocusSoundPreferences(context)
        return FocusSoundStatus(
            playing = preferences.isPlaying(),
            paused = preferences.isPaused(),
            soundscapeId = preferences.currentSoundscapeId(),
            volume = preferences.volume(),
            endsAtMs = preferences.endsAtMs().takeIf { it > 0L },
            followFocus = preferences.followFocus()
        )
    }

    /**
     * Return the catalog of available soundscapes.
     *
     * @return list of (id, label) pairs
     */
    fun catalog(): List<Pair<String, String>> {
        return Soundscape.values().map { it.id to it.label }
    }
}
