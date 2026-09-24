package `in`.satym.studybuddy.digitaldiscipline

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat

class CapabilityManager(private val context: Context) {
    fun hasUsageAccess(): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager ?: return false
        return appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), context.packageName) == AppOpsManager.MODE_ALLOWED
    }

    fun hasOverlayPermission(): Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)

    fun hasNotificationPermission(): Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
        ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun ignoresBatteryOptimizations(): Boolean {
        val power = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return false
        return power.isIgnoringBatteryOptimizations(context.packageName)
    }

    fun diagnostics(managed: ManagedDeviceManager): Map<String, Any> = mapOf(
        "androidVersion" to Build.VERSION.RELEASE,
        "apiLevel" to Build.VERSION.SDK_INT,
        "manufacturer" to Build.MANUFACTURER,
        "model" to Build.MODEL,
        "usageAccess" to hasUsageAccess(),
        "overlay" to hasOverlayPermission(),
        "notifications" to hasNotificationPermission(),
        "batteryOptimizationsIgnored" to ignoresBatteryOptimizations(),
        "accessibility" to "NOT_USED",
        "deviceOwner" to managed.isDeviceOwner(),
        "lockTask" to managed.isDeviceOwner(),
        "packageSuspension" to managed.canSuspendPackages(),
        "backgroundExecution" to (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O),
        "nativePlugin" to true,
        "secureCredentialStorage" to (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
    )

    fun usageAccessIntent(): Intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
    fun overlayIntent(): Intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
        data = android.net.Uri.parse("package:${context.packageName}")
    }
    fun notificationIntent(): Intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
        putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
    }
    fun batteryIntent(): Intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
}
