#!/usr/bin/env node
/**
 * Reapply native Android customizations after `npx cap sync android`.
 * Capacitor owns android/ as generated output, so versioned source-of-truth
 * changes live here instead of relying on an ignored local project directory.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidRoot = path.join(root, 'android');
const appRoot = path.join(androidRoot, 'app');
const manifestPath = path.join(appRoot, 'src/main/AndroidManifest.xml');
const drawablePath = path.join(appRoot, 'src/main/res/drawable/ic_stat_studybuddy.xml');
const javaDir = path.join(appRoot, 'src/main/java/in/satym/studybuddy');
const nativeSourceDir = path.join(root, 'resources/android');
const digitalDisciplineSourceDir = path.join(nativeSourceDir, 'digitaldiscipline');
const digitalDisciplineTargetDir = path.join(javaDir, 'digitaldiscipline');
const digitalDisciplineTestSourceDir = path.join(nativeSourceDir, 'digitaldiscipline-tests');
const digitalDisciplineTestTargetDir = path.join(appRoot, 'src/test/java/in/satym/studybuddy/digitaldiscipline');
const authSourceDir = path.join(nativeSourceDir, 'auth');
const authTargetDir = path.join(javaDir, 'auth');
const launcherSourceDir = path.join(nativeSourceDir, 'launcher');
const widgetsSourceDir = path.join(nativeSourceDir, 'widgets');
const widgetsTargetDir = path.join(javaDir, 'widgets');
const bubbleSourceDir = path.join(nativeSourceDir, 'bubble');
const bubbleTargetDir = path.join(javaDir, 'bubble');
const alarmSourceDir = path.join(nativeSourceDir, 'alarm');
const alarmTargetDir = path.join(javaDir, 'alarm');
const rewardsSourceDir = path.join(nativeSourceDir, 'rewards');
const rewardsTargetDir = path.join(javaDir, 'rewards');
const soundsSourceDir = path.join(nativeSourceDir, 'sounds');
const soundsTargetDir = path.join(javaDir, 'sounds');
const zenSourceDir = path.join(nativeSourceDir, 'zen');
const zenTargetDir = path.join(javaDir, 'zen');
const nudgesSourceDir = path.join(nativeSourceDir, 'nudges');
const nudgesTargetDir = path.join(javaDir, 'nudges');
const shortsBlockSourceDir = path.join(nativeSourceDir, 'shortsblock');
const shortsBlockTargetDir = path.join(javaDir, 'shortsblock');
const focusLauncherSourceDir = path.join(nativeSourceDir, 'focuslauncher');
const focusLauncherTargetDir = path.join(javaDir, 'focuslauncher');
const activeBlocksSourceDir = path.join(nativeSourceDir, 'activeblocks');
const activeBlocksTargetDir = path.join(javaDir, 'activeblocks');
const toolkitSourceDir = path.join(nativeSourceDir, 'toolkit');
const toolkitTargetDir = path.join(javaDir, 'toolkit');
const toolkitTestSourceDir = path.join(nativeSourceDir, 'toolkit-tests');
const toolkitTestTargetDir = path.join(appRoot, 'src/test/java/in/satym/studybuddy/toolkit');
const resTargetDir = path.join(appRoot, 'src/main/res');
const deviceAdminXmlTarget = path.join(appRoot, 'src/main/res/xml/studybuddy_device_admin.xml');
const mainActivityPath = path.join(javaDir, 'MainActivity.java');
const rootGradlePath = path.join(androidRoot, 'build.gradle');
const appGradlePath = path.join(appRoot, 'build.gradle');

if (!fs.existsSync(manifestPath)) {
  console.error('Android project not found. Run `npx cap sync android` first.');
  process.exit(1);
}

function addPermission(manifest, permission, extra = '') {
  if (manifest.includes(`android:name="${permission}"`)) return manifest;
  return manifest.replace(
    '<application',
    `    <uses-permission android:name="${permission}"${extra} />\n    <application`,
  );
}

function copyDirectory(source, target) {
  if (!fs.existsSync(source)) {
    console.error(`Missing tracked Android source directory: ${source}`);
    process.exit(1);
  }
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

/**
 * Replaces a marker-delimited block inside <application>, or appends it when absent.
 *
 * The block is regenerated on every run rather than added once, so renaming or
 * removing a component cannot leave a stale declaration pointing at a missing class.
 * The lookahead keeps </application> out of the match so it is never consumed — an
 * earlier revision did consume it and corrupted the manifest.
 *
 * Removal leaves behind the indentation that preceded the marker, which used to make
 * the manifest grow by one blank line on every run. Collapsing whitespace-only lines
 * before the closing tag is what makes repeated runs byte-identical.
 */
