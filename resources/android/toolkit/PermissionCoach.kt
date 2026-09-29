package `in`.satym.studybuddy.toolkit

import android.app.AppOpsManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.widget.Toast
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import `in`.satym.studybuddy.R
import `in`.satym.studybuddy.activeblocks.ActiveBlocks
import `in`.satym.studybuddy.focuslauncher.FocusLauncher
import `in`.satym.studybuddy.nudges.NudgesPreferences
import `in`.satym.studybuddy.shortsblock.ShortsBlock
import `in`.satym.studybuddy.zen.ZenMode
import `in`.satym.studybuddy.zen.ZenStore

/**
 * One permission in the study-toolkit setup checklist.
 *
 * [required] is computed from what the user has actually switched on rather than
 * being a fixed list. A permission the user has no use for should not be presented
 * as something they must grant — that is how setup screens end up demanding
 * everything and teaching people to grant without reading.
 */
data class PermissionState(
    val granted: Boolean,
    val required: Boolean
)

/**
 * Guided permission setup for the study toolkit.
 *
 * Android gives no API to grant any of these programmatically; every one of them
 * is a trip to a system screen where the user has to find StudyBuddy in a list and
 * flip a switch. Those screens differ by vendor and give no context about why the
 * app sent you there, so people routinely land on them and back out.
 *
 * [open] therefore does two things: it launches the most specific settings screen
 * the platform offers, and it leaves a long Toast on screen naming the exact control
 * to look for. The Toast is deliberately the mechanism rather than an in-app dialog,
 * because by the time the settings activity is in the foreground StudyBuddy's own UI
 * is no longer visible.
 */
object PermissionCoach {
    const val KEY_NOTIFICATIONS = "notifications"
    const val KEY_EXACT_ALARMS = "exactAlarms"
    const val KEY_USAGE_ACCESS = "usageAccess"
    const val KEY_OVERLAY = "overlay"
    const val KEY_ACCESSIBILITY = "accessibility"
    const val KEY_DND_POLICY = "dndPolicy"
    const val KEY_BATTERY_OPTIMIZATION = "batteryOptimization"
    const val KEY_DEFAULT_HOME = "defaultHome"

    /** Checklist order, which is also the order the UI numbers the steps in. */
    val ORDERED_KEYS = listOf(
        KEY_NOTIFICATIONS,
        KEY_EXACT_ALARMS,
        KEY_DND_POLICY,
        KEY_ACCESSIBILITY,
        KEY_USAGE_ACCESS,
        KEY_OVERLAY,
        KEY_BATTERY_OPTIMIZATION,
        KEY_DEFAULT_HOME
    )

    /** Every permission's current state, keyed by the stable ids above. */
    fun statuses(context: Context): Map<String, PermissionState> =
        ORDERED_KEYS.associateWith { key ->
            PermissionState(granted = isGranted(context, key), required = isRequired(context, key))
        }

    fun isGranted(context: Context, key: String): Boolean = when (key) {
        KEY_NOTIFICATIONS -> hasNotifications(context)
        KEY_EXACT_ALARMS -> canScheduleExactAlarms(context)
        KEY_USAGE_ACCESS -> hasUsageAccess(context)
        KEY_OVERLAY -> hasOverlay(context)
        KEY_ACCESSIBILITY -> runCatching { ShortsBlock.isServiceEnabled(context) }.getOrDefault(false)
        KEY_DND_POLICY -> runCatching { ZenMode.hasPolicyAccess(context) }.getOrDefault(false)
        KEY_BATTERY_OPTIMIZATION -> ignoresBatteryOptimizations(context)
        KEY_DEFAULT_HOME -> runCatching { FocusLauncher.isDefaultHome(context) }.getOrDefault(false)
        else -> false
    }

