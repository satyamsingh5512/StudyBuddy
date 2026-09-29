package `in`.satym.studybuddy.shortsblock

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import `in`.satym.studybuddy.MainActivity
import `in`.satym.studybuddy.R

/**
 * A simple, calm intervention shown when short-form content or a blocked app is closed.
 *
 * This activity appears immediately after the accessibility service presses BACK or
 * HOME to interrupt the distraction. It confirms the action taken, shows today's
 * stats, and offers two exits: return to StudyBuddy or dismiss the message.
 *
 * Design intent:
 * The intervention is factual and neutral. It does not shame, guilt, or lecture.
 * It simply acknowledges what happened and reminds the user that returning to
 * study is an option.
 *
 * It extends the framework Activity rather than AppCompatActivity because its theme
 * is a plain android:Theme.Material variant. AppCompatActivity refuses to inflate
 * against a non-Theme.AppCompat theme and would crash on launch.
 */
class ShortsBlockedActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.studybuddy_shortsblock_activity)

        val messageText = findViewById<TextView>(R.id.studybuddy_shortsblock_message)
        val statsText = findViewById<TextView>(R.id.studybuddy_shortsblock_stats)
        val backToStudyBtn = findViewById<Button>(R.id.studybuddy_shortsblock_back_to_study)
        val closeBtn = findViewById<Button>(R.id.studybuddy_shortsblock_close)

        val mode = intent.getStringExtra(EXTRA_MODE) ?: MODE_SHORTS
        val platform = intent.getStringExtra(EXTRA_PLATFORM)
        val detail = intent.getIntExtra(EXTRA_DETAIL, 0)
        val detailStr = intent.getStringExtra(EXTRA_DETAIL_TEXT)

        messageText.text = when (mode) {
            MODE_SHORTS -> getString(R.string.studybuddy_shortsblock_shorts_closed, platform ?: "Short-form content")
            MODE_BLOCKED_APP -> getString(R.string.studybuddy_shortsblock_app_blocked, platform ?: "This app")
            MODE_SWIPE_LIMIT -> getString(R.string.studybuddy_shortsblock_swipe_limit_reached, detail)
            MODE_APP_LIMIT -> getString(R.string.studybuddy_shortsblock_app_limit_reached, detail, platform ?: "This app")
            MODE_APP_WINDOW -> getString(R.string.studybuddy_shortsblock_app_window_blocked, platform ?: "This app", detailStr ?: "later")
            MODE_BROWSER_SHORTS -> getString(R.string.studybuddy_shortsblock_browser_shorts_blocked)
            else -> getString(R.string.studybuddy_shortsblock_generic)
        }

        val (blockedToday, _) = ShortsBlock.todayStats(this)
        statsText.text = resources.getQuantityString(
            R.plurals.studybuddy_shortsblock_stats,
            blockedToday,
            blockedToday
        )

        backToStudyBtn.setOnClickListener {
            startActivity(Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            })
            finish()
        }

        closeBtn.setOnClickListener {
            finish()
        }
    }

    companion object {
        private const val EXTRA_MODE = "mode"
        private const val EXTRA_PLATFORM = "platform"
        private const val EXTRA_DETAIL = "detail"

        /**
         * Separate key from [EXTRA_DETAIL] on purpose. One key holding sometimes an Int
         * and sometimes a String relies on Bundle swallowing the cast failure and
         * returning the default, which works but is a trap for the next change.
         */
        private const val EXTRA_DETAIL_TEXT = "detailText"
        private const val MODE_SHORTS = "shorts"
        private const val MODE_BLOCKED_APP = "blocked_app"
        private const val MODE_SWIPE_LIMIT = "swipe_limit"
        private const val MODE_APP_LIMIT = "app_limit"
        private const val MODE_APP_WINDOW = "app_window"
        private const val MODE_BROWSER_SHORTS = "browser_shorts"

        /**
         * Launch the intervention for a shorts/reels block.
         */
        fun launchForShorts(context: Context, platformName: String) {
            val intent = Intent(context, ShortsBlockedActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                putExtra(EXTRA_MODE, MODE_SHORTS)
                putExtra(EXTRA_PLATFORM, platformName)
            }
            context.startActivity(intent)
        }

        /**
         * Launch the intervention for a blocked app during focus.
         */
        fun launchForBlockedApp(context: Context, appName: String) {
            val intent = Intent(context, ShortsBlockedActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                putExtra(EXTRA_MODE, MODE_BLOCKED_APP)
                putExtra(EXTRA_PLATFORM, appName)
            }
            context.startActivity(intent)
        }

        /**
         * Launch the intervention for a swipe limit reached.
         */
        fun launchForSwipeLimit(context: Context, swipeCount: Int) {
            val intent = Intent(context, ShortsBlockedActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                putExtra(EXTRA_MODE, MODE_SWIPE_LIMIT)
                putExtra(EXTRA_DETAIL, swipeCount)
            }
            context.startActivity(intent)
        }

        /**
         * Launch the intervention for an app daily limit reached.
         */
        fun launchForAppLimit(context: Context, appName: String, limitMinutes: Int) {
            val intent = Intent(context, ShortsBlockedActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                putExtra(EXTRA_MODE, MODE_APP_LIMIT)
                putExtra(EXTRA_PLATFORM, appName)
                putExtra(EXTRA_DETAIL, limitMinutes)
            }
            context.startActivity(intent)
        }

        /**
         * Launch the intervention for an app blocked by time window.
         */
        fun launchForAppWindow(context: Context, appName: String, endTime: String) {
            val intent = Intent(context, ShortsBlockedActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                putExtra(EXTRA_MODE, MODE_APP_WINDOW)
                putExtra(EXTRA_PLATFORM, appName)
                putExtra(EXTRA_DETAIL_TEXT, endTime)
            }
            context.startActivity(intent)
        }

        /**
         * Launch the intervention for browser short-form content blocked.
         */
        fun launchForBrowserShorts(context: Context) {
            val intent = Intent(context, ShortsBlockedActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                putExtra(EXTRA_MODE, MODE_BROWSER_SHORTS)
            }
            context.startActivity(intent)
        }
    }
}