function regenerateApplicationBlock(manifest, startMarker, endMarker, body) {
  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const blockPattern = new RegExp(
    `[ \\t]*${escapeRegExp(startMarker)}[\\s\\S]*?(?:${escapeRegExp(endMarker)}(?=\\s*</application>)|(?=\\s*</application>))`,
  );
  let next = manifest.replace(blockPattern, '');
  next = next.replace(/(?:[ \t]*\r?\n)+([ \t]*)<\/application>/, '\n$1</application>');
  return next.replace('</application>', `${body}\n    </application>`);
}

function patchGradle() {
  let rootGradle = fs.readFileSync(rootGradlePath, 'utf8');
  if (!rootGradle.includes("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.22")) {
    rootGradle = rootGradle.replace(
      "classpath 'com.android.tools.build:gradle:8.2.1'",
      "classpath 'com.android.tools.build:gradle:8.2.1'\n        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.22'",
    );
    fs.writeFileSync(rootGradlePath, rootGradle);
  }

  let appGradle = fs.readFileSync(appGradlePath, 'utf8');
  if (!appGradle.includes("apply plugin: 'kotlin-android'")) {
    appGradle = appGradle.replace(
      "apply plugin: 'com.android.application'",
      "apply plugin: 'com.android.application'\napply plugin: 'kotlin-android'\napply plugin: 'kotlin-kapt'",
    );
  }
  if (!appGradle.includes("jvmTarget = '17'")) {
    appGradle = appGradle.replace(
      'android {',
      "android {\n    kotlinOptions {\n        jvmTarget = '17'\n    }",
    );
  }
  const dependencies = [
    'implementation "androidx.room:room-runtime:2.6.1"',
    'implementation "androidx.room:room-ktx:2.6.1"',
    'kapt "androidx.room:room-compiler:2.6.1"',
    'implementation "androidx.datastore:datastore-preferences:1.1.1"',
    'implementation "androidx.work:work-runtime-ktx:2.9.0"',
    'implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3"',
    // Custom Tabs: Google rejects OAuth inside embedded WebViews, so sign-in runs
    // in an in-app browser surface instead of an external Chrome tab.
    'implementation "androidx.browser:browser:1.8.0"',
    // Local JVM tests run against android.jar stubs, where every org.json method
    // throws "not mocked". The real implementation is test-only and never ships.
    'testImplementation "org.json:json:20231013"',
  ];
  // The home-screen widgets are built on RemoteViews, so no widget/Compose
  // library is required. Strip it if an earlier revision introduced one, since
  // a stale line here breaks every offline build.
  appGradle = appGradle
    .split('\n')
    .filter((line) => !line.includes('androidx.glance'))
    .join('\n');

  // Release signing is opt-in and driven entirely by environment variables, so no
  // keystore path, alias, or password is ever written into a tracked file. When
  // these are absent the release build simply stays unsigned, which is the correct
  // default: an APK signed with a throwaway key cannot be upgraded to a real one.
  const storeFile = process.env.SB_KEYSTORE_PATH;
  const storePassword = process.env.SB_KEYSTORE_PASSWORD;
  const keyAlias = process.env.SB_KEY_ALIAS;
  const keyPassword = process.env.SB_KEY_PASSWORD;

  if (storeFile && storePassword && keyAlias && keyPassword) {
    if (!appGradle.includes('signingConfigs {')) {
      appGradle = appGradle.replace(
        '    buildTypes {',
        `    signingConfigs {
        release {
            storeFile file("${storeFile}")
            storePassword "${storePassword}"
            keyAlias "${keyAlias}"
            keyPassword "${keyPassword}"
        }
    }
    buildTypes {`
      );
    }
    if (!appGradle.includes('signingConfig signingConfigs.release')) {
      appGradle = appGradle.replace(
        '        release {\n            minifyEnabled false',
        '        release {\n            signingConfig signingConfigs.release\n            minifyEnabled false'
      );
    }
    console.log('Release signing configured from SB_* environment variables.');
  }

  const missingDependencies = dependencies.filter((line) => {
    const coordinate = line.match(/"([^"]+)"/);
    return coordinate ? !appGradle.includes(coordinate[1]) : false;
  });
  if (missingDependencies.length > 0) {
    appGradle = appGradle.replace('dependencies {', `dependencies {\n    ${missingDependencies.join('\n    ')}`);
  }
  fs.writeFileSync(appGradlePath, appGradle);
}

