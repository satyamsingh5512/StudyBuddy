package `in`.satym.studybuddy.sounds

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import `in`.satym.studybuddy.MainActivity
import `in`.satym.studybuddy.R
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplineDatabase
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplinePreferences
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

/**
 * Procedural focus sound playback service.
 *
 * WHY: background focus sounds are a standard study-app capability, but shipping
 * audio assets adds APK weight and licensing questions. StudyBuddy synthesizes the
 * audio procedurally instead — no asset files, full control over the waveform, and
 * the feature stays self-contained.
 *
 * The service:
 *  - Holds a foreground notification with Pause/Resume/Stop actions.
 *  - Handles audio focus properly: pauses on transient loss, stops on permanent
 *    loss, ducks volume when another app requests can-duck.
 *  - Supports an optional auto-stop timer (e.g., "play for 25 minutes").
 *  - Supports `followFocus`: when enabled, the service polls every 30s and stops
 *    itself once there is no active focus session, so the sound never continues
 *    after the user has stopped focusing.
 */
class FocusSoundService : Service() {
    companion object {
        const val ACTION_PAUSE = "in.satym.studybuddy.sounds.PAUSE"
        const val ACTION_RESUME = "in.satym.studybuddy.sounds.RESUME"
        const val ACTION_STOP = "in.satym.studybuddy.sounds.STOP"
        const val ACTION_SET_VOLUME = "in.satym.studybuddy.sounds.SET_VOLUME"
        const val EXTRA_VOLUME = "volume"

        private const val CHANNEL_ID = "studybuddy_focus_sounds"
        private const val NOTIFICATION_ID = 9316

        private const val SAMPLE_RATE = 44100
        private const val CHANNELS = 2 // stereo
        private const val BUFFER_SIZE_FRAMES = 2048

        /** How often followFocus re-checks whether a focus session is still running. */
        private const val FOLLOW_FOCUS_INTERVAL_MS = 30_000L
    }

    private lateinit var audioManager: AudioManager
    private lateinit var preferences: FocusSoundPreferences
    private lateinit var handler: Handler

    private var audioTrack: AudioTrack? = null
    private var generator: SoundscapeGenerator? = null
    private var playbackThread: Thread? = null
    private val playing = AtomicBoolean(false)
    private val paused = AtomicBoolean(false)

    private var audioFocusRequest: AudioFocusRequest? = null
    private var currentVolume: Float = 1.0f
    private var ducked = false

    private val focusChangeListener = AudioManager.OnAudioFocusChangeListener { focusChange ->
        when (focusChange) {
            AudioManager.AUDIOFOCUS_LOSS -> {
                // Permanent loss: stop service
                stopSelf()
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                // Temporary loss: pause
                pausePlayback()
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                // Duck volume to 30%
                ducked = true
                applyVolume()
            }
            AudioManager.AUDIOFOCUS_GAIN -> {
                // Regained focus: restore volume and resume if we were playing
                ducked = false
                applyVolume()
                if (!paused.get()) {
                    resumePlayback()
                }
            }
        }
    }

    private val autoStop = Runnable { stopSelf() }

