package `in`.satym.studybuddy.bubble

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.widget.TextView
import androidx.core.app.NotificationCompat
import `in`.satym.studybuddy.MainActivity
import `in`.satym.studybuddy.R
import `in`.satym.studybuddy.digitaldiscipline.CapabilityManager
import `in`.satym.studybuddy.digitaldiscipline.ControlLevel
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplineDatabase
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplinePreferences
import `in`.satym.studybuddy.digitaldiscipline.FocusEngine
import `in`.satym.studybuddy.digitaldiscipline.FocusMode
import `in`.satym.studybuddy.digitaldiscipline.FocusState
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * The StudyBuddy focus bubble: a small draggable control that stays available over
 * other apps so a short focus session can be started without switching back to
 * StudyBuddy first.
 *
 * Deliberate limits, matching the rest of Digital Discipline:
 *
 *  - It is opt-in and requires the overlay permission the user grants explicitly.
 *  - It only starts or stops a focus session through the existing FocusEngine. It
 *    never reads screen content, never taps another app, never force-stops or
 *    suspends a package, and does not use Accessibility.
 *  - It holds no foreground package name of its own; deciding *when* a
 *    distraction happened stays with ConsumerEnforcementService.
 */
class ProductiveModeService : Service() {
    private val channelId = "studybuddy-focus-bubble"
    private val notificationId = 9315
    private val tickEveryMs = 1_000L

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var database: DigitalDisciplineDatabase
    private lateinit var preferences: DigitalDisciplinePreferences
    private lateinit var capabilities: CapabilityManager
    private lateinit var executor: ExecutorService
    private var windowManager: WindowManager? = null

    private var bubble: View? = null
    private var panel: View? = null
    private var params: WindowManager.LayoutParams? = null

    private val tick = object : Runnable {
        override fun run() {
            render()
            handler.postDelayed(this, tickEveryMs)
        }
    }

