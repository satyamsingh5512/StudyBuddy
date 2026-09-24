package `in`.satym.studybuddy.auth

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Opens Google sign-in in an in-app Custom Tab instead of handing the user off to
 * a separate Chrome tab.
 *
 * Why not the WebView: Google rejects OAuth in embedded WebViews
 * ("disallowed_useragent"), and spoofing the user agent would violate its policy.
 * A Custom Tab is a real browser surface rendered inside this task, which is the
 * approach Google documents for native apps.
 *
 * Security: the URL is pinned to the StudyBuddy origin, so loaded web content
 * cannot use this bridge to launch an arbitrary destination with app privileges.
 */
@CapacitorPlugin(name = "AuthBridge")
class AuthBridgePlugin : Plugin() {
    private val allowedOrigin = "https://sbd.satym.in"

    private fun isAllowed(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        val parsed = runCatching { Uri.parse(url) }.getOrNull() ?: return false
        if (!"https".equals(parsed.scheme, ignoreCase = true)) return false
        val expected = Uri.parse(allowedOrigin)
        return parsed.host.equals(expected.host, ignoreCase = true) && parsed.port == expected.port
    }

    @PluginMethod
    fun openAuthSession(call: PluginCall) {
        val url = call.getString("url", "")
        if (!isAllowed(url)) {
            call.reject("Only StudyBuddy sign-in URLs can be opened.")
            return
        }
        val activity = activity
        if (activity == null) {
            call.reject("The app is not in the foreground.")
            return
        }
        activity.runOnUiThread {
            try {
                CustomTabsIntent.Builder()
                    .setShowTitle(true)
                    .setUrlBarHidingEnabled(false)
                    .build()
                    .launchUrl(activity, Uri.parse(url))
                call.resolve(JSObject().put("opened", true).put("surface", "custom_tab"))
            } catch (_: ActivityNotFoundException) {
                // No Custom Tabs provider and no browser at all: report it instead
                // of silently doing nothing, so the UI can explain the failure.
                call.reject("No browser is available to complete Google sign-in.")
            } catch (_: Exception) {
                call.reject("Unable to start Google sign-in.")
            }
        }
    }

    /**
     * Brings StudyBuddy back to the front after the deep link returns, which
     * dismisses the Custom Tab that is still sitting on top of the task.
     */
    @PluginMethod
    fun closeAuthSession(call: PluginCall) {
        val activity = activity
        if (activity == null) {
            call.resolve(JSObject().put("closed", false))
            return
        }
        activity.runOnUiThread {
            try {
                val intent = Intent(activity, activity.javaClass).apply {
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                }
                activity.startActivity(intent)
                call.resolve(JSObject().put("closed", true))
            } catch (_: Exception) {
                call.resolve(JSObject().put("closed", false))
            }
        }
    }
}
