import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wrapper for the StudyBuddy APK.
 *
 * Architecture: the APK is a native shell around the deployed web app
 * (https://sbd.satym.in). All AI/social/backend features keep working
 * because they run server-side; the WebView only adds native powers:
 * offline outbox storage, OS-level schedule alarms, haptics, keep-awake.
 *
 * Build steps live in docs/android-apk.md.
 */
const config: CapacitorConfig = {
  appId: 'in.satym.studybuddy',
  appName: 'StudyBuddy',
  webDir: 'public',
  // Load the live deployment inside the APK so every web feature works as-is.
  // For a fully-bundled offline build, point webDir at `out` with
  // `next export` — note cookie-auth + SSR routes then need the hosted URL.
  server: {
    url: 'https://sbd.satym.in',
    cleartext: false,
    errorPath: '/offline.html',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_studybuddy',
    },
  },
};

export default config;