    override fun onCreate() {
        super.onCreate()
        database = DigitalDisciplineDatabase.get(applicationContext)
        preferences = DigitalDisciplinePreferences(applicationContext)
        capabilities = CapabilityManager(applicationContext)
        executor = Executors.newSingleThreadExecutor()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!preferences.focusBubbleEnabled() || !capabilities.hasOverlayPermission()) {
            stopSelf()
            return START_NOT_STICKY
        }
        createChannel()
        startForeground(notificationId, buildNotification())
        if (bubble == null) attachBubble()
        handler.removeCallbacks(tick)
        handler.post(tick)
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(tick)
        detachViews()
        if (::executor.isInitialized) executor.shutdownNow()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(channelId, getString(R.string.bubble_channel_name), NotificationManager.IMPORTANCE_MIN).apply {
            description = getString(R.string.bubble_channel_description)
            setShowBadge(false)
        }
        getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_stat_studybuddy)
            .setContentTitle(getString(R.string.bubble_notification_title))
            .setContentText(getString(R.string.bubble_notification_text))
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setContentIntent(open)
            .build()
    }

    private fun overlayType(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

    private fun attachBubble() {
        val manager = windowManager ?: return
        val view = LayoutInflater.from(this).inflate(R.layout.studybuddy_focus_bubble, null)
        val layout = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayType(),
            // Not focusable: the bubble must never steal typing focus from the
            // app the user is actually trying to work in.
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = preferences.focusBubbleX()
            y = preferences.focusBubbleY()
        }
        params = layout

        view.setOnTouchListener(DragAndTapListener())
        runCatching { manager.addView(view, layout) }
            .onSuccess { bubble = view }
            .onFailure {
                // A refused overlay means the permission was revoked while running.
                preferences.setFocusBubbleEnabled(false)
                stopSelf()
            }
    }

    private fun attachPanel() {
        if (panel != null) return
        val manager = windowManager ?: return
        val anchor = params ?: return
        val view = LayoutInflater.from(this).inflate(R.layout.studybuddy_focus_bubble_panel, null)
        val layout = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM
        }
        view.findViewById<TextView>(R.id.studybuddy_bubble_quick_five).setOnClickListener {
            startQuickSession(5)
        }
        view.findViewById<TextView>(R.id.studybuddy_bubble_quick_twenty_five).setOnClickListener {
            startQuickSession(25)
        }
        view.findViewById<TextView>(R.id.studybuddy_bubble_dismiss).setOnClickListener {
            detachPanel()
        }
        runCatching { manager.addView(view, layout) }.onSuccess { panel = view }
    }

    private fun detachPanel() {
        val view = panel ?: return
        runCatching { windowManager?.removeView(view) }
        panel = null
    }

    private fun detachViews() {
        detachPanel()
        val view = bubble ?: return
        runCatching { windowManager?.removeView(view) }
        bubble = null
    }

    private fun startQuickSession(minutes: Int) {
        val userId = preferences.userId()
        if (userId.isNullOrBlank()) {
            detachPanel()
            return
        }
        executor.execute {
            val engine = FocusEngine(database.dao())
            val alreadyRunning = engine.status(userId)?.let { session ->
                FocusState.valueOf(session.state) == FocusState.ACTIVE
            } == true
            if (alreadyRunning) {
                // Tapping while a session runs ends it, so the bubble is also the
                // fastest way to stop without digging out the app.
                engine.interrupt(userId, "bubble_stopped")
            } else {
                // Quick sessions stay at the standard control level. The bubble
                // must never be a back door into managed-mode enforcement.
                engine.start(userId, FocusMode.POMODORO, minutes * 60_000L, "Quick focus", ControlLevel.STANDARD)
            }
        }
        detachPanel()
    }

    private fun render() {
        val view = bubble ?: return
        val label = view.findViewById<TextView>(R.id.studybuddy_bubble_label)
        val userId = preferences.userId()
        if (userId.isNullOrBlank()) {
            label.text = getString(R.string.bubble_signed_out_short)
            return
        }
        executor.execute {
            val engine = FocusEngine(database.dao())
            val session = engine.status(userId)
            val running = session != null && runCatching {
                FocusState.valueOf(session.state) == FocusState.ACTIVE
            }.getOrDefault(false)
            val text = if (session == null || !running) {
                getString(R.string.bubble_idle_short)
            } else {
                formatRemaining(session.configuredDurationMs - engine.elapsedMs(session))
            }
            handler.post {
                if (bubble != null) label.text = text
            }
        }
    }

    private fun formatRemaining(remainingMs: Long): String {
        val totalMinutes = ((remainingMs + 59_999L) / 60_000L).coerceAtLeast(1L)
        val hours = totalMinutes / 60
        val minutes = totalMinutes % 60
        return if (hours > 0) "${hours}h${minutes}" else "${minutes}m"
    }

    /**
     * A single touch listener has to serve two jobs. A short tap opens the quick
     * panel; anything that moves is a drag, and a drag must never be mistaken for
     * a tap when the user releases.
     */
    private inner class DragAndTapListener : View.OnTouchListener {
        private var downRawX = 0f
        private var downRawY = 0f
        private var startX = 0
        private var startY = 0
        private var dragging = false
        private var moved = false
        private val touchSlop = ViewConfiguration.get(this@ProductiveModeService).scaledTouchSlop

        override fun onTouch(view: View, event: MotionEvent): Boolean {
            val layout = params ?: return false
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    downRawX = event.rawX
                    downRawY = event.rawY
                    startX = layout.x
                    startY = layout.y
                    dragging = false
                    moved = false
                    return true
                }
                MotionEvent.ACTION_MOVE -> {
                    val deltaX = event.rawX - downRawX
                    val deltaY = event.rawY - downRawY
                    if (!dragging && (kotlin.math.abs(deltaX) > touchSlop || kotlin.math.abs(deltaY) > touchSlop)) {
                        dragging = true
                        moved = true
                    }
                    if (dragging) {
                        layout.x = startX + deltaX.toInt()
                        layout.y = startY + deltaY.toInt()
                        runCatching { windowManager?.updateViewLayout(view, layout) }
                    }
                    return true
                }
                MotionEvent.ACTION_UP -> {
                    if (dragging) {
                        // Persist only once the finger lifts, so an in-flight drag
                        // cannot be recorded as a resting position.
                        preferences.setFocusBubblePosition(layout.x, layout.y)
                    } else if (!moved) {
                        detachPanel()
                        attachPanel()
                    }
                    return true
                }
                MotionEvent.ACTION_CANCEL -> return true
            }
            return false
        }
    }

    companion object {
        fun start(context: Context) {
            val intent = Intent(context, ProductiveModeService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, ProductiveModeService::class.java))
        }
    }
}