let manifest = fs.readFileSync(manifestPath, 'utf8');
if (!manifest.includes('xmlns:tools=')) {
  manifest = manifest.replace(
    '<manifest ',
    '<manifest xmlns:tools="http://schemas.android.com/tools" ',
  );
}
manifest = addPermission(manifest, 'android.permission.SCHEDULE_EXACT_ALARM');
manifest = addPermission(manifest, 'android.permission.PACKAGE_USAGE_STATS', ' tools:ignore="ProtectedPermissions"');
manifest = addPermission(manifest, 'android.permission.SYSTEM_ALERT_WINDOW');
manifest = addPermission(manifest, 'android.permission.FOREGROUND_SERVICE');
manifest = addPermission(manifest, 'android.permission.FOREGROUND_SERVICE_SPECIAL_USE');
manifest = addPermission(manifest, 'android.permission.POST_NOTIFICATIONS');
if (manifest.includes('android:allowBackup="true"')) {
  manifest = manifest.replace('android:allowBackup="true"', 'android:allowBackup="false"');
} else if (!manifest.includes('android:allowBackup=')) {
  manifest = manifest.replace('<application', '<application\n        android:allowBackup="false"');
}

const deepLinkMarker = '<!-- StudyBuddy OAuth deep link -->';
if (!manifest.includes(deepLinkMarker)) {
  const intentFilter = `
            ${deepLinkMarker}
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="studybuddy" android:host="auth" />
            </intent-filter>
`;
  // Append to the launcher activity, which is already launchMode="singleTask",
  // so the Custom Tab hand-off reuses the running task instead of starting a new one.
  const launcherFilterEnd = manifest.indexOf('</intent-filter>');
  if (launcherFilterEnd === -1) {
    console.error('Unable to find the launcher intent-filter while adding the OAuth deep link.');
    process.exit(1);
  }
  const insertAt = launcherFilterEnd + '</intent-filter>'.length;
  manifest = manifest.slice(0, insertAt) + '\n' + intentFilter + manifest.slice(insertAt);
}

const focusServiceMarker = '<!-- StudyBuddy user-enabled focus guard -->';
if (!manifest.includes(focusServiceMarker)) {
  const service = `
        ${focusServiceMarker}
        <service
            android:name=".FocusEnforcerService"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="User-enabled focus reminder that observes only the current foreground app and ends the user’s StudyBuddy focus session after the chosen grace period." />
        </service>
`;
  manifest = manifest.replace('</application>', `${service}    </application>`);
}