    private val followFocusCheck = object : Runnable {
        override fun run() {
            if (preferences.followFocus()) {
                thread(start = true) {
                    val userId = DigitalDisciplinePreferences(applicationContext).userId()
                    if (userId != null) {
                        val dao = DigitalDisciplineDatabase.get(applicationContext).dao()
                        val session = dao.activeFocus(userId)
                        if (session == null || session.state != "ACTIVE") {
                            // No active focus session: stop service
                            stopSelf()
                        }
                    }
                }
            }
            handler.postDelayed(this, FOLLOW_FOCUS_INTERVAL_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        preferences = FocusSoundPreferences(applicationContext)
        handler = Handler(Looper.getMainLooper())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        // Control actions are only meaningful for a service that is already playing.
        // If the process was killed and one arrives afterwards, startService would
        // create a fresh instance that never calls startForeground — which Android
        // kills with a crash on API 26+. Stopping immediately is the correct answer.
        if (action != null && action != ACTION_STOP && !playing.get()) {
            stopSelf()
            return START_NOT_STICKY
        }

        when (action) {
            ACTION_PAUSE -> {
                pausePlayback()
                updateNotification()
                return START_STICKY
            }
            ACTION_RESUME -> {
                resumePlayback()
                updateNotification()
                return START_STICKY
            }
            ACTION_STOP -> {
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_SET_VOLUME -> {
                // Fall back to the persisted value if the extra is missing, so a
                // malformed intent can never silence a running session.
                val stored = preferences.volume()
                setVolume(intent?.getFloatExtra(EXTRA_VOLUME, stored) ?: stored)
                return START_STICKY
            }
        }

        // An intent with no action means "play with the current preferences". When a
        // session is already running this is a soundscape or volume change, so the
        // generator is rebuilt rather than the request being dropped — audio focus is
        // already held, so it does not need to be requested again.
        if (playing.get()) {
            stopPlayback()
            startPlayback()
            updateNotification()
            return START_STICKY
        }

        // First start: request audio focus and begin playback
        if (!requestAudioFocus()) {
            stopSelf()
            return START_NOT_STICKY
        }

        createNotificationChannel()
        val notification = buildNotification(paused = false)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        startPlayback()
        // Delayed, not immediate. The first check must not run now: a user who starts
        // the soundscape and *then* starts their focus session would otherwise have the
        // service stop itself before the session existed. One interval of grace is
        // enough, and the poll is idempotent afterwards.
        handler.postDelayed(followFocusCheck, FOLLOW_FOCUS_INTERVAL_MS)

        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(followFocusCheck)
        handler.removeCallbacks(autoStop)
        stopPlayback()
        abandonAudioFocus()
        // The service can also die from audio-focus loss or the auto-stop timer, not
        // just an explicit stop() call. Clearing the flags here keeps FocusSounds.status()
        // from reporting playback that is no longer happening.
        preferences.setPlaying(false)
        preferences.setPaused(false)
        preferences.setEndsAtMs(0L)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.studybuddy_sounds_channel_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = getString(R.string.studybuddy_sounds_channel_description)
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            val nm = getSystemService(NotificationManager::class.java)
            nm?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(paused: Boolean): Notification {
        val openAppIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val pauseResumeIntent = PendingIntent.getService(
            this,
            1,
            Intent(this, FocusSoundService::class.java).apply {
                action = if (paused) ACTION_RESUME else ACTION_PAUSE
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val stopIntent = PendingIntent.getService(
            this,
            2,
            Intent(this, FocusSoundService::class.java).apply { action = ACTION_STOP },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val soundscapeId = preferences.currentSoundscapeId() ?: "focus_hum"
        val soundscape = Soundscape.fromId(soundscapeId) ?: Soundscape.FOCUS_HUM
        val title = soundscape.label

        val pauseResumeText = if (paused) {
            getString(R.string.studybuddy_sounds_action_resume)
        } else {
            getString(R.string.studybuddy_sounds_action_pause)
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(getString(R.string.studybuddy_sounds_notification_text))
            .setSmallIcon(R.drawable.ic_stat_studybuddy)
            .setContentIntent(openAppIntent)
            .setOngoing(true)
            .addAction(0, pauseResumeText, pauseResumeIntent)
            .addAction(0, getString(R.string.studybuddy_sounds_action_stop), stopIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun updateNotification() {
        val nm = getSystemService(NotificationManager::class.java)
        nm?.notify(NOTIFICATION_ID, buildNotification(paused = paused.get()))
    }

    private fun requestAudioFocus(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build()
                )
                .setOnAudioFocusChangeListener(focusChangeListener, handler)
                .build()
            audioFocusRequest = request
            audioManager.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        } else {
            @Suppress("DEPRECATION")
            audioManager.requestAudioFocus(
                focusChangeListener,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN
            ) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        }
    }

    private fun abandonAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
        } else {
            @Suppress("DEPRECATION")
            audioManager.abandonAudioFocus(focusChangeListener)
        }
    }

    private fun startPlayback() {
        if (playing.get()) return

        val soundscapeId = preferences.currentSoundscapeId() ?: "focus_hum"
        val soundscape = Soundscape.fromId(soundscapeId) ?: Soundscape.FOCUS_HUM
        currentVolume = preferences.volume()

        val bufferSize = AudioTrack.getMinBufferSize(
            SAMPLE_RATE,
            if (CHANNELS == 2) AudioFormat.CHANNEL_OUT_STEREO else AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        ).coerceAtLeast(BUFFER_SIZE_FRAMES * CHANNELS * 2)

        audioTrack = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build()
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setSampleRate(SAMPLE_RATE)
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setChannelMask(if (CHANNELS == 2) AudioFormat.CHANNEL_OUT_STEREO else AudioFormat.CHANNEL_OUT_MONO)
                        .build()
                )
                .setBufferSizeInBytes(bufferSize)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build()
        } else {
            @Suppress("DEPRECATION")
            AudioTrack(
                AudioManager.STREAM_MUSIC,
                SAMPLE_RATE,
                if (CHANNELS == 2) AudioFormat.CHANNEL_OUT_STEREO else AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize,
                AudioTrack.MODE_STREAM
            )
        }

        generator = SoundscapeGenerator(soundscape, SAMPLE_RATE, CHANNELS)
        applyVolume()

        playing.set(true)
        paused.set(false)
        audioTrack?.play()

        playbackThread = thread(start = true) {
            val buffer = ShortArray(BUFFER_SIZE_FRAMES * CHANNELS)
            var firstBuffer = true

            // The track is captured locally so stopPlayback nulling the field cannot
            // turn into a mid-write NPE, and the whole loop is guarded because an
            // interrupt during Thread.sleep or a released track are both normal
            // shutdown outcomes rather than faults worth crashing the service for.
            val track = audioTrack
            try {
                while (playing.get() && track != null) {
                    if (paused.get()) {
                        Thread.sleep(100)
                        continue
                    }

                    generator?.fillBuffer(buffer, applyFadeIn = firstBuffer, applyFadeOut = false)
                    firstBuffer = false

                    track.write(buffer, 0, buffer.size)
                }
            } catch (_: InterruptedException) {
                // Expected: stopPlayback interrupts a sleeping thread.
            } catch (_: IllegalStateException) {
                // Expected: the track was released while a write was in flight.
            }
        }

        // Auto-stop timer. Held as a field so a restart replaces the pending stop
        // instead of stacking a second one that would cut the new session short.
        handler.removeCallbacks(autoStop)
        val stopAfterMinutes = preferences.stopAfterMinutes()
        if (stopAfterMinutes > 0) {
            handler.postDelayed(autoStop, stopAfterMinutes * 60_000L)
        }
    }

    private fun pausePlayback() {
        paused.set(true)
        audioTrack?.pause()
    }

    private fun resumePlayback() {
        paused.set(false)
        audioTrack?.play()
    }

    private fun stopPlayback() {
        playing.set(false)
        paused.set(false)
        playbackThread?.interrupt()
        // Waiting for the writer to finish before releasing the track. A blocking
        // write can outlast this, which is why the loop above swallows the resulting
        // IllegalStateException rather than taking the service down.
        playbackThread?.join(1000)
        playbackThread = null
        val track = audioTrack
        audioTrack = null
        runCatching { track?.stop() }
        runCatching { track?.release() }
        generator = null
    }

    private fun applyVolume() {
        val effectiveVolume = if (ducked) currentVolume * 0.3f else currentVolume
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            audioTrack?.setVolume(effectiveVolume)
        } else {
            @Suppress("DEPRECATION")
            audioTrack?.setStereoVolume(effectiveVolume, effectiveVolume)
        }
    }

    fun setVolume(volume: Float) {
        currentVolume = volume.coerceIn(0f, 1f)
        applyVolume()
    }
}
