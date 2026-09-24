package `in`.satym.studybuddy.digitaldiscipline

import `in`.satym.studybuddy.R
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.annotation.Nullable
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Consumer mode only: every five seconds, read the most recent foreground package
 * after explicit Usage Access consent. The service never reads screen text, clicks
 * another app, changes device settings, force-stops, or suspends a package.
 */
class ConsumerEnforcementService : Service() {
    private val channelId = "studybuddy-digital-discipline"
    private val notificationId = 9302
    private val inspectEveryMs = 5_000L
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var database: DigitalDisciplineDatabase
    private lateinit var preferences: DigitalDisciplinePreferences
    private lateinit var capabilities: CapabilityManager
    private lateinit var executor: ExecutorService
    private var windowManager: WindowManager? = null
    private var overlay: LinearLayout? = null
    private var countdownRunnable: Runnable? = null
    private var interventionPackage: String? = null

    private val inspect = object : Runnable {
        override fun run() {
            executor.execute { inspectForeground() }
            handler.postDelayed(this, inspectEveryMs)
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
        if (!preferences.consumerMonitoringEnabled() || !capabilities.hasUsageAccess() || !capabilities.hasOverlayPermission()) {
            stopSelf()
            return START_NOT_STICKY
        }
        createChannel()
        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_stat_studybuddy)
            .setContentTitle("StudyBuddy Digital Discipline")
            .setContentText("User-enabled consumer focus interventions are active")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
        startForeground(notificationId, notification)
        handler.removeCallbacks(inspect)
        handler.post(inspect)
        return START_STICKY
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(channelId, "Digital Discipline", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Visible while user-enabled consumer focus interventions are running"
        }
        getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
    }

    private fun screenInteractive(): Boolean {
        val power = getSystemService(POWER_SERVICE) as? PowerManager
        return power?.isInteractive ?: false
    }

    private fun foregroundPackage(): String? {
        val usage = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return null
        val now = System.currentTimeMillis()
        val events = usage.queryEvents(now - 15_000L, now)
        val event = UsageEvents.Event()
        var candidate: String? = null
        var latest = 0L
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            val foreground = event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND ||
                (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && event.eventType == UsageEvents.Event.ACTIVITY_RESUMED)
            if (foreground && event.timeStamp >= latest) {
                latest = event.timeStamp
                candidate = event.packageName
            }
        }
        return candidate
    }

    private fun inspectForeground() {
        val userId = preferences.userId() ?: return
        if (!screenInteractive()) {
            handler.post { hideIntervention() }
            return
        }
        val focus = FocusEngine(database.dao()).status(userId)
        if (focus == null || focus.state != FocusState.ACTIVE.name) {
            handler.post { hideIntervention() }
            return
        }
        val packageName = foregroundPackage()
        if (packageName == null || packageName == applicationContext.packageName) {
            handler.post { hideIntervention() }
            return
        }
        val protectedApp = database.dao().protectedApp(userId, packageName)
        val policy = runCatching { protectedApp?.policy?.let(AppPolicy::valueOf) }.getOrNull() ?: AppPolicy.ALLOW
        if (policy != AppPolicy.INTERVENE && policy != AppPolicy.BLOCK) {
            handler.post { hideIntervention() }
            return
        }
        if (interventionPackage == packageName) return
        val evaluation = DoomscrollScorer.evaluate(mapOf("surface_entry" to 1), policy = policy)
        if (!evaluation.triggered) return
        val now = System.currentTimeMillis()
        database.dao().insertDoomscrollEvent(DoomscrollEventEntity(newLocalId(), userId, packageName, "protected_surface_detected", evaluation.score, evaluation.reasons.joinToString(","), now))
        database.dao().insertBlockedAttempt(BlockedAttemptEntity(newLocalId(), userId, focus.id, packageName, ControlLevel.CONSUMER.name, "intervention_requested", now))
        handler.post { showIntervention(userId, focus.id, packageName, policy) }
    }

    private fun showIntervention(userId: String, sessionId: String, packageName: String, policy: AppPolicy) {
        hideIntervention()
        if (!capabilities.hasOverlayPermission()) return
        interventionPackage = packageName
        val view = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(48, 48, 48, 48)
            setBackgroundColor(Color.argb(242, 9, 12, 18))
        }
        val title = TextView(this).apply {
            text = "Doomscrolling interruption"
            setTextColor(Color.WHITE)
            textSize = 24f
            gravity = Gravity.CENTER
        }
        val detail = TextView(this).apply {
            text = "Configured app: $packageName\nRule: ${policy.name.lowercase()}\nStudyBuddy will return you to focus after this 10-second pause."
            setTextColor(Color.LTGRAY)
            textSize = 16f
            gravity = Gravity.CENTER
            setPadding(0, 24, 0, 24)
        }
        val counter = TextView(this).apply {
            setTextColor(Color.rgb(251, 191, 36))
            textSize = 44f
            gravity = Gravity.CENTER
        }
        val open = Button(this).apply {
            text = "Open StudyBuddy now"
            setOnClickListener {
                recordIntervention(userId, sessionId, packageName, "user_returned_to_studybuddy", true)
                openStudyBuddy()
                hideIntervention()
            }
        }
        view.addView(title)
        view.addView(detail)
        view.addView(counter)
        view.addView(open)
        try {
            val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else WindowManager.LayoutParams.TYPE_PHONE
            windowManager?.addView(view, WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT, type,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN, PixelFormat.TRANSLUCENT
            ).apply { gravity = Gravity.CENTER })
            overlay = view
            var remaining = 10
            val tick = object : Runnable {
                override fun run() {
                    if (overlay !== view) return
                    counter.text = remaining.toString()
                    if (remaining <= 0) {
                        recordIntervention(userId, sessionId, packageName, "consumer_return_to_studybuddy", true)
                        openStudyBuddy()
                        hideIntervention()
                        return
                    }
                    remaining -= 1
                    handler.postDelayed(this, 1_000L)
                }
            }
            countdownRunnable = tick
            handler.post(tick)
        } catch (_: Exception) {
            interventionPackage = null
            overlay = null
        }
    }

    private fun recordIntervention(userId: String, sessionId: String, packageName: String, action: String, complete: Boolean) {
        executor.execute {
            database.dao().insertIntervention(InterventionEventEntity(newLocalId(), userId, sessionId, packageName, null, action, 10, complete, System.currentTimeMillis()))
        }
    }

    private fun openStudyBuddy() {
        val launch = packageManager.getLaunchIntentForPackage(packageName)
        if (launch != null) {
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            startActivity(launch)
        }
    }

    private fun hideIntervention() {
        countdownRunnable?.let(handler::removeCallbacks)
        countdownRunnable = null
        overlay?.let {
            try { windowManager?.removeView(it) } catch (_: Exception) { }
        }
        overlay = null
        interventionPackage = null
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        hideIntervention()
        if (::executor.isInitialized) executor.shutdownNow()
        super.onDestroy()
    }

    @Nullable override fun onBind(intent: Intent?): IBinder? = null
}