const disciplineServiceMarker = '<!-- StudyBuddy Digital Discipline consumer and managed-mode declarations -->';
if (!manifest.includes(disciplineServiceMarker)) {
  const components = `
        ${disciplineServiceMarker}
        <service
            android:name=".digitaldiscipline.ConsumerEnforcementService"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="Explicitly user-enabled Digital Discipline consumer interventions. It observes only recent foreground package events under Usage Access and displays an explainable countdown; it does not use Accessibility, force-stop, or suspend apps." />
        </service>
        <receiver
            android:name=".digitaldiscipline.StudyBuddyDeviceAdminReceiver"
            android:description="@string/app_name"
            android:exported="true"
            android:label="@string/app_name"
            android:permission="android.permission.BIND_DEVICE_ADMIN">
            <meta-data
                android:name="android.app.device_admin"
                android:resource="@xml/studybuddy_device_admin" />
            <intent-filter>
                <action android:name="android.app.action.DEVICE_ADMIN_ENABLED" />
            </intent-filter>
        </receiver>
`;
  manifest = manifest.replace('</application>', `${components}    </application>`);
}
const widgetMarkerStart = '<!-- StudyBuddy home-screen widgets -->';
const widgetMarkerEnd = '<!-- /StudyBuddy home-screen widgets -->';
{
  const widgetSpecs = [
    ['FocusWidgetProvider', 'studybuddy_focus_widget_info', 'widget_focus_label'],
    ['UsageWidgetProvider', 'studybuddy_usage_widget_info', 'widget_usage_label'],
    ['StudyCalendarWidgetProvider', 'studybuddy_calendar_widget_info', 'widget_calendar_label'],
    ['StudyGoalWidgetProvider', 'studybuddy_goal_widget_info', 'widget_goal_label'],
    ['UnlockCountWidgetProvider', 'studybuddy_unlock_widget_info', 'widget_unlock_label'],
  ];
  const receivers = widgetSpecs
    .map(
      ([receiver, info, label]) => `        <receiver
            android:name=".widgets.${receiver}"
            android:exported="true"
            android:label="@string/${label}">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/${info}" />
        </receiver>`,
    )
    .join('\n');

  manifest = regenerateApplicationBlock(
    manifest,
    widgetMarkerStart,
    widgetMarkerEnd,
    `        ${widgetMarkerStart}\n${receivers}\n        ${widgetMarkerEnd}`,
  );
}
const bubbleMarkerStart = '<!-- StudyBuddy focus bubble -->';
const bubbleMarkerEnd = '<!-- /StudyBuddy focus bubble -->';
{
  const service = `        ${bubbleMarkerStart}
        <service
            android:name=".bubble.ProductiveModeService"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="Keeps the user-enabled draggable focus bubble available over other apps so a short focus session can be started or stopped without leaving the current app. It only starts and stops focus sessions; it does not block, suspend, or force-stop any app, and it does not use Accessibility." />
        </service>
        ${bubbleMarkerEnd}`;
  manifest = regenerateApplicationBlock(manifest, bubbleMarkerStart, bubbleMarkerEnd, service);
}

const alarmMarkerStart = '<!-- StudyBuddy alarms -->';
const alarmMarkerEnd = '<!-- /StudyBuddy alarms -->';
{
  const components = `        ${alarmMarkerStart}
        <receiver
            android:name=".alarm.AlarmReceiver"
            android:exported="false">
            <intent-filter>
                <action android:name="in.satym.studybuddy.alarm.FIRE" />
            </intent-filter>
        </receiver>
        <receiver
            android:name=".alarm.AlarmActionReceiver"
            android:exported="false">
            <intent-filter>
                <action android:name="in.satym.studybuddy.alarm.SNOOZE" />
                <action android:name="in.satym.studybuddy.alarm.DISMISS" />
            </intent-filter>
        </receiver>
        <receiver
            android:name=".alarm.AlarmRestoreReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
                <action android:name="android.intent.action.TIME_SET" />
                <action android:name="android.intent.action.TIMEZONE_CHANGED" />
            </intent-filter>
        </receiver>
        ${alarmMarkerEnd}`;
  manifest = regenerateApplicationBlock(manifest, alarmMarkerStart, alarmMarkerEnd, components);
}

