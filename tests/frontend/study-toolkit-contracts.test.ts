import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const read = (file: string) => readFile(path.join(process.cwd(), file), 'utf8');

const exists = async (relative: string): Promise<boolean> => {
  try {
    await stat(path.join(process.cwd(), relative));
    return true;
  } catch {
    return false;
  }
};

/**
 * The study toolkit is five native feature packages plus one Capacitor facade, and
 * none of it can be exercised on this machine: there is no emulator, and a Gradle
 * build is out of reach. These are therefore source-level contracts on the parts
 * that are easy to break silently — a component that stops being declared, a
 * permission that stops being requested, a regex that starts eating </application>.
 */

const NATIVE_PACKAGES = [
  'sounds',
  'zen',
  'nudges',
  'shortsblock',
  'focuslauncher',
  'activeblocks',
  'toolkit',
];

test('every native toolkit package and its key classes are present', async () => {
  for (const pkg of NATIVE_PACKAGES) {
    assert.ok(await exists(`resources/android/${pkg}`), `missing package dir: ${pkg}`);
  }

  const required = [
    'resources/android/sounds/FocusSounds.kt',
    'resources/android/sounds/FocusSoundService.kt',
    'resources/android/sounds/SoundscapeGenerator.kt',
    'resources/android/zen/ZenSchedule.kt',
    'resources/android/zen/ZenController.kt',
    'resources/android/zen/ZenAlarmReceiver.kt',
    'resources/android/zen/ZenRestoreReceiver.kt',
    'resources/android/nudges/FocusNudges.kt',
    'resources/android/nudges/StudyReminders.kt',
    'resources/android/nudges/ReminderMath.kt',
    'resources/android/shortsblock/ShortFormDetector.kt',
    'resources/android/shortsblock/ShortsBlockSettings.kt',
    'resources/android/shortsblock/StudyGuardAccessibilityService.kt',
    'resources/android/shortsblock/ShortsBlockedActivity.kt',
    'resources/android/shortsblock/AppLimits.kt',
    'resources/android/shortsblock/BrowserShortsRule.kt',
    'resources/android/shortsblock/ReelSwipeLimiter.kt',
    'resources/android/shortsblock/StrictGuard.kt',
    'resources/android/activeblocks/ActiveBlocks.kt',
    'resources/android/activeblocks/ActiveBlocksChipService.kt',
    'resources/android/activeblocks/UsageStandingNotification.kt',
    'resources/android/activeblocks/UsageStandingWorker.kt',
    'resources/android/activeblocks/ActiveBlocksRestoreReceiver.kt',
    'resources/android/activeblocks/StandingActionReceiver.kt',
    'resources/android/activeblocks/values/studybuddy_activeblocks_strings.xml',
    'resources/android/focuslauncher/FocusLauncher.kt',
    'resources/android/focuslauncher/FocusLauncherActivity.kt',
    'resources/android/toolkit/StudyToolkitPlugin.kt',
    'resources/android/toolkit/PermissionCoach.kt',
    'resources/android/toolkit/values/studybuddy_toolkit_strings.xml',
  ];
  for (const file of required) {
    assert.ok(await exists(file), `missing native source: ${file}`);
  }
});

test('the Capacitor facade is registered under the name the web bridge asks for', async () => {
  const plugin = await read('resources/android/toolkit/StudyToolkitPlugin.kt');
  assert.match(plugin, /@CapacitorPlugin\(name = "StudyToolkit"\)/);
  assert.match(plugin, /class StudyToolkitPlugin : Plugin\(\)/);
  // Single-thread executor + a wrapper that never reports the underlying exception.
  assert.match(plugin, /Executors\.newSingleThreadExecutor\(\)/);
  assert.match(plugin, /private fun asynchronous\(call: PluginCall, work: \(\) -> JSObject\)/);
  assert.match(plugin, /catch \(_: Exception\)/);
  assert.match(plugin, /"The study toolkit could not complete this request"/);

  for (const method of [
    'getToolkitStatus',
    'listSoundscapes',
    'startFocusSound',
    'pauseFocusSound',
    'resumeFocusSound',
    'stopFocusSound',
    'setFocusSoundVolume',
    'getZenConfig',
    'setZenWindows',
    'setZenEnabled',
    'zenEnterNow',
    'zenExitNow',
    'getNudgeConfig',
    'setNudgeConfig',
    'getShortsBlockConfig',
    'setShortsBlockConfig',
    'requestStrictDisable',
    'getAppRules',
    'setAppRules',
    'getAppUsageToday',
    'getActiveBlocksConfig',
    'setActiveBlocksChip',
    'setStandingNotification',
    'getLauncherConfig',
    'setLauncherEnabled',
    'setLauncherAllowedApps',
    'listLaunchableApps',
    'getPermissionStatus',
    'openPermission',
  ]) {
    assert.match(plugin, new RegExp(`fun ${method}\\(call: PluginCall\\)`), `plugin is missing ${method}`);
  }
});

