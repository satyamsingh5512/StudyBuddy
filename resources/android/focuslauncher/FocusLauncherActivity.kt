package `in`.satym.studybuddy.focuslauncher

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.GridView
import android.widget.ImageView
import android.widget.TextView
import `in`.satym.studybuddy.MainActivity
import `in`.satym.studybuddy.R
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplineDatabase
import `in`.satym.studybuddy.digitaldiscipline.DigitalDisciplinePreferences
import `in`.satym.studybuddy.digitaldiscipline.FocusEngine
import `in`.satym.studybuddy.digitaldiscipline.FocusState
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * A minimal home screen that shows the clock, today's focus progress, and a
 * short list of allowed apps. Everything else is hidden from the launcher so
 * the device feels more like a single-purpose study tool.
 *
 * The back button does nothing here — it is a home screen, so pressing back
 * cannot leave. The user can get out by long-pressing the 'Exit focus home'
 * action, which opens the system home picker and also disables the component.
 */
class FocusLauncherActivity : Activity() {
    private val tickEveryMs = 30_000L // 30 seconds
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var executor: ExecutorService
    private lateinit var preferences: DigitalDisciplinePreferences
    private lateinit var database: DigitalDisciplineDatabase

    private var appGrid: GridView? = null
    private var adapter: AppGridAdapter? = null

    private val tick = object : Runnable {
        override fun run() {
            updateFocusStats()
            handler.postDelayed(this, tickEveryMs)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.studybuddy_focuslauncher_activity)

        executor = Executors.newSingleThreadExecutor()
        preferences = DigitalDisciplinePreferences(applicationContext)
        database = DigitalDisciplineDatabase.get(applicationContext)

        setupViews()
        loadAppGrid()
    }

    override fun onResume() {
        super.onResume()
        updateFocusStats()
        handler.removeCallbacks(tick)
        handler.post(tick)
    }

    override fun onPause() {
        handler.removeCallbacks(tick)
        super.onPause()
    }

    override fun onDestroy() {
        if (::executor.isInitialized) {
            executor.shutdownNow()
        }
        super.onDestroy()
    }

    /**
     * The back button does nothing on a home screen — pressing it cannot leave
     * the activity. The user must use the 'Exit focus home' action instead.
     */
    override fun onBackPressed() {
        // Deliberately blank: home screens do not respond to back.
    }

    private fun setupViews() {
        findViewById<View>(R.id.studybuddy_focuslauncher_open_app).setOnClickListener {
            val intent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            startActivity(intent)
        }

        val exitButton = findViewById<View>(R.id.studybuddy_focuslauncher_exit)
        val gesture = GestureDetector(this, object : GestureDetector.SimpleOnGestureListener() {
            override fun onLongPress(e: MotionEvent) {
                exitFocusHome()
            }
        })
        exitButton.setOnTouchListener { _, event ->
            gesture.onTouchEvent(event)
            true
        }
        // The touch listener consumes every event, so the framework never synthesises
        // a long click from touch — which means a screen-reader user issuing
        // ACTION_LONG_CLICK would have had no way out of a home screen that also
        // ignores Back. performLongClick() bypasses onTouchEvent, so this listener
        // serves accessibility services without ever double-firing for touch users.
        exitButton.setOnLongClickListener {
            exitFocusHome()
            true
        }

        appGrid = findViewById(R.id.studybuddy_focuslauncher_grid)
    }

    private fun loadAppGrid() {
        val grid = appGrid ?: return
        executor.execute {
            val allowed = FocusLauncher.allowedApps(this).toSet()
            val all = FocusLauncher.launchableApps(this)
            val filtered = all.filter { it.packageName in allowed }
            handler.post {
                adapter = AppGridAdapter(filtered)
                grid.adapter = adapter
                grid.setOnItemClickListener { _, _, position, _ ->
                    val app = filtered[position]
                    launchApp(app.packageName)
                }
            }
        }
    }

    private fun launchApp(packageName: String) {
        val intent = packageManager.getLaunchIntentForPackage(packageName)
        if (intent != null) {
            startActivity(intent)
        }
    }

    private fun updateFocusStats() {
        executor.execute {
            val userId = preferences.userId()
            if (userId.isNullOrBlank()) {
                handler.post {
                    findViewById<TextView>(R.id.studybuddy_focuslauncher_stats).text =
                        getString(R.string.studybuddy_focuslauncher_signed_out)
                }
                return@execute
            }

            val dao = database.dao()
            val engine = FocusEngine(dao)
            val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            val todayKey = dateFormat.format(Calendar.getInstance().time)
            val todaySummary = dao.dailySummary(userId, todayKey)
            val todayMinutes = (todaySummary?.focusTimeMs ?: 0L) / 60_000L

            val session = engine.status(userId)
            val activeSession = session?.let { s ->
                runCatching { FocusState.valueOf(s.state) }.getOrNull() == FocusState.ACTIVE
            } == true

            val remainingText = if (session != null && activeSession) {
                val remainingMs = session.configuredDurationMs - engine.elapsedMs(session)
                " · ${formatRemaining(remainingMs)} left"
            } else {
                ""
            }

            val text = getString(
                R.string.studybuddy_focuslauncher_stats_format,
                todayMinutes,
                remainingText
            )
            handler.post {
                findViewById<TextView>(R.id.studybuddy_focuslauncher_stats).text = text
            }
        }
    }

    private fun formatRemaining(remainingMs: Long): String {
        val totalMinutes = ((remainingMs + 59_999L) / 60_000L).coerceAtLeast(1L)
        val hours = totalMinutes / 60
        val minutes = totalMinutes % 60
        return if (hours > 0) "${hours}h ${minutes}m" else "${minutes}m"
    }

    /**
     * Opens the system home settings so the user can pick a different launcher,
     * and also disables the FocusLauncherActivity component so it does not appear
     * in the home picker anymore.
     */
    private fun exitFocusHome() {
        FocusLauncher.setEnabled(this, false)
        val intent = FocusLauncher.homeSettingsIntent()
        startActivity(intent)
    }

    /**
     * Adapter for the app grid. Shows icon and label for each allowed app.
     */
    private inner class AppGridAdapter(
        private val apps: List<LaunchableApp>
    ) : BaseAdapter() {
        override fun getCount(): Int = apps.size
        override fun getItem(position: Int): Any = apps[position]
        override fun getItemId(position: Int): Long = position.toLong()

        override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
            val view = convertView ?: layoutInflater.inflate(
                R.layout.studybuddy_focuslauncher_grid_item,
                parent,
                false
            )
            val app = apps[position]
            val icon = view.findViewById<ImageView>(R.id.studybuddy_focuslauncher_app_icon)
            val label = view.findViewById<TextView>(R.id.studybuddy_focuslauncher_app_label)

            try {
                val drawable = packageManager.getApplicationIcon(app.packageName)
                icon.setImageDrawable(drawable)
            } catch (e: PackageManager.NameNotFoundException) {
                icon.setImageResource(R.drawable.ic_stat_studybuddy)
            }
            label.text = app.label

            return view
        }
    }
}