const toolkitMarkerStart = '<!-- StudyBuddy study toolkit -->';
const toolkitMarkerEnd = '<!-- /StudyBuddy study toolkit -->';
{
  // Focus sounds, scheduled Zen windows, leave-focus nudges and study reminders,
  // short-form feed blocking, the opt-in distraction-free home screen, and the
  // active-blocks surfaces (floating chip and standing usage notification).
  //
  // FocusLauncherActivity ships android:enabled="false" on purpose. A HOME
  // intent-filter makes an activity a candidate launcher, and the user must opt in
  // before StudyBuddy is allowed to appear in the home picker at all; the component
  // is switched on at runtime by FocusLauncher.setEnabled.
  const components = `        ${toolkitMarkerStart}
        <service
            android:name=".sounds.FocusSoundService"
            android:exported="false"
            android:foregroundServiceType="mediaPlayback" />
        <receiver
            android:name=".zen.ZenAlarmReceiver"
            android:exported="false">
            <intent-filter>
                <action android:name="in.satym.studybuddy.zen.TRANSITION" />
                <action android:name="in.satym.studybuddy.zen.MANUAL_EXIT" />
            </intent-filter>
        </receiver>
        <receiver
            android:name=".zen.ZenRestoreReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
                <action android:name="android.intent.action.TIME_SET" />
                <action android:name="android.intent.action.TIMEZONE_CHANGED" />
            </intent-filter>
        </receiver>
        <receiver
            android:name=".nudges.NudgeActionReceiver"
            android:exported="false">
            <intent-filter>
                <action android:name="in.satym.studybuddy.nudges.END_SESSION" />
            </intent-filter>
        </receiver>
        <receiver
            android:name=".nudges.StudyReminderReceiver"
            android:exported="false">
            <intent-filter>
                <action android:name="in.satym.studybuddy.nudges.REMIND" />
            </intent-filter>
        </receiver>
        <receiver
            android:name=".nudges.NudgesRestoreReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
                <action android:name="android.intent.action.TIME_SET" />
                <action android:name="android.intent.action.TIMEZONE_CHANGED" />
            </intent-filter>
        </receiver>
        <service
            android:name=".shortsblock.StudyGuardAccessibilityService"
            android:exported="true"
            android:label="@string/studybuddy_shortsblock_service_label"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/studybuddy_shortsblock_accessibility" />
        </service>
        <activity
            android:name=".shortsblock.ShortsBlockedActivity"
            android:excludeFromRecents="true"
            android:exported="false"
            android:launchMode="singleTask"
            android:taskAffinity="in.satym.studybuddy.shortsblock"
            android:theme="@style/StudyBuddyShortsBlockTheme" />
        <activity
            android:name=".focuslauncher.FocusLauncherActivity"
            android:clearTaskOnLaunch="true"
            android:enabled="false"
            android:excludeFromRecents="true"
            android:exported="true"
            android:launchMode="singleTask"
            android:stateNotNeeded="true"
            android:theme="@style/StudyBuddyFocusLauncherTheme">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.HOME" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
        </activity>
        <service
            android:name=".activeblocks.ActiveBlocksChipService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="Keeps the user-enabled active-blocks chip on screen so the blocks currently in force and the running focus session stay visible without opening the notification shade or switching apps. It reads only StudyBuddy's own settings and focus records; it does not block, suspend, or force-stop any app." />
        </service>
        <receiver
            android:name=".activeblocks.ActiveBlocksRestoreReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
        </receiver>
        <receiver
            android:name=".activeblocks.StandingActionReceiver"
            android:enabled="true"
            android:exported="false">
            <intent-filter>
                <action android:name="in.satym.studybuddy.activeblocks.HIDE_TODAY" />
            </intent-filter>
        </receiver>
        ${toolkitMarkerEnd}`;
  manifest = regenerateApplicationBlock(manifest, toolkitMarkerStart, toolkitMarkerEnd, components);
}

