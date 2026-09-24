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
  ];
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
copyDirectory(digitalDisciplineSourceDir, digitalDisciplineTargetDir);
copyDirectory(digitalDisciplineTestSourceDir, digitalDisciplineTestTargetDir);
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
fs.writeFileSync(mainActivityPath, activity);

console.log('Prepared Android alarms, launcher icons, in-app Google sign-in, native focus guard, and Digital Discipline bridge.');