    /**
     * Whether the permission is needed for something the user has switched on.
     * Notifications are the only unconditional entry: every feature in this
     * toolkit reports back through a notification.
     */
    fun isRequired(context: Context, key: String): Boolean = when (key) {
        KEY_NOTIFICATIONS -> true
        KEY_EXACT_ALARMS -> zenEnabled(context) || remindersEnabled(context)
        KEY_DND_POLICY -> zenEnabled(context)
        KEY_ACCESSIBILITY -> shortsBlockWanted(context) || leaveFocusNudgesEnabled(context)
        KEY_DEFAULT_HOME -> runCatching { FocusLauncher.isEnabled(context) }.getOrDefault(false)
        // The active-blocks chip is drawn over other apps, so once the user has asked
        // for it the overlay permission stops being optional. Without it the chip
        // service starts and immediately stops itself, which reads as a broken toggle.
        KEY_OVERLAY -> runCatching { ActiveBlocks.chipEnabled(context) }.getOrDefault(false)
        // Usage access and battery exemption belong to features that live outside this
        // screen (Digital Discipline, long sessions). They are shown so the checklist
        // is complete, never demanded here.
        else -> false
    }

    /**
     * The most specific settings screen for [key], or null when the platform has
     * nothing to open (for example exact-alarm settings below API 31).
     */
    fun intentFor(context: Context, key: String): Intent? {
        val packageUri = Uri.parse("package:${context.packageName}")
        return when (key) {
            KEY_NOTIFICATIONS ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                        .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                } else {
                    appDetailsIntent(context)
                }

            KEY_EXACT_ALARMS ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    Intent("android.settings.REQUEST_SCHEDULE_EXACT_ALARM").setData(packageUri)
                } else {
                    null
                }