// USE_EXACT_ALARM is deliberately NOT requested. Google Play restricts it to apps
// whose core function is alarms or a calendar, and StudyBuddy is neither.
// SCHEDULE_EXACT_ALARM (added above) is the correct permission here, and
// AlarmScheduler degrades to an inexact trigger when it is not granted.
manifest = addPermission(manifest, 'android.permission.RECEIVE_BOOT_COMPLETED');
manifest = addPermission(manifest, 'android.permission.USE_FULL_SCREEN_INTENT');
// Focus sounds run as a media-playback foreground service so the synthesised
// soundscape survives the app going to the background.
manifest = addPermission(manifest, 'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK');
// Scheduled Zen windows toggle Do Not Disturb. The user still has to grant policy
// access in system settings; declaring the permission only makes that possible.
manifest = addPermission(manifest, 'android.permission.ACCESS_NOTIFICATION_POLICY');
// The active-blocks chip is a specialUse foreground service drawn over other apps and
// both surfaces restore after a reboot. SYSTEM_ALERT_WINDOW, FOREGROUND_SERVICE,
// FOREGROUND_SERVICE_SPECIAL_USE, POST_NOTIFICATIONS and RECEIVE_BOOT_COMPLETED are all
// already requested above, so the package adds no new permission of its own.
// addPermission is idempotent, so restating them here would be harmless but redundant.

// Package visibility for the features that let the user pick apps: study apps for
// reminders, allowed apps on the focus home screen, and apps to pause during focus.
// This is the narrow <queries> form, restricted to launchable activities.
// QUERY_ALL_PACKAGES is deliberately NOT requested: it is a broad, policy-sensitive
// permission and a launcher-intent query answers every question this app asks.
const queriesMarker = '<!-- StudyBuddy launchable app visibility -->';
if (!manifest.includes(queriesMarker)) {
  const queries = `    ${queriesMarker}
    <queries>
        <intent>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent>
    </queries>
`;
  // <queries> is a direct child of <manifest>, never of <application>.
  manifest = manifest.replace('<application', `${queries}    <application`);
}

// Invite links. `studybuddy://invite/<id>` is the in-app scheme the native share
// sheet uses; the https form lets an invite sent over any messaging app open in the
// installed APK. autoVerify stays false because App Links verification requires a
// hosted assetlinks.json that this personal build does not publish, and an
// unverified https filter still works — it just shows a disambiguation chooser.
const inviteMarker = '<!-- StudyBuddy invite deep link -->';
if (!manifest.includes(inviteMarker)) {
  const inviteFilter = `
            ${inviteMarker}
            <intent-filter android:autoVerify="false">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="studybuddy" android:host="invite" />
            </intent-filter>
            <intent-filter android:autoVerify="false">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="sbd.satym.in" android:pathPrefix="/invite" />
            </intent-filter>
`;
  // Attached to the launcher activity, which already carries the OAuth deep link
  // and is launchMode="singleTask", so an invite reuses the running task.
  const anchor = manifest.indexOf(deepLinkMarker);
  if (anchor === -1) {
    console.error('Unable to find the OAuth deep link marker while adding the invite deep link.');
    process.exit(1);
  }
  const filterEnd = manifest.indexOf('</intent-filter>', anchor);
  if (filterEnd === -1) {
    console.error('Unable to find the end of the OAuth intent-filter while adding the invite deep link.');
    process.exit(1);
  }
  const insertAt = filterEnd + '</intent-filter>'.length;
  manifest = manifest.slice(0, insertAt) + '\n' + inviteFilter + manifest.slice(insertAt);
}

fs.writeFileSync(manifestPath, manifest);

fs.mkdirSync(path.dirname(drawablePath), { recursive: true });
// Status-bar icons are masked to a single colour by Android, so this is the
// monochrome silhouette of the same book-and-bookmark logo used in the app.
fs.writeFileSync(
  drawablePath,
  `<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="40" android:viewportHeight="40">\n  <path android:fillColor="#FFFFFFFF" android:pathData="M8,10 L8,30 L20,28 L20,8 Z"/>\n  <path android:fillColor="#FFFFFFFF" android:pathData="M20,8 L20,28 L32,30 L32,10 Z"/>\n  <path android:fillColor="#FFFFFFFF" android:pathData="M18,6 L18,16 L20,14 L22,16 L22,6 Z"/>\n</vector>\n`,
);

for (const file of ['FocusEnforcerPlugin.java', 'FocusEnforcerService.java']) {
  const source = path.join(nativeSourceDir, file);
  if (!fs.existsSync(source)) {
    console.error(`Missing tracked Android source: ${source}`);
    process.exit(1);
  }
  fs.mkdirSync(javaDir, { recursive: true });
  fs.copyFileSync(source, path.join(javaDir, file));
}
copyDirectory(authSourceDir, authTargetDir);

