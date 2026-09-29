package `in`.satym.studybuddy.activeblocks

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
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import `in`.satym.studybuddy.MainActivity
import `in`.satym.studybuddy.R
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplineDatabase
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplinePreferences
import `in`.satym.studybuddy.digitaldiscipline.FocusEngine
import `in`.satym.studybuddy.digitaldiscipline.FocusState
import `in`.satym.studybuddy.shortsblock.ShortsBlock
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Floating chip service showing what is currently blocked.
 *
 * A small draggable overlay summarizing active blocks: short-form content (Shorts/Reels),
 * blocked apps, and current focus session. Tapping expands a panel listing details and
 * offering quick actions.
 *
 * Foreground service with specialUse type: the chip provides persistent visibility into
 * digital discipline enforcement without requiring the user to pull down the notification
 * shade or return to StudyBuddy.
 */
class ActiveBlocksChipService : Service() {
    private val channelId = "studybuddy-active-blocks-chip"
    private val notificationId = 9317
    private val refreshIntervalMs = 15_000L

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var database: DigitalDisciplineDatabase
    private lateinit var preferences: DigitalDisciplinePreferences
    private lateinit var executor: ExecutorService
    private var windowManager: WindowManager? = null

    private var chip: View? = null
    private var panel: View? = null
    private var chipParams: WindowManager.LayoutParams? = null

    private val refreshTick = object : Runnable {
        override fun run() {
            renderChip()
            handler.postDelayed(this, refreshIntervalMs)
        }
    }

