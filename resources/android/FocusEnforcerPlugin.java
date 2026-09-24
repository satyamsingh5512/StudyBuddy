package in.satym.studybuddy;

import android.app.Activity;
import android.app.AppOpsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FocusEnforcer")
public class FocusEnforcerPlugin extends Plugin {
    public static final String PREFS = "studybuddy_focus_enforcer";
    public static final String KEY_ENABLED = "enabled";
    public static final String KEY_API_BASE_URL = "api_base_url";
    public static final String KEY_DEVICE_ID = "device_id";
    public static final String KEY_GRACE_MS = "grace_ms";
    private static final String STUDYBUDDY_API_BASE_URL = "https://sbd.satym.in/api";

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static boolean hasUsageAccess(Context context) {
        AppOpsManager appOps = (AppOpsManager) context.getSystemService(Context.APP_OPS_SERVICE);
        if (appOps == null) return false;
        int mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            android.os.Process.myUid(),
            context.getPackageName()
        );
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    public static boolean hasOverlayPermission(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context);
    }

    private JSObject status() {
        SharedPreferences prefs = preferences();
        JSObject result = new JSObject();
        result.put("usageAccess", hasUsageAccess(getContext()));
        result.put("overlay", hasOverlayPermission(getContext()));
        result.put("enabled", prefs.getBoolean(KEY_ENABLED, false));
        return result;
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(status());
    }

    /**
     * Launches the first settings destination that this device can actually
     * resolve.
     *
     * The previous implementation called startActivity() once with no try/catch.
     * On devices where the screen is not resolvable (some OEM builds and Android
     * Go editions omit the Usage Access screen) that threw
     * ActivityNotFoundException, the plugin call failed, and the web layer's
     * .catch(() => null) swallowed it — so the button appeared to do nothing.
     */
    private void launchFirstAvailable(PluginCall call, Intent[] candidates, String failureMessage) {
        for (Intent intent : candidates) {
            try {
                Activity activity = getActivity();
                if (activity != null) {
                    activity.startActivity(intent);
                } else {
                    // No foreground activity: a task is required for a fresh stack.
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                }
                call.resolve(status());
                return;
            } catch (Exception ignored) {
                // Fall through to the next, less specific destination.
            }
        }
        call.reject(failureMessage);
    }

    @PluginMethod
    public void openUsageAccessSettings(PluginCall call) {
        Uri self = Uri.parse("package:" + getContext().getPackageName());
        launchFirstAvailable(
            call,
            new Intent[] {
                // Deep-links straight to StudyBuddy's own row on most OEMs.
                new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS, self),
                // The full Usage Access list.
                new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS),
                // Last resort so the user still lands somewhere useful.
                new Intent(Settings.ACTION_SETTINGS)
            },
            "This device has no Usage Access settings screen. Open Settings > Apps > Special app access > Usage access manually."
        );
    }

    @PluginMethod
    public void openOverlaySettings(PluginCall call) {
        Uri self = Uri.parse("package:" + getContext().getPackageName());
        launchFirstAvailable(
            call,
            new Intent[] {
                new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, self),
                new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION),
                new Intent(Settings.ACTION_SETTINGS)
            },
            "This device has no overlay permission screen. Open Settings > Apps > Special app access > Display over other apps manually."
        );
    }

    private boolean isAllowedApiBaseUrl(String value) {
        return value != null && STUDYBUDDY_API_BASE_URL.equals(value.replaceAll("/+$", ""));
    }

    @PluginMethod
    public void enable(PluginCall call) {
        String apiBaseUrl = call.getString("apiBaseUrl", "");
        String deviceId = call.getString("deviceId", "");
        Integer requestedGrace = call.getInt("graceMs", 150000);
        if (!isAllowedApiBaseUrl(apiBaseUrl) || deviceId == null || deviceId.isEmpty()) {
            call.reject("The configured StudyBuddy API URL and device id are required");
            return;
        }

        preferences().edit()
            .putString(KEY_API_BASE_URL, apiBaseUrl.replaceAll("/+$", ""))
            .putString(KEY_DEVICE_ID, deviceId)
            .putLong(KEY_GRACE_MS, Math.max(60000L, Math.min(600000L, requestedGrace.longValue())))
            .putBoolean(KEY_ENABLED, true)
            .apply();

        if (!hasUsageAccess(getContext()) || !hasOverlayPermission(getContext())) {
            call.resolve(status());
            return;
        }

        Intent intent = new Intent(getContext(), FocusEnforcerService.class);
        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve(status());
    }

    @PluginMethod
    public void disable(PluginCall call) {
        preferences().edit().putBoolean(KEY_ENABLED, false).apply();
        getContext().stopService(new Intent(getContext(), FocusEnforcerService.class));
        call.resolve(status());
    }
}
