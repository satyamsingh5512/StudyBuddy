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
const mainActivityPath = path.join(javaDir, 'MainActivity.java');

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

let manifest = fs.readFileSync(manifestPath, 'utf8');
if (!manifest.includes('xmlns:tools=')) {
  manifest = manifest.replace(
    '<manifest ',
    '<manifest xmlns:tools="http://schemas.android.com/tools" ',
  );
}
manifest = addPermission(manifest, 'android.permission.SCHEDULE_EXACT_ALARM');
manifest = addPermission(
  manifest,
  'android.permission.PACKAGE_USAGE_STATS',
  ' tools:ignore="ProtectedPermissions"',
);
manifest = addPermission(manifest, 'android.permission.SYSTEM_ALERT_WINDOW');
manifest = addPermission(manifest, 'android.permission.FOREGROUND_SERVICE');
manifest = addPermission(manifest, 'android.permission.FOREGROUND_SERVICE_SPECIAL_USE');
if (manifest.includes('android:allowBackup="true"')) {
  manifest = manifest.replace('android:allowBackup="true"', 'android:allowBackup="false"');
} else if (!manifest.includes('android:allowBackup=')) {
  manifest = manifest.replace('<application', '<application\n        android:allowBackup="false"');
}

const serviceMarker = '<!-- StudyBuddy user-enabled focus guard -->';
if (!manifest.includes(serviceMarker)) {
  const service = `
        ${serviceMarker}
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
fs.writeFileSync(manifestPath, manifest);

fs.mkdirSync(path.dirname(drawablePath), { recursive: true });
fs.writeFileSync(
  drawablePath,
  `<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">\n  <path android:fillColor="#FFFFFFFF" android:pathData="M12,2A10,10 0,1 0,12 22A10,10 0,0 0,12 2zM12,5a1,1 0,0 1,1 1v5.4l3.2,1.9a1,1 0,1 1,-1,1.7L11,12.5V6a1,1 0,0 1,1 -1z"/>\n</vector>\n`,
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
  fs.writeFileSync(mainActivityPath, activity);
}

console.log('Prepared Android alarms, notification icon, and user-enabled focus guard.');