test('plugin input is validated, not trusted', async () => {
  const plugin = await read('resources/android/toolkit/StudyToolkitPlugin.kt');
  assert.match(plugin, /coerceIn\(0f, 1f\)/);
  assert.match(plugin, /const val MAX_MINUTES = 600/);
  assert.match(plugin, /const val MAX_PACKAGES = 50/);
  assert.match(plugin, /\^\[a-zA-Z\]\[a-zA-Z0-9_\]\*\(\\\\\.\[a-zA-Z0-9_\]\+\)\+\$/);
  // Detection rules stay device-side: the WebView must not be able to widen what
  // the accessibility service inspects.
  assert.match(plugin, /customIdRules = current\.customIdRules/);
});

test('guided permission setup covers every key with an intent and precise guidance', async () => {
  const [coach, strings] = await Promise.all([
    read('resources/android/toolkit/PermissionCoach.kt'),
    read('resources/android/toolkit/values/studybuddy_toolkit_strings.xml'),
  ]);

  for (const key of [
    'notifications',
    'exactAlarms',
    'usageAccess',
    'overlay',
    'accessibility',
    'dndPolicy',
    'batteryOptimization',
    'defaultHome',
  ]) {
    assert.match(coach, new RegExp(`"${key}"`), `PermissionCoach is missing the ${key} key`);
  }

  // A settings screen that cannot be found must still take the user somewhere.
  assert.match(coach, /fun appDetailsIntent\(context: Context\): Intent/);
  assert.match(coach, /Intent\.FLAG_ACTIVITY_NEW_TASK/);
  assert.match(coach, /Toast\.LENGTH_LONG/);

  const guidanceStrings = [
    'studybuddy_toolkit_coach_notifications',
    'studybuddy_toolkit_coach_exact_alarms',
    'studybuddy_toolkit_coach_usage_access',
    'studybuddy_toolkit_coach_overlay',
    'studybuddy_toolkit_coach_accessibility',
    'studybuddy_toolkit_coach_dnd',
    'studybuddy_toolkit_coach_battery',
    'studybuddy_toolkit_coach_default_home',
    'studybuddy_toolkit_coach_generic',
  ];
  for (const name of guidanceStrings) {
    assert.match(coach, new RegExp(`R\\.string\\.${name}`), `PermissionCoach never uses ${name}`);
    assert.match(strings, new RegExp(`name="${name}"`), `strings.xml is missing ${name}`);
  }
});

test('prepare-android copies every feature package and the toolkit unit tests', async () => {
  const script = await read('scripts/prepare-android.mjs');
  for (const pkg of NATIVE_PACKAGES) {
    assert.match(
      script,
      new RegExp(`copyFeaturePackage\\(\\w+SourceDir, \\w+TargetDir\\)`),
      'copyFeaturePackage calls are missing entirely'
    );
    assert.match(script, new RegExp(`path\\.join\\(nativeSourceDir, '${pkg}'\\)`), `${pkg} is never copied`);
  }
  assert.match(script, /copyFeaturePackage\(soundsSourceDir, soundsTargetDir\)/);
  assert.match(script, /copyFeaturePackage\(zenSourceDir, zenTargetDir\)/);
  assert.match(script, /copyFeaturePackage\(nudgesSourceDir, nudgesTargetDir\)/);
  assert.match(script, /copyFeaturePackage\(shortsBlockSourceDir, shortsBlockTargetDir\)/);
  assert.match(script, /copyFeaturePackage\(focusLauncherSourceDir, focusLauncherTargetDir\)/);
  assert.match(script, /copyFeaturePackage\(activeBlocksSourceDir, activeBlocksTargetDir\)/);
  assert.match(script, /copyFeaturePackage\(toolkitSourceDir, toolkitTargetDir\)/);

  assert.match(script, /path\.join\(nativeSourceDir, 'toolkit-tests'\)/);
  assert.match(script, /src\/test\/java\/in\/satym\/studybuddy\/toolkit/);
  assert.match(script, /copyJvmTests\(toolkitTestSourceDir, toolkitTestTargetDir\)/);
});

