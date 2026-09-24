package in.satym.studybuddy;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import android.webkit.CookieManager;

/**
 * A consent-gated wellbeing service. It never records app history; it only
 * reads the most recent foreground package while a remote StudyBuddy focus
 * session is live. Android device-owner capabilities are intentionally not
 * used: this displays a reminder and ends the session, never locks the phone.
 */
public class FocusEnforcerService extends Service {
    private static final String CHANNEL_ID = "studybuddy-focus-guard";
    private static final int NOTIFICATION_ID = 9301;
    private static final long POLL_MS = 15_000L;
    private static final long TICK_MS = 1_000L;
    private static final long STALE_REMOTE_MS = 120_000L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private ExecutorService networkExecutor;
    private volatile boolean remoteFocusActive = false;
    private volatile long lastRemoteConfirmationAt = 0L;
    private boolean interruptSent = false;
    private long externalUseStartedAt = 0L;
    private WindowManager windowManager;
    private LinearLayout overlay;
    private String apiBaseUrl;
    private String deviceId;
    private long graceMs;

    private final Runnable pollRemote = new Runnable() {
        @Override public void run() {
            fetchRemoteFocus();
            handler.postDelayed(this, POLL_MS);
        }
    };

    private final Runnable inspectUsage = new Runnable() {
        @Override public void run() {
            inspectCurrentUse();
            handler.postDelayed(this, TICK_MS);
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        networkExecutor = Executors.newSingleThreadExecutor();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        SharedPreferences prefs = getSharedPreferences(FocusEnforcerPlugin.PREFS, MODE_PRIVATE);
        if (!prefs.getBoolean(FocusEnforcerPlugin.KEY_ENABLED, false)
            || !FocusEnforcerPlugin.hasUsageAccess(this)
            || !FocusEnforcerPlugin.hasOverlayPermission(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        apiBaseUrl = prefs.getString(FocusEnforcerPlugin.KEY_API_BASE_URL, "");
        deviceId = prefs.getString(FocusEnforcerPlugin.KEY_DEVICE_ID, "");
        graceMs = prefs.getLong(FocusEnforcerPlugin.KEY_GRACE_MS, 150_000L);
        if (apiBaseUrl == null || !apiBaseUrl.startsWith("https://") || deviceId == null || deviceId.isEmpty()) {
            stopSelf();
            return START_NOT_STICKY;
        }

        createNotificationChannel();
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_studybuddy)
            .setContentTitle("StudyBuddy device focus guard")
            .setContentText("Watching for a user-enabled focus interruption")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        handler.removeCallbacks(pollRemote);
        handler.removeCallbacks(inspectUsage);
        handler.post(pollRemote);
        handler.post(inspectUsage);
        return START_STICKY;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Focus device guard",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("User-enabled StudyBuddy focus interruption monitoring");
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private void fetchRemoteFocus() {
        networkExecutor.execute(() -> {
            try {
                HttpURLConnection connection = openConnection("/timer/focus-active", "GET");
                int status = connection.getResponseCode();
                if (status >= 200 && status < 300) {
                    JSONObject payload = new JSONObject(readBody(connection.getInputStream()));
                    boolean active = payload.optBoolean("active", false);
                    String ownerDeviceId = payload.optString("deviceId", "");
                    remoteFocusActive = active && !deviceId.equals(ownerDeviceId);
                    lastRemoteConfirmationAt = System.currentTimeMillis();
                } else {
                    remoteFocusActive = false;
                }
                connection.disconnect();
            } catch (Exception ignored) {
                if (System.currentTimeMillis() - lastRemoteConfirmationAt > STALE_REMOTE_MS) {
                    remoteFocusActive = false;
                }
            }
        });
    }

    private HttpURLConnection openConnection(String endpoint, String method) throws Exception {
        URL url = new URL(apiBaseUrl + endpoint);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("Accept", "application/json");
        String origin = apiBaseUrl.endsWith("/api") ? apiBaseUrl.substring(0, apiBaseUrl.length() - 4) : apiBaseUrl;
        String cookies = CookieManager.getInstance().getCookie(origin);
        if (cookies != null && !cookies.isEmpty()) connection.setRequestProperty("Cookie", cookies);
        return connection;
    }

    private String readBody(InputStream stream) throws Exception {
        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) body.append(line);
        }
        return body.toString();
    }

    private boolean screenIsInteractive() {
        PowerManager power = (PowerManager) getSystemService(POWER_SERVICE);
        return power == null || power.isInteractive();
    }

    private String foregroundPackage() {
        UsageStatsManager usage = (UsageStatsManager) getSystemService(USAGE_STATS_SERVICE);
        if (usage == null) return null;
        long now = System.currentTimeMillis();
        UsageEvents events = usage.queryEvents(now - 10_000L, now);
        UsageEvents.Event event = new UsageEvents.Event();
        String foreground = null;
        long latest = 0L;
        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            int type = event.getEventType();
            boolean foregroundEvent = type == UsageEvents.Event.MOVE_TO_FOREGROUND
                || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && type == UsageEvents.Event.ACTIVITY_RESUMED);
            if (foregroundEvent && event.getTimeStamp() >= latest) {
                latest = event.getTimeStamp();
                foreground = event.getPackageName();
            }
        }
        return foreground;
    }

    private void inspectCurrentUse() {
        boolean usingStudyBuddy = getPackageName().equals(foregroundPackage());
        boolean shouldGuard = remoteFocusActive && screenIsInteractive() && !usingStudyBuddy;
        if (!shouldGuard) {
            externalUseStartedAt = 0L;
            interruptSent = false;
            hideOverlay();
            return;
        }

        if (externalUseStartedAt == 0L) {
            externalUseStartedAt = System.currentTimeMillis();
            showOverlay();
        }
        if (!interruptSent && System.currentTimeMillis() - externalUseStartedAt >= graceMs) {
            interruptSent = true;
            postPhoneInterrupt();
        }
    }

    private void postPhoneInterrupt() {
        networkExecutor.execute(() -> {
            try {
                HttpURLConnection connection = openConnection("/timer/focus-end", "POST");
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                byte[] body = "{\"endReason\":\"phone-interrupt\"}".getBytes(StandardCharsets.UTF_8);
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(body);
                }
                if (connection.getResponseCode() >= 200 && connection.getResponseCode() < 300) {
                    remoteFocusActive = false;
                    handler.post(this::hideOverlay);
                } else {
                    interruptSent = false;
                }
                connection.disconnect();
            } catch (Exception ignored) {
                interruptSent = false;
            }
        });
    }

    private void showOverlay() {
        if (overlay != null || !FocusEnforcerPlugin.hasOverlayPermission(this)) return;
        try {
            overlay = new LinearLayout(this);
            overlay.setOrientation(LinearLayout.VERTICAL);
            overlay.setGravity(Gravity.CENTER);
            overlay.setPadding(48, 48, 48, 48);
            overlay.setBackgroundColor(Color.argb(236, 0, 0, 0));
            TextView title = new TextView(this);
            title.setText("You are on a focus session");
            title.setTextColor(Color.WHITE);
            title.setTextSize(24);
            title.setGravity(Gravity.CENTER);
            TextView body = new TextView(this);
            body.setText("Put your phone down or open StudyBuddy's timer here. Continued use ends the focus session.");
            body.setTextColor(Color.LTGRAY);
            body.setTextSize(16);
            body.setGravity(Gravity.CENTER);
            body.setPadding(0, 28, 0, 0);
            Button openStudyBuddy = new Button(this);
            openStudyBuddy.setText("Open StudyBuddy timer");
            openStudyBuddy.setOnClickListener((view) -> {
                Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
                if (launch != null) {
                    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    startActivity(launch);
                }
                hideOverlay();
            });
            overlay.addView(title);
            overlay.addView(body);
            overlay.addView(openStudyBuddy);
            int overlayType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
            WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                overlayType,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
            );
            params.gravity = Gravity.CENTER;
            windowManager.addView(overlay, params);
        } catch (Exception ignored) {
            overlay = null;
        }
    }

    private void hideOverlay() {
        if (overlay == null) return;
        try {
            windowManager.removeView(overlay);
        } catch (Exception ignored) {
            // Already detached.
        }
        overlay = null;
    }

    @Override public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        hideOverlay();
        if (networkExecutor != null) networkExecutor.shutdownNow();
        super.onDestroy();
    }

    @Nullable @Override public IBinder onBind(Intent intent) {
        return null;
    }
}
