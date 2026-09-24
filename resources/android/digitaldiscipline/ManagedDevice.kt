package `in`.satym.studybuddy.digitaldiscipline

import android.app.Activity
import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build

/** Receiver declaration is inert until a device is explicitly provisioned with this app as Device Owner. */
class StudyBuddyDeviceAdminReceiver : DeviceAdminReceiver()

class ManagedDeviceManager(private val context: Context) {
    private val policyManager = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    private val admin = ComponentName(context, StudyBuddyDeviceAdminReceiver::class.java)

    fun isDeviceOwner(): Boolean = policyManager.isDeviceOwnerApp(context.packageName)
    fun canSuspendPackages(): Boolean = isDeviceOwner() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N

    fun status(): Map<String, Any> = mapOf(
        "deviceOwner" to isDeviceOwner(),
        "lockTask" to isDeviceOwner(),
        "packageSuspension" to canSuspendPackages(),
        "controlLevel" to if (isDeviceOwner()) ControlLevel.MANAGED.name else ControlLevel.STANDARD.name
    )

    private fun requireOwner() {
        check(isDeviceOwner()) { "Managed Device mode requires explicit Device Owner provisioning." }
    }

    fun configureAllowedPackages(packages: List<String>) {
        requireOwner()
        val safe = (packages + context.packageName).filter { it.matches(Regex("[A-Za-z0-9_.$]+")) }.distinct().toTypedArray()
        policyManager.setLockTaskPackages(admin, safe)
    }

    fun enterManagedFocusMode(activity: Activity, allowedPackages: List<String>) {
        requireOwner()
        configureAllowedPackages(allowedPackages)
        activity.startLockTask()
    }

    fun exitManagedFocusMode(activity: Activity) {
        requireOwner()
        activity.stopLockTask()
    }

    fun suspendProtectedPackages(packages: List<String>): List<String> {
        requireOwner()
        check(canSuspendPackages()) { "Package suspension requires Android 7.0 or later." }
        val candidates = packages.filter { it != context.packageName && it.matches(Regex("[A-Za-z0-9_.$]+")) }.toTypedArray()
        return policyManager.setPackagesSuspended(admin, candidates, true).toList()
    }

    fun restoreProtectedPackages(packages: List<String>): List<String> {
        requireOwner()
        check(canSuspendPackages()) { "Package suspension requires Android 7.0 or later." }
        val candidates = packages.filter { it != context.packageName && it.matches(Regex("[A-Za-z0-9_.$]+")) }.toTypedArray()
        return policyManager.setPackagesSuspended(admin, candidates, false).toList()
    }
}