test('unit tests are copied only when the build declares what they need', async () => {
  const script = await read('scripts/prepare-android.mjs');
  const gradle = await read('android/app/build.gradle').catch(() => '');

  // One test file importing an instrumentation framework does not fail alone: it fails
  // compileDebugUnitTestKotlin and takes every other test in the project with it.
  assert.match(script, /function copyJvmTests\(/);
  assert.match(script, /undeclaredTestDeps/);
  for (const dep of ['org.robolectric', 'androidx.test', 'org.mockito']) {
    assert.ok(script.includes(`'${dep}'`), `${dep} is not screened out of the JVM test copy`);
  }
  assert.match(script, /import \$\{dep\}/, 'the screen must match an import, not any mention');

  // Both test directories go through the filter, not the raw directory copy.
  assert.doesNotMatch(script, /copyDirectory\(toolkitTestSourceDir/);
  assert.doesNotMatch(script, /copyDirectory\(digitalDisciplineTestSourceDir/);

  // And the screen is real: if Robolectric ever is declared, drop it from the list.
  if (gradle) {
    assert.ok(
      !/testImplementation\s+["']org\.robolectric/.test(gradle),
      'Robolectric is declared now, so it should no longer be screened out'
    );
  }
});

test('the toolkit manifest block is regenerated without ever consuming </application>', async () => {
  const script = await read('scripts/prepare-android.mjs');
  assert.match(script, /<!-- StudyBuddy study toolkit -->/);
  assert.match(script, /<!-- \/StudyBuddy study toolkit -->/);
  // Same lookahead shape as the alarm block: </application> stays outside the match.
  assert.match(
    script,
    /\(\?=\\\\s\*<\/application>\)\|\(\?=\\\\s\*<\/application>\)/,
    'the removal regex no longer uses the </application> lookahead'
  );
  assert.match(script, /regenerateApplicationBlock\(manifest, toolkitMarkerStart, toolkitMarkerEnd, components\)/);
  // Repeated runs must be byte-identical, which means the residue left by the
  // removal has to be collapsed rather than accumulating a blank line each time.
  assert.match(script, /\(\?:\[ \\t\]\*\\r\?\\n\)\+\(\[ \\t\]\*\)<\\\/application>/);
});

test('the manifest template declares every toolkit component', async () => {
  const script = await read('scripts/prepare-android.mjs');
  for (const component of [
    '.sounds.FocusSoundService',
    '.zen.ZenAlarmReceiver',
    '.zen.ZenRestoreReceiver',
    '.nudges.NudgeActionReceiver',
    '.nudges.StudyReminderReceiver',
    '.nudges.NudgesRestoreReceiver',
    '.shortsblock.StudyGuardAccessibilityService',
    '.shortsblock.ShortsBlockedActivity',
    '.focuslauncher.FocusLauncherActivity',
    '.activeblocks.ActiveBlocksChipService',
    '.activeblocks.ActiveBlocksRestoreReceiver',
    '.activeblocks.StandingActionReceiver',
  ]) {
    assert.ok(script.includes(`android:name="${component}"`), `manifest template is missing ${component}`);
  }
  assert.match(script, /android:foregroundServiceType="mediaPlayback"/);
});

test('the active-blocks components live inside the regenerated toolkit block', async () => {
  const script = await read('scripts/prepare-android.mjs');
  // Inside the marked block, so a rename cannot leave a stale receiver behind and a
  // repeated prepare run cannot declare the same component twice.
  const block = script.slice(
    script.indexOf('${toolkitMarkerStart}'),
    script.indexOf('${toolkitMarkerEnd}')
  );
  for (const component of [
    '.activeblocks.ActiveBlocksChipService',
    '.activeblocks.ActiveBlocksRestoreReceiver',
    '.activeblocks.StandingActionReceiver',
  ]) {
    assert.ok(block.includes(`android:name="${component}"`), `${component} is outside the toolkit block`);
    assert.equal(
      script.split(`android:name="${component}"`).length - 1,
      1,
      `${component} is declared more than once in the template`
    );
  }
  // The chip is an overlay foreground service, and both surfaces come back after a reboot.
  assert.ok(block.includes('android:foregroundServiceType="specialUse"'));
  assert.ok(block.includes('android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE'));
  assert.ok(block.includes('android.intent.action.BOOT_COMPLETED'));
  assert.ok(block.includes('android.intent.action.MY_PACKAGE_REPLACED'));
  assert.ok(block.includes('in.satym.studybuddy.activeblocks.HIDE_TODAY'));
  // The action receiver must not be reachable from other apps.
  const receiverBlock = block.slice(block.indexOf('.activeblocks.StandingActionReceiver'));
  assert.ok(receiverBlock.includes('android:exported="false"'));

  // No new permission is needed: the chip reuses the ones already requested.
  assert.match(script, /addPermission\(manifest, 'android\.permission\.SYSTEM_ALERT_WINDOW'\)/);
  assert.match(script, /addPermission\(manifest, 'android\.permission\.FOREGROUND_SERVICE_SPECIAL_USE'\)/);
  assert.match(script, /addPermission\(manifest, 'android\.permission\.RECEIVE_BOOT_COMPLETED'\)/);
  assert.match(script, /addPermission\(manifest, 'android\.permission\.POST_NOTIFICATIONS'\)/);
});

test('the stronger blocking features are bounded by the plugin, not the feature packages', async () => {
  const plugin = await read('resources/android/toolkit/StudyToolkitPlugin.kt');
  for (const bound of [
    'const val MAX_SWIPE_LIMIT = 200',
    'const val MAX_STRICT_COOLOFF_MINUTES = 120',
    'const val MAX_APP_RULES = 50',
    'const val MAX_RULE_WINDOWS = 6',
    'const val MAX_DAILY_LIMIT_MINUTES = 1440',
  ]) {
    assert.ok(plugin.includes(bound), `the plugin no longer declares ${bound}`);
  }
  // Every one of those bounds has to actually be checked, not merely declared.
  assert.match(plugin, /require\(swipeLimit in 0\.\.MAX_SWIPE_LIMIT\)/);
  assert.match(plugin, /require\(cooloff in 0\.\.MAX_STRICT_COOLOFF_MINUTES\)/);
  assert.match(plugin, /require\(raw\.size <= MAX_APP_RULES\)/);
  assert.match(plugin, /require\(windowsArray\.length\(\) <= MAX_RULE_WINDOWS\)/);
  assert.match(plugin, /require\(dailyLimitMinutes in 0\.\.MAX_DAILY_LIMIT_MINUTES\)/);
  // Package names in app rules go through the same grammar check as every other list.
  assert.match(plugin, /require\(PACKAGE_PATTERN\.matches\(packageName\)\)/);
  // One rule per package, or the effective limit would be ambiguous.
  assert.match(plugin, /require\(rules\.map \{ it\.packageName \}\.distinct\(\)\.size == rules\.size\)/);

  // Focus state is read from the database, never accepted from the WebView, because
  // strict mode uses it to decide whether protection is in force.
  assert.match(plugin, /private fun isFocusActive\(\): Boolean/);
  assert.match(plugin, /dao\(\)\.activeFocus\(userId\)/);
  assert.doesNotMatch(plugin, /call\.getBoolean\("isFocusActive"/);
});

test('strict mode can only be switched off through the cool-off', async () => {
  const [plugin, settings, guard] = await Promise.all([
    read('resources/android/toolkit/StudyToolkitPlugin.kt'),
    read('resources/android/shortsblock/ShortsBlockSettings.kt'),
    read('resources/android/shortsblock/StrictGuard.kt'),
  ]);

  // The plugin never writes strict settings itself; it delegates to the one function
  // that owns the invariant.
  assert.match(plugin, /ShortsBlock\.applyStrictSettings\(/);
  assert.match(plugin, /ShortsBlock\.requestStrictDisable\(/);
  assert.doesNotMatch(plugin, /StrictGuard\.setSettings/);
  // The three strict keys are only honoured when the caller actually sent them, so an
  // unrelated config write cannot reset a protection.
  assert.match(plugin, /if \(requestedMode == null && requestedAlways == null && requestedCooloff == null\) return/);

  // A disable request is routed, not applied — whenever strict mode is actually on.
  assert.match(settings, /return requestStrictDisable\(context, isFocusActive\)/);
  assert.match(settings, /if \(!current\.strictMode\) \{/);
  // The only direct `strictMode = false` write sits inside the already-off branch, where
  // there is nothing in force to escape. Anything after that branch must not write it.
  const applyBody = settings.slice(settings.indexOf('fun applyStrictSettings('));
  const alreadyOff = applyBody.slice(
    applyBody.indexOf('if (!current.strictMode) {'),
    applyBody.indexOf('return requestStrictDisable(context, isFocusActive)')
  );
  assert.ok(alreadyOff.includes('strictMode = false'), 'the already-off branch no longer records settings');
  const afterRouting = applyBody.slice(
    applyBody.indexOf('return requestStrictDisable(context, isFocusActive)')
  );
  assert.ok(
    !afterRouting.includes('strictMode = false'),
    'strict mode is written off somewhere other than the already-off branch'
  );
  // While strict-always is on, neither the always flag nor the cool-off can be lowered,
  // because either would be a shortcut to an immediate disable.
  assert.match(settings, /val lockedDown = current\.strictMode && current\.strictAlways/);
  assert.match(settings, /if \(lockedDown\) true else strictAlways/);
  assert.match(settings, /maxOf\(strictCooloffMinutes, current\.strictCooloffMinutes\)/);

  // And the cool-off always does expire: there is no permanent lock-out.
  assert.match(guard, /if \(pending != null && System\.currentTimeMillis\(\) >= pending\)/);
  assert.match(guard, /setSettings\(context, settings\.copy\(strictMode = false, pendingDisableAtMs = null\)\)/);
  assert.match(guard, /require\(strictCooloffMinutes in 0\.\.120\)/);

  // A strict change made in the app has to reach the running service, which keeps its
  // own preferences file.
  const service = await read('resources/android/shortsblock/StudyGuardAccessibilityService.kt');
  assert.match(service, /getSharedPreferences\("studybuddy_shortsblock_strict", MODE_PRIVATE\)/);
  assert.match(service, /strictPrefs\.registerOnSharedPreferenceChangeListener\(prefsListener\)/);
  assert.match(service, /strictPrefs\.unregisterOnSharedPreferenceChangeListener\(prefsListener\)/);
});

test('nothing from the screen is persisted by the stronger blocking features', async () => {
  const [browser, swipes] = await Promise.all([
    read('resources/android/shortsblock/BrowserShortsRule.kt'),
    read('resources/android/shortsblock/ReelSwipeLimiter.kt'),
  ]);
  // Browser detection must stay a pure matcher with no storage of its own.
  assert.doesNotMatch(browser, /getSharedPreferences/);
  assert.doesNotMatch(browser, /android\.util\.Log|Log\.[dive]\(/);
  // The swipe limiter stores a count and a timestamp, and nothing else.
  assert.match(swipes, /KEY_COUNT = "count"/);
  assert.doesNotMatch(swipes, /putString\(KEY_COUNT/);
});

test('the overlay permission becomes required once the chip is switched on', async () => {
  const coach = await read('resources/android/toolkit/PermissionCoach.kt');
  assert.match(coach, /import `in`\.satym\.studybuddy\.activeblocks\.ActiveBlocks/);
  assert.match(
    coach,
    /KEY_OVERLAY -> runCatching \{ ActiveBlocks\.chipEnabled\(context\) \}\.getOrDefault\(false\)/,
    'overlay is not derived from the chip toggle'
  );
});

test('the accessibility service is bound with BIND_ACCESSIBILITY_SERVICE', async () => {
  const script = await read('scripts/prepare-android.mjs');
  assert.match(script, /android:permission="android\.permission\.BIND_ACCESSIBILITY_SERVICE"/);
  assert.match(script, /android:name="android\.accessibilityservice\.AccessibilityService"/);
  assert.match(script, /android:resource="@xml\/studybuddy_shortsblock_accessibility"/);

  const config = await read('resources/android/shortsblock/xml/studybuddy_shortsblock_accessibility.xml');
  assert.match(config, /android:canRetrieveWindowContent="true"/);
  // The description is what the user reads in system settings before granting, so
  // it has to state what is inspected and that nothing is transmitted.
  assert.match(config, /android:description="@string\/studybuddy_shortsblock_accessibility_description"/);
  const strings = await read('resources/android/shortsblock/values/studybuddy_shortsblock_strings.xml');
  assert.match(strings, /No screen content, app usage, or personal data is transmitted/);
});

test('the focus home screen is disabled until the user opts in', async () => {
  const script = await read('scripts/prepare-android.mjs');
  // The HOME intent-filter makes this a candidate launcher, so it must not be
  // active out of the box; FocusLauncher.setEnabled flips the component at runtime.
  const activityBlock = script.slice(
    script.indexOf('.focuslauncher.FocusLauncherActivity'),
    script.indexOf('${toolkitMarkerEnd}')
  );
  assert.ok(activityBlock.includes('android:enabled="false"'), 'FocusLauncherActivity is not disabled by default');
  assert.ok(activityBlock.includes('android.intent.category.HOME'));

  const launcher = await read('resources/android/focuslauncher/FocusLauncher.kt');
  assert.match(launcher, /fun setEnabled\(context: Context, enabled: Boolean\)/);
  assert.match(launcher, /COMPONENT_ENABLED_STATE_DISABLED/);
});

test('package visibility is the narrow queries form, never QUERY_ALL_PACKAGES', async () => {
  const script = await read('scripts/prepare-android.mjs');
  assert.match(script, /<!-- StudyBuddy launchable app visibility -->/);
  assert.match(script, /<queries>/);
  assert.match(script, /android\.intent\.category\.LAUNCHER/);
  // <queries> is a child of <manifest>, so it is inserted before <application>.
  assert.match(script, /manifest\.replace\('<application', `\$\{queries\}\s*<application`\)/);
  // The script names QUERY_ALL_PACKAGES in a comment explaining why it is avoided,
  // so the assertion targets the two ways it could actually be requested.
  assert.doesNotMatch(script, /addPermission\([^)]*QUERY_ALL_PACKAGES/);
  assert.doesNotMatch(script, /android:name="android\.permission\.QUERY_ALL_PACKAGES"/);

  const manifestSources = await collectFiles('resources/android', ['.xml']);
  for (const file of manifestSources) {
    const contents = await read(file);
    assert.doesNotMatch(contents, /QUERY_ALL_PACKAGES/, `${file} requests QUERY_ALL_PACKAGES`);
  }
});

test('the toolkit permissions are requested and the invite filter is added once', async () => {
  const script = await read('scripts/prepare-android.mjs');
  assert.match(script, /addPermission\(manifest, 'android\.permission\.FOREGROUND_SERVICE_MEDIA_PLAYBACK'\)/);
  assert.match(script, /addPermission\(manifest, 'android\.permission\.ACCESS_NOTIFICATION_POLICY'\)/);

  assert.match(script, /<!-- StudyBuddy invite deep link -->/);
  assert.match(script, /if \(!manifest\.includes\(inviteMarker\)\)/, 'the invite filter is not idempotent');
  assert.match(script, /android:scheme="studybuddy" android:host="invite"/);
  assert.match(
    script,
    /android:scheme="https" android:host="sbd\.satym\.in" android:pathPrefix="\/invite"/
  );
  assert.match(script, /android:autoVerify="false"/);
});

test('MainActivity registers the StudyToolkit plugin', async () => {
  const script = await read('scripts/prepare-android.mjs');
  assert.match(script, /import in\.satym\.studybuddy\.toolkit\.StudyToolkitPlugin;/);
  assert.match(script, /registerPlugin\(StudyToolkitPlugin\.class\);/);
  assert.match(script, /if \(!activity\.includes\('StudyToolkitPlugin'\)\)/, 'registration is not idempotent');
});

test('the web bridge exposes the full toolkit surface with safe web defaults', async () => {
  const bridge = await read('src/lib/studyToolkit.ts');
  assert.match(bridge, /registerPlugin<NativeStudyToolkitPlugin>\('StudyToolkit'\)/);
  assert.match(bridge, /isNativeApp\(\) && getPlatform\(\) === 'android'/);

  for (const fn of [
    'isStudyToolkitAvailable',
    'emptyToolkitStatus',
    'getToolkitStatus',
    'listSoundscapes',
    'startFocusSound',
    'pauseFocusSound',
    'resumeFocusSound',
    'stopFocusSound',
    'setFocusSoundVolume',
    'getZenConfig',
    'setZenWindows',
    'setZenEnabled',
    'zenEnterNow',
    'zenExitNow',
    'getNudgeConfig',
    'setNudgeConfig',
    'getShortsBlockConfig',
    'setShortsBlockConfig',
    'getLauncherConfig',
    'setLauncherEnabled',
    'setLauncherAllowedApps',
    'listLaunchableApps',
    'getPermissionStatus',
    'openToolkitPermission',
    'requestStrictDisable',
    'getAppRules',
    'setAppRules',
    'getAppUsageToday',
    'getActiveBlocksConfig',
    'setActiveBlocksChip',
    'setStandingNotification',
  ]) {
    assert.match(
      bridge,
      new RegExp(`export (?:async )?function ${fn}\\b`),
      `the bridge does not export ${fn}`
    );
  }

  assert.match(bridge, /export const TOOLKIT_PERMISSION_KEYS: ToolkitPermissionKey\[\]/);
  // Responses are re-validated rather than trusted, so an older APK degrades
  // to defaults instead of putting undefined into the UI.
  assert.match(bridge, /function parsePermissions\(value: unknown\): ToolkitPermissions/);
  assert.match(bridge, /function parseShortsBlockConfig\(value: unknown\): ShortsBlockConfig/);
  assert.match(bridge, /function parseAppRules\(value: unknown\): AppRule\[\]/);
  assert.match(bridge, /function parseActiveBlocksConfig\(value: unknown\): ActiveBlocksConfig/);
  assert.match(bridge, /function emptyActiveBlocksConfig\(\): ActiveBlocksConfig/);
  // Web readers must return an empty list rather than throwing when no plugin is present.
  assert.match(bridge, /if \(!plugin\) return \[\];/);
  // The web mirrors of the native bounds, so an out-of-range value never reaches the bridge.
  for (const bound of [
    'export const MAX_SWIPE_LIMIT = 200;',
    'export const MAX_STRICT_COOLOFF_MINUTES = 120;',
    'export const MAX_APP_RULES = 50;',
    'export const MAX_RULE_WINDOWS = 6;',
    'export const MAX_DAILY_LIMIT_MINUTES = 1440;',
  ]) {
    assert.ok(bridge.includes(bound), `the bridge no longer declares ${bound}`);
  }
});

test('the focus tools page is split into memoized sections with debounced slider writes', async () => {
  const view = await read('src/views/FocusTools.tsx');
  const sections = [
    'PermissionsSection',
    'SoundsSection',
    'ZenSection',
    'NudgesSection',
    'ShortsBlockSection',
    'AppLimitsSection',
    'ActiveBlocksSection',
    'LauncherSection',
    'InviteSection',
  ];
  for (const section of sections) {
    assert.ok(
      await exists(`src/components/focus-tools/${section}.tsx`),
      `missing section component: ${section}`
    );
    assert.match(view, new RegExp(`<${section}\\b`), `FocusTools no longer renders ${section}`);
    const source = await read(`src/components/focus-tools/${section}.tsx`);
    assert.match(source, new RegExp(`memo\\(function ${section}`), `${section} is not memoized`);
  }

  // A write applies the slice the plugin returned instead of re-reading everything.
  for (const applier of [
    'onSounds',
    'onZen',
    'onNudges',
    'onShortsBlock',
    'onAppRules',
    'onActiveBlocks',
    'onLauncher',
  ]) {
    assert.match(view, new RegExp(`const ${applier} = useCallback`), `missing slice applier ${applier}`);
  }

  // Slider movement is coalesced and committed on release.
  const debounce = await read('src/components/focus-tools/useDebouncedCommit.ts');
  assert.match(debounce, /export function useDebouncedCommit/);
  assert.match(debounce, /delayMs = 250/);
  assert.match(debounce, /schedule: \(value: T\) => void; commit: \(value: T\) => void/);
  for (const file of ['SoundsSection', 'ShortsBlockSection']) {
    const source = await read(`src/components/focus-tools/${file}.tsx`);
    assert.match(source, /useDebouncedCommit/, `${file} writes on every slider move`);
    assert.match(source, /onChangeEnd=\{/, `${file} does not commit on release`);
  }

  // Fixed-height skeletons, so the page does not jump when the device read lands.
  const shared = await read('src/components/focus-tools/shared.tsx');
  assert.match(shared, /export const SECTION_MIN_BODY/);
  assert.match(shared, /style=\{\{ minHeight: minBodyHeight \}\}/);
  assert.match(view, /<SectionSkeleton key=\{index\} minBodyHeight=\{height\} \/>/);
  // Collapsible below sm, always open from sm up, rendered open on the server so
  // there is no hydration mismatch.
  assert.match(shared, /aria-expanded=\{open\}/);
  assert.match(shared, /sm:block/);
  // Tap targets stay at 40px or more.
  assert.match(shared, /min-h-10 min-w-10/);
});

test('the focus tools UI covers the phase 2 blocking controls', async () => {
  const shorts = await read('src/components/focus-tools/ShortsBlockSection.tsx');
  assert.match(shorts, /swipeLimit/);
  assert.match(shorts, /blockInBrowsers/);
  assert.match(shorts, /blockTikTok/);
  // The cool-off has to be explained and counted down, not just enforced.
  assert.match(shorts, /requestStrictDisable/);
  assert.match(shorts, /cool-off/);
  assert.match(shorts, /minutesLeft/);
  assert.match(shorts, /role="status"/);
  // Strict mode is never switched off with a plain config write.
  assert.doesNotMatch(shorts, /setShortsBlockConfig\(\{ strictMode: false/);

  const limits = await read('src/components/focus-tools/AppLimitsSection.tsx');
  assert.match(limits, /setAppRules/);
  assert.match(limits, /dailyLimitMinutes/);
  assert.match(limits, /DayChips/);
  assert.match(limits, /type="time"/);
  // Today's measured use is shown against the budget.
  assert.match(limits, /role="progressbar"/);
  assert.match(limits, /usageByPackage/);

  const activeBlocks = await read('src/components/focus-tools/ActiveBlocksSection.tsx');
  assert.match(activeBlocks, /setActiveBlocksChip/);
  assert.match(activeBlocks, /setStandingNotification/);
  // The chip needs the overlay permission, so the UI offers it rather than failing.
  assert.match(activeBlocks, /openToolkitPermission\('overlay'\)/);
});

test('the focus tools page re-polls permissions when the app returns to the foreground', async () => {
  const view = await read('src/views/FocusTools.tsx');
  assert.match(view, /window\.addEventListener\('studybuddy:app-resumed', onResumed\)/);
  assert.match(view, /window\.removeEventListener\('studybuddy:app-resumed', onResumed\)/);
  // The grant buttons themselves moved into the section components.
  const permissionsSection = await read('src/components/focus-tools/PermissionsSection.tsx');
  assert.match(permissionsSection, /openToolkitPermission/);
  // On the web the page has to say why the controls are inert instead of hiding them.
  assert.match(view, /need the StudyBuddy Android app/);
  assert.match(view, /\/invite\/\$\{user\.id\}/);

  const page = await read('app/focus-tools/page.tsx');
  assert.match(page, /<AuthGuard>/);
  assert.match(page, /<Layout>/);
  assert.match(page, /FocusTools/);

  const settings = await read('src/views/Settings.tsx');
  assert.match(settings, /href="\/focus-tools"/);
});

test('invite links validate the user id before they are followed', async () => {
  const [view, page, nativeBridge] = await Promise.all([
    read('src/views/Invite.tsx'),
    read('app/invite/[userId]/page.tsx'),
    read('src/components/NativeAppBridge.tsx'),
  ]);

  assert.match(view, /useParams/);
  assert.match(view, /\^\[0-9a-fA-F\]\{24\}\$/);
  assert.match(view, /useSendFriendRequest/);
  assert.match(view, /receiverId: inviterId/);
  // Self-invite and repeat-request are ordinary outcomes, not errors to shout about.
  assert.match(view, /isSelfInvite/);
  assert.match(view, /already\|exist\|duplicate\|pending/);

  assert.match(page, /<AuthGuard>/);
  assert.match(page, /<Layout>/);

  // The deep-link handler must route invites without breaking the auth callback.
  assert.match(nativeBridge, /function nativeInvitePath\(url: string\): string \| null/);
  assert.match(nativeBridge, /protocol === 'studybuddy:' && parsed\.host === 'invite'/);
  assert.match(nativeBridge, /parsed\.host === 'sbd\.satym\.in'/);
  assert.match(nativeBridge, /window\.location\.assign\(invitePath\)/);
  assert.match(nativeBridge, /if \(!isNativeAuthCallbackUrl\(url\)\) return;/);
});

test('pure-logic Kotlin tests exist for the schedule, reminder and detection maths', async () => {
  for (const file of [
    'resources/android/toolkit-tests/ZenScheduleTest.kt',
    'resources/android/toolkit-tests/ReminderMathTest.kt',
    'resources/android/toolkit-tests/ShortFormDetectorTest.kt',
  ]) {
    assert.ok(await exists(file), `missing unit test: ${file}`);
    const contents = await read(file);
    assert.match(contents, /import org\.junit\.Test/, `${file} is not a JUnit test`);
    // They must stay JVM-only: an Android framework import would make them
    // unrunnable as plain unit tests.
    assert.doesNotMatch(contents, /^import android\./m, `${file} imports the Android framework`);
  }

  const detector = await read('resources/android/shortsblock/ShortFormDetector.kt');
  assert.match(detector, /interface AccessibilityNodeView/);
  assert.doesNotMatch(detector, /^import android\./m);
});

/** Recursively lists files under a root, skipping generated trees. */
async function collectFiles(dir: string, extensions: string[], found: string[] = []): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(path.join(process.cwd(), dir), { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'build') continue;
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(relative, extensions, found);
    } else if (extensions.includes(path.extname(entry.name))) {
      found.push(relative);
    }
  }
  return found;
}

test('no Regain identifier leaks into StudyBuddy sources', async () => {
  // The toolkit is an independent reimplementation. Any of these names appearing
  // would mean decompiled or copied material found its way in.
  const forbidden = ['blox100', 'regainapp', 'C68', 'ai.regain'];
  const files = [
    ...(await collectFiles('resources/android', ['.kt', '.java', '.xml'])),
    ...(await collectFiles('src', ['.ts', '.tsx'])),
    ...(await collectFiles('app', ['.ts', '.tsx'])),
  ];
  const offenders: string[] = [];
  for (const file of files) {
    const contents = await read(file);
    for (const token of forbidden) {
      if (contents.includes(token)) {
        offenders.push(`${file} -> ${token}`);
        break;
      }
    }
  }
  assert.deepEqual(offenders, [], `Regain identifiers found:\n${offenders.join('\n')}`);
});
