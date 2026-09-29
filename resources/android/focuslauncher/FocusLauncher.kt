package `in`.satym.studybuddy.focuslauncher

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.os.Build
import android.provider.Settings
import android.provider.Telephony

/**
 * A distraction-free home screen the user can opt into when they want their device
 * to act more like a single-purpose study tool than a full app marketplace.
 *
 * It is deliberately NOT the default: the component is declared with android:enabled="false"
 * in the manifest and only becomes home after the user explicitly turns it on. The
 * component can also be disabled at runtime, either by the user long-pressing 'Exit'
 * or by a JS call that decides this mode is no longer appropriate.
 *
 * The interface shows: the time and date, today's focus progress, and a short list
 * of allowed apps (dial, messages, camera, clock, calculator, and anything else the
 * user permits). Every other app is hidden from the launcher, not from the device.
 * The user can get back to a full launcher at any time.
 */
object FocusLauncher {
    private const val PREFS_NAME = "studybuddy_focuslauncher"
    private const val KEY_ENABLED = "enabled"
    private const val KEY_ALLOWED_APPS = "allowed_apps"

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /**
     * Toggles the FocusLauncherActivity component. When enabled, the user's system
     * home-picker will list StudyBuddy as one of the options; when disabled, it
     * will not appear there at all.
     */
    fun setEnabled(context: Context, enabled: Boolean) {
        val component = ComponentName(context, FocusLauncherActivity::class.java)
        val state = if (enabled) {
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED
        } else {
            PackageManager.COMPONENT_ENABLED_STATE_DISABLED
        }
        context.packageManager.setComponentEnabledSetting(
            component,
            state,
            PackageManager.DONT_KILL_APP
        )
        prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply()
    }

    /**
     * Reports whether the FocusLauncherActivity component is enabled at all. This
     * does NOT mean it is the current home — only that it shows up in the home picker.
     *
     * PackageManager is the authority here, not the mirrored preference: the user can
     * be sent back to their old launcher by the system or another tool, and a stale
     * preference would then claim the focus home is still available when it is not.
     * COMPONENT_ENABLED_STATE_DEFAULT means "use the manifest value", and the manifest
     * declares the activity disabled.
     */
    fun isEnabled(context: Context): Boolean {
        val component = ComponentName(context, FocusLauncherActivity::class.java)
        val state = runCatching {
            context.packageManager.getComponentEnabledSetting(component)
        }.getOrDefault(PackageManager.COMPONENT_ENABLED_STATE_DEFAULT)
        return when (state) {
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED -> true
            PackageManager.COMPONENT_ENABLED_STATE_DISABLED -> false
            else -> false
        }
    }

    /**
     * Reports whether StudyBuddy's focus launcher is the current default home app.
     * Returns true only if our package and activity match the system default.
     */
    fun isDefaultHome(context: Context): Boolean {
        val intent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
        }
        val info = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.packageManager.resolveActivity(
                intent,
                PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_DEFAULT_ONLY.toLong())
            )
        } else {
            @Suppress("DEPRECATION")
            context.packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
        }
        val packageName = info?.activityInfo?.packageName
        val className = info?.activityInfo?.name
        return packageName == context.packageName &&
               className == FocusLauncherActivity::class.java.name
    }

    /**
     * Creates an intent that opens the system home settings page, where the user
     * can pick their preferred launcher. On API 21+ this is ACTION_HOME_SETTINGS;
     * on older builds it degrades to the main settings page.
     */
    fun homeSettingsIntent(): Intent {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            Intent(Settings.ACTION_HOME_SETTINGS)
        } else {
            Intent(Settings.ACTION_SETTINGS)
        }
    }

    /**
     * Replaces the set of package names that FocusLauncherActivity will show in
     * its app grid. An empty list hides everything except the 'Open StudyBuddy' button.
     */
    fun setAllowedApps(context: Context, packageNames: List<String>) {
        prefs(context).edit()
            .putStringSet(KEY_ALLOWED_APPS, packageNames.toSet())
            .apply()
    }

    /**
     * Returns the current set of allowed package names, or the default set if
     * nothing has been configured yet.
     */
    fun allowedApps(context: Context): List<String> {
        val stored = prefs(context).getStringSet(KEY_ALLOWED_APPS, null)
        return if (stored == null) {
            defaultAllowedApps(context)
        } else {
            stored.sorted()
        }
    }

    /**
     * Returns all installed launchable apps (those with MAIN/LAUNCHER intents),
     * sorted by label and excluding the StudyBuddy package itself.
     */
    fun launchableApps(context: Context): List<LaunchableApp> {
        val intent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_LAUNCHER)
        }
        // The flags argument changed type in API 33, so each branch has to build its
        // own value; a shared variable would widen to Any and fail to compile.
        val list: List<ResolveInfo> = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.packageManager.queryIntentActivities(
                intent,
                PackageManager.ResolveInfoFlags.of(0L)
            )
        } else {
            @Suppress("DEPRECATION")
            context.packageManager.queryIntentActivities(intent, 0)
        }
        return list
            .filter { it.activityInfo.packageName != context.packageName }
            .map { info ->
                LaunchableApp(
                    info.activityInfo.packageName,
                    info.loadLabel(context.packageManager).toString()
                )
            }
            .distinctBy { it.packageName }
            .sortedBy { it.label.lowercase() }
    }

    /**
     * The default set of allowed apps: dialer, messaging, camera, clock, calculator
     * if they can be found on the device.
     */
    private fun defaultAllowedApps(context: Context): List<String> {
        val packages = mutableSetOf<String>()

        // Dialer: resolves ACTION_DIAL
        val dialIntent = Intent(Intent.ACTION_DIAL)
        val dialerInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.packageManager.resolveActivity(
                dialIntent,
                PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_DEFAULT_ONLY.toLong())
            )
        } else {
            @Suppress("DEPRECATION")
            context.packageManager.resolveActivity(dialIntent, PackageManager.MATCH_DEFAULT_ONLY)
        }
        dialerInfo?.activityInfo?.packageName?.let { packages.add(it) }

        // Messaging: default SMS app
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            Telephony.Sms.getDefaultSmsPackage(context)?.let { packages.add(it) }
        }

        // Camera, clock, calculator: common package names
        val knownApps = listOf(
            "com.android.camera", "com.android.camera2",
            "com.google.android.GoogleCamera",
            "com.android.deskclock", "com.google.android.deskclock",
            "com.android.calculator2", "com.google.android.calculator"
        )
        knownApps.forEach { pkg ->
            if (isPackageInstalled(context, pkg)) {
                packages.add(pkg)
            }
        }

        return packages.sorted()
    }

    private fun isPackageInstalled(context: Context, packageName: String): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.packageManager.getPackageInfo(
                    packageName,
                    PackageManager.PackageInfoFlags.of(0)
                )
            } else {
                @Suppress("DEPRECATION")
                context.packageManager.getPackageInfo(packageName, 0)
            }
            true
        } catch (e: PackageManager.NameNotFoundException) {
            false
        }
    }
}

/**
 * Metadata for a single app that can be launched.
 * @property packageName Android package name.
 * @property label Human-readable name as reported by PackageManager.
 */
data class LaunchableApp(
    val packageName: String,
    val label: String
)