/** Copies a feature package: Kotlin into the package dir, res/ into the merged tree. */
function copyFeaturePackage(sourceDir, targetDir) {
  // Clear first so a renamed or removed source file cannot linger in the
  // generated project and keep compiling.
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
  for (const name of fs.readdirSync(sourceDir)) {
    if (name.endsWith('.kt')) fs.copyFileSync(path.join(sourceDir, name), path.join(targetDir, name));
  }
  for (const resFolder of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (!resFolder.isDirectory() || resFolder.name === 'tests') continue;
    fs.cpSync(path.join(sourceDir, resFolder.name), path.join(resTargetDir, resFolder.name), {
      recursive: true,
      force: true,
    });
  }
}

copyFeaturePackage(widgetsSourceDir, widgetsTargetDir);
copyFeaturePackage(bubbleSourceDir, bubbleTargetDir);
copyFeaturePackage(alarmSourceDir, alarmTargetDir);
copyFeaturePackage(rewardsSourceDir, rewardsTargetDir);
copyFeaturePackage(soundsSourceDir, soundsTargetDir);
copyFeaturePackage(zenSourceDir, zenTargetDir);
copyFeaturePackage(nudgesSourceDir, nudgesTargetDir);
copyFeaturePackage(shortsBlockSourceDir, shortsBlockTargetDir);
/**
 * Copies JUnit sources that run on the plain JVM.
 *
 * The unit-test source set declares only `junit:junit`, so a single test file that
 * imports an instrumentation framework does not fail on its own — it fails
 * `compileDebugUnitTestKotlin`, which takes every other test in the project down with
 * it. Files needing a dependency the build does not declare are therefore left in
 * `resources/android/<pkg>-tests/` and skipped here, loudly, rather than copied in to
 * break the build. Declare the dependency and they start being copied again.
 */
function copyJvmTests(source, target) {
  if (!fs.existsSync(source)) {
    console.error(`Missing tracked Android test directory: ${source}`);
    process.exit(1);
  }
  const undeclaredTestDeps = ['org.robolectric', 'androidx.test', 'org.mockito'];
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  for (const name of fs.readdirSync(source).sort()) {
    if (!name.endsWith('.kt')) continue;
    const from = path.join(source, name);
    const body = fs.readFileSync(from, 'utf8');
    const needed = undeclaredTestDeps.find((dep) => body.includes(`import ${dep}`));
    if (needed) {
      console.warn(`Skipping ${name}: needs an undeclared test dependency (${needed}).`);
      continue;
    }
    fs.copyFileSync(from, path.join(target, name));
  }
}

copyFeaturePackage(focusLauncherSourceDir, focusLauncherTargetDir);
copyFeaturePackage(activeBlocksSourceDir, activeBlocksTargetDir);
copyFeaturePackage(toolkitSourceDir, toolkitTargetDir);
copyDirectory(digitalDisciplineSourceDir, digitalDisciplineTargetDir);
copyJvmTests(digitalDisciplineTestSourceDir, digitalDisciplineTestTargetDir);
// Pure-logic JUnit tests for the toolkit: Zen schedule maths, reminder maths, app-limit
// windows, browser URL rules, and the short-form detection rules. They are plain JVM
// tests with no Android dependency, which is why the detection rules were written
// against an interface.
copyJvmTests(toolkitTestSourceDir, toolkitTestTargetDir);
// Launcher artwork: replace Capacitor's template icon with the StudyBuddy logo.
// The template also ships a decorative vector background in drawable-v24, which
// would otherwise win over drawable/ic_launcher_background.xml on API 24+.
copyDirectory(launcherSourceDir, resTargetDir);
// The Android Studio template ships its own launcher drawables under
// drawable-v24/, which is a more specific qualifier than drawable/ and would
// therefore win on API 24+ and keep showing the template artwork.
for (const stale of ['drawable-v24/ic_launcher_foreground.xml', 'drawable-v24/ic_launcher_background.xml']) {
  const stalePath = path.join(resTargetDir, stale);
  if (fs.existsSync(stalePath)) fs.rmSync(stalePath);
}
fs.mkdirSync(path.dirname(deviceAdminXmlTarget), { recursive: true });
fs.copyFileSync(path.join(digitalDisciplineSourceDir, 'device_admin_receiver.xml'), deviceAdminXmlTarget);
patchGradle();