    override fun onCreate() {
        super.onCreate()
        database = DigitalDisciplineDatabase.get(applicationContext)
        preferences = DigitalDisciplinePreferences(applicationContext)
        executor = Executors.newSingleThreadExecutor()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!ActiveBlocks.chipEnabled(applicationContext) || !ActiveBlocks.hasOverlayPermission(applicationContext)) {
            stopSelf()
            return START_NOT_STICKY
        }
        createChannel()
        startForeground(notificationId, buildNotification())
        if (chip == null) attachChip()
        handler.removeCallbacks(refreshTick)
        handler.post(refreshTick)
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(refreshTick)
        detachViews()
        if (::executor.isInitialized) executor.shutdownNow()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            channelId,
            getString(R.string.studybuddy_activeblocks_chip_channel_name),
            NotificationManager.IMPORTANCE_MIN
        ).apply {
            description = getString(R.string.studybuddy_activeblocks_chip_channel_description)
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
        val builder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_stat_studybuddy)
            .setContentTitle(getString(R.string.studybuddy_activeblocks_chip_notification_title))
            .setContentText(getString(R.string.studybuddy_activeblocks_chip_notification_text))
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setContentIntent(open)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            builder.setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
        }
        return builder.build()
    }

    private fun overlayType(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

    private fun attachChip() {
        val manager = windowManager ?: return
        val view = LayoutInflater.from(this).inflate(R.layout.studybuddy_activeblocks_chip, null)
        val layout = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = ActiveBlocks.chipX(applicationContext)
            y = ActiveBlocks.chipY(applicationContext)
        }
        chipParams = layout

        view.setOnTouchListener(DragAndTapListener())
        runCatching { manager.addView(view, layout) }
            .onSuccess { chip = view }
            .onFailure {
                ActiveBlocks.setChipEnabled(applicationContext, false)
                stopSelf()
            }
    }

    private fun attachPanel() {
        if (panel != null) return
        val manager = windowManager ?: return
        val view = LayoutInflater.from(this).inflate(R.layout.studybuddy_activeblocks_panel, null)
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

        val openButton = view.findViewById<TextView>(R.id.studybuddy_activeblocks_open_app)
        openButton.setOnClickListener {
            val intent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            startActivity(intent)
            detachPanel()
        }

        val hideButton = view.findViewById<TextView>(R.id.studybuddy_activeblocks_hide)
        hideButton.setOnClickListener {
            detachPanel()
        }

        renderPanel(view)
        runCatching { manager.addView(view, layout) }.onSuccess { panel = view }
    }

    private fun detachPanel() {
        val view = panel ?: return
        runCatching { windowManager?.removeView(view) }
        panel = null
    }

    private fun detachViews() {
        detachPanel()
        val view = chip ?: return
        runCatching { windowManager?.removeView(view) }
        chip = null
    }

    private fun renderChip() {
        val view = chip ?: return

        // Everything here runs on the executor, including the user-id lookup: that read
        // goes through DataStore with runBlocking, and this method is driven by a 15 s
        // handler tick on the main thread.
        executor.execute {
            val userId = preferences.userId()
            if (userId.isNullOrBlank()) {
                handler.post {
                    if (chip != null) {
                        view.findViewById<TextView>(R.id.studybuddy_activeblocks_chip_text).text =
                            getString(R.string.studybuddy_activeblocks_chip_signed_out)
                    }
                }
                return@execute
            }

            val config = ShortsBlock.config(applicationContext)
            val shortsEnabled = ShortsBlock.isServiceEnabled(applicationContext) &&
                (config.youtubeEnabled || config.instagramEnabled || config.facebookEnabled || config.snapchatEnabled)

            val engine = FocusEngine(database.dao())
            val session = engine.status(userId)
            val focusActive = session != null && runCatching {
                FocusState.valueOf(session.state) == FocusState.ACTIVE
            }.getOrDefault(false)

            val text = buildChipText(shortsEnabled, focusActive, session?.let { engine.elapsedMs(it) } ?: 0L)
            handler.post {
                if (chip != null) {
                    view.findViewById<TextView>(R.id.studybuddy_activeblocks_chip_text).text = text
                }
            }
        }
    }

    private fun buildChipText(shortsEnabled: Boolean, focusActive: Boolean, focusElapsedMs: Long): String {
        val parts = mutableListOf<String>()
        if (shortsEnabled) {
            parts.add(getString(R.string.studybuddy_activeblocks_chip_shorts))
        }
        if (focusActive) {
            parts.add(formatFocusTime(focusElapsedMs))
        }
        return if (parts.isEmpty()) {
            getString(R.string.studybuddy_activeblocks_chip_idle)
        } else {
            "● " + parts.joinToString(" · ")
        }
    }

    private fun formatFocusTime(elapsedMs: Long): String {
        val totalMinutes = ((elapsedMs + 59_999L) / 60_000L).coerceAtLeast(1L)
        val hours = totalMinutes / 60
        val minutes = totalMinutes % 60
        return if (hours > 0) {
            "${hours}h${minutes}m focus"
        } else {
            "${minutes}m focus"
        }
    }

    private fun renderPanel(view: View) {
        executor.execute {
            // Same reason as renderChip: the user-id lookup blocks on DataStore, and
            // this is called while the panel is being attached on the main thread.
            val userId = preferences.userId()
            if (userId.isNullOrBlank()) {
                handler.post {
                    if (panel != null) {
                        view.findViewById<LinearLayout>(R.id.studybuddy_activeblocks_panel_items)
                            .removeAllViews()
                    }
                }
                return@execute
            }

            val config = ShortsBlock.config(applicationContext)
            val shortsEnabled = ShortsBlock.isServiceEnabled(applicationContext)
            val items = mutableListOf<String>()

            if (shortsEnabled) {
                val platforms = mutableListOf<String>()
                if (config.youtubeEnabled) platforms.add("YouTube Shorts")
                if (config.instagramEnabled) platforms.add("Instagram Reels")
                if (config.facebookEnabled) platforms.add("Facebook Reels")
                if (config.snapchatEnabled) platforms.add("Snapchat Spotlight")
                if (platforms.isNotEmpty()) {
                    items.add("Short-form: ${platforms.joinToString(", ")}")
                }
            }

            if (config.blockedPackages.isNotEmpty()) {
                items.add("${config.blockedPackages.size} app(s) blocked during focus")
            }

            val engine = FocusEngine(database.dao())
            val session = engine.status(userId)
            val focusActive = session != null && runCatching {
                FocusState.valueOf(session.state) == FocusState.ACTIVE
            }.getOrDefault(false)

            if (focusActive && session != null) {
                val elapsed = engine.elapsedMs(session)
                items.add("Focus session: ${formatFocusTime(elapsed)}")
            }

            handler.post {
                if (panel != null) {
                    val container = view.findViewById<LinearLayout>(R.id.studybuddy_activeblocks_panel_items)
                    container.removeAllViews()
                    if (items.isEmpty()) {
                        val textView = TextView(this).apply {
                            text = getString(R.string.studybuddy_activeblocks_panel_no_active_blocks)
                            textSize = 14f
                            setTextColor(0xFF666666.toInt())
                            setPadding(0, 8, 0, 8)
                        }
                        container.addView(textView)
                    } else {
                        items.forEach { item ->
                            val textView = TextView(this).apply {
                                text = "• $item"
                                textSize = 14f
                                setTextColor(0xFF212121.toInt())
                                setPadding(0, 8, 0, 8)
                            }
                            container.addView(textView)
                        }
                    }
                }
            }
        }
    }

    private inner class DragAndTapListener : View.OnTouchListener {
        private var downRawX = 0f
        private var downRawY = 0f
        private var startX = 0
        private var startY = 0
        private var dragging = false
        private var moved = false
        private val touchSlop = ViewConfiguration.get(this@ActiveBlocksChipService).scaledTouchSlop

        override fun onTouch(view: View, event: MotionEvent): Boolean {
            val layout = chipParams ?: return false
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
                        ActiveBlocks.setChipPosition(applicationContext, layout.x, layout.y)
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
            val intent = Intent(context, ActiveBlocksChipService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, ActiveBlocksChipService::class.java))
        }
    }
}