            KEY_USAGE_ACCESS -> Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)

            KEY_OVERLAY ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).setData(packageUri)
                } else {
                    null
                }

            KEY_ACCESSIBILITY -> Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)

            KEY_DND_POLICY -> runCatching { ZenMode.policyAccessIntent() }.getOrNull()

            // Deliberately the *list* screen, not ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS.
            // The request action is a Play-policy-restricted permission prompt; the list
            // screen asks the user to make the same change themselves and is always allowed.
            KEY_BATTERY_OPTIMIZATION ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                } else {
                    null
                }

            KEY_DEFAULT_HOME -> runCatching { FocusLauncher.homeSettingsIntent() }.getOrNull()

            else -> null
        }
    }

    /** The app-details screen, used whenever a specific screen is unavailable. */
    fun appDetailsIntent(context: Context): Intent =
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
            .setData(Uri.parse("package:${context.packageName}"))

    /** Precise, vendor-neutral instructions for the screen that just opened. */
    fun guidance(context: Context, key: String): String {
        val resId = when (key) {
            KEY_NOTIFICATIONS -> R.string.studybuddy_toolkit_coach_notifications
            KEY_EXACT_ALARMS -> R.string.studybuddy_toolkit_coach_exact_alarms
            KEY_USAGE_ACCESS -> R.string.studybuddy_toolkit_coach_usage_access
            KEY_OVERLAY -> R.string.studybuddy_toolkit_coach_overlay
            KEY_ACCESSIBILITY -> R.string.studybuddy_toolkit_coach_accessibility
            KEY_DND_POLICY -> R.string.studybuddy_toolkit_coach_dnd
            KEY_BATTERY_OPTIMIZATION -> R.string.studybuddy_toolkit_coach_battery
            KEY_DEFAULT_HOME -> R.string.studybuddy_toolkit_coach_default_home
            else -> R.string.studybuddy_toolkit_coach_generic
        }
        return context.getString(resId)
    }

    /**
     * Opens the settings screen for [key] and shows the matching guidance.
     *
     * Returns true when a settings screen was launched. Falls back to the app
     * details screen rather than failing, because "nothing happened" is the worst
     * possible outcome for a button labelled Grant.
     */
    fun open(context: Context, key: String): Boolean {
        val primary = intentFor(context, key)
        val launched = startSettings(context, primary) || startSettings(context, appDetailsIntent(context))
        if (launched) {
            // Posted rather than shown inline so the Toast lands after the settings
            // activity has drawn; a Toast shown during the transition is easy to miss.
            Handler(Looper.getMainLooper()).postDelayed({
                runCatching { Toast.makeText(context, guidance(context, key), Toast.LENGTH_LONG).show() }
            }, TOAST_DELAY_MS)
        }
        return launched
    }

    private fun startSettings(context: Context, intent: Intent?): Boolean {
        if (intent == null) return false
        return runCatching {
            context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            true
        }.getOrDefault(false)
    }

    private fun hasNotifications(context: Context): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED &&
                NotificationManagerCompat.from(context).areNotificationsEnabled()
        } else {
            NotificationManagerCompat.from(context).areNotificationsEnabled()
        }

    /**
     * Below API 31 every app could set exact alarms, so there is nothing to grant
     * and the honest answer is "already available".
     */
    private fun canScheduleExactAlarms(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        val manager = context.getSystemService(Context.ALARM_SERVICE) as? android.app.AlarmManager
            ?: return false
        return runCatching { manager.canScheduleExactAlarms() }.getOrDefault(false)
    }

    private fun hasUsageAccess(context: Context): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager ?: return false
        val mode = runCatching {
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                context.packageName
            )
        }.getOrDefault(AppOpsManager.MODE_ERRORED)
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun hasOverlay(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)

    /**
     * isIgnoringBatteryOptimizations only exists from API 23. Below that there is no
     * Doze to be exempt from, so reporting true is accurate rather than optimistic.
     */
    private fun ignoresBatteryOptimizations(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        val power = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return false
        return runCatching { power.isIgnoringBatteryOptimizations(context.packageName) }
            .getOrDefault(false)
    }

    private fun zenEnabled(context: Context): Boolean =
        runCatching { ZenStore(context).masterEnabled() }.getOrDefault(false)

    private fun remindersEnabled(context: Context): Boolean =
        runCatching { NudgesPreferences(context).reminderSchedule().enabled }.getOrDefault(false)

    private fun leaveFocusNudgesEnabled(context: Context): Boolean =
        runCatching { NudgesPreferences(context).focusNudgesEnabled() }.getOrDefault(false)

    /**
     * Whether anything the user has switched on needs the accessibility service.
     *
     * Every blocking feature in the shorts package is delivered by that service, not
     * just per-platform short-form detection: a TikTok block, a swipe limit, a per-app
     * daily limit or schedule, and strict anti-tamper mode all go through it too. Leaving
     * them out would let the checklist report accessibility as optional while the feature
     * the user just switched on silently did nothing.
     *
     * `blockInBrowsers` is deliberately excluded: it defaults to on and only widens
     * short-form detection, so counting it would make the permission unconditional and
     * defeat the point of computing this at all.
     */
    private fun shortsBlockWanted(context: Context): Boolean = runCatching {
        val config = ShortsBlock.config(context)
        config.youtubeEnabled || config.instagramEnabled || config.facebookEnabled ||
            config.snapchatEnabled || config.blockedPackages.isNotEmpty() ||
            config.blockTikTok || config.swipeLimit > 0 ||
            ShortsBlock.appRules(context).isNotEmpty() ||
            ShortsBlock.strictSettings(context).strictMode
    }.getOrDefault(false)

    /**
     * Current do-not-disturb filter, for the toolkit status payload. Reported as a
     * plain string so the WebView never receives a framework constant it would have
     * to interpret.
     */
    fun interruptionFilterName(context: Context): String {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return "UNKNOWN"
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            ?: return "UNKNOWN"
        if (!runCatching { manager.isNotificationPolicyAccessGranted }.getOrDefault(false)) {
            return "UNKNOWN"
        }
        return when (runCatching { manager.currentInterruptionFilter }.getOrDefault(0)) {
            NotificationManager.INTERRUPTION_FILTER_ALL -> "ALL"
            NotificationManager.INTERRUPTION_FILTER_PRIORITY -> "PRIORITY"
            NotificationManager.INTERRUPTION_FILTER_NONE -> "NONE"
            NotificationManager.INTERRUPTION_FILTER_ALARMS -> "ALARMS"
            else -> "UNKNOWN"
        }
    }

    private const val TOAST_DELAY_MS = 900L
}