if (!fs.existsSync(mainActivityPath)) {
  console.error(`Capacitor MainActivity not found: ${mainActivityPath}`);
  process.exit(1);
}
let activity = fs.readFileSync(mainActivityPath, 'utf8');
if (!activity.includes('FocusEnforcerPlugin')) {
  if (!activity.includes('import com.getcapacitor.BridgeActivity;')) {
    console.error('Unable to find BridgeActivity import while registering FocusEnforcerPlugin.');
    process.exit(1);
  }
  activity = activity.replace(
    'import com.getcapacitor.BridgeActivity;',
    'import android.os.Bundle;\n\nimport com.getcapacitor.BridgeActivity;\nimport in.satym.studybuddy.FocusEnforcerPlugin;',
  );
  const emptyActivity = /public class MainActivity extends BridgeActivity\s*\{\s*\}/;
  if (!emptyActivity.test(activity)) {
    console.error('Unable to safely register FocusEnforcerPlugin in MainActivity.');
    process.exit(1);
  }
  activity = activity.replace(
    emptyActivity,
    `public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(FocusEnforcerPlugin.class);
    }
}`,
  );
}
if (!activity.includes('AuthBridgePlugin')) {
  activity = activity.replace(
    'import in.satym.studybuddy.FocusEnforcerPlugin;',
    'import in.satym.studybuddy.FocusEnforcerPlugin;\nimport in.satym.studybuddy.auth.AuthBridgePlugin;',
  );
  if (!activity.includes('registerPlugin(FocusEnforcerPlugin.class);')) {
    console.error('Unable to find FocusEnforcer registration while registering AuthBridgePlugin.');
    process.exit(1);
  }
  activity = activity.replace(
    'registerPlugin(FocusEnforcerPlugin.class);',
    'registerPlugin(FocusEnforcerPlugin.class);\n        registerPlugin(AuthBridgePlugin.class);',
  );
}
if (!activity.includes('DigitalDisciplinePlugin')) {
  activity = activity.replace(
    'import in.satym.studybuddy.FocusEnforcerPlugin;',
    'import in.satym.studybuddy.FocusEnforcerPlugin;\nimport in.satym.studybuddy.digitaldiscipline.DigitalDisciplinePlugin;',
  );
  if (!activity.includes('registerPlugin(FocusEnforcerPlugin.class);')) {
    console.error('Unable to find FocusEnforcer registration while registering DigitalDisciplinePlugin.');
    process.exit(1);
  }
  activity = activity.replace(
    'registerPlugin(FocusEnforcerPlugin.class);',
    'registerPlugin(FocusEnforcerPlugin.class);\n        registerPlugin(DigitalDisciplinePlugin.class);',
  );
}
if (!activity.includes('StudyToolkitPlugin')) {
  activity = activity.replace(
    'import in.satym.studybuddy.FocusEnforcerPlugin;',
    'import in.satym.studybuddy.FocusEnforcerPlugin;\nimport in.satym.studybuddy.toolkit.StudyToolkitPlugin;',
  );
  if (!activity.includes('registerPlugin(FocusEnforcerPlugin.class);')) {
    console.error('Unable to find FocusEnforcer registration while registering StudyToolkitPlugin.');
    process.exit(1);
  }
  activity = activity.replace(
    'registerPlugin(FocusEnforcerPlugin.class);',
    'registerPlugin(FocusEnforcerPlugin.class);\n        registerPlugin(StudyToolkitPlugin.class);',
  );
}
fs.writeFileSync(mainActivityPath, activity);

console.log(
  'Prepared Android alarms, launcher icons, in-app Google sign-in, native focus guard, Digital Discipline bridge, and the study toolkit (sounds, Zen, nudges, shorts blocking, focus home screen, active-blocks chip and standing notification).',
);
