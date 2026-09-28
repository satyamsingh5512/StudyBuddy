import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const read = (file: string) => readFile(path.join(process.cwd(), file), 'utf8');

/**
 * Guards for the bug classes found while diagnosing the "This page could not
 * load" crash. Each one was a real defect, not a hypothetical.
 */

test('permission dispatch stays lazy (one settings screen per tap)', async () => {
  const source = await read('src/lib/digitalDiscipline.ts');

  // An object literal keyed by the argument evaluates EVERY branch, which fired
  // all four settings intents at once and produced unhandled rejections.
  assert.match(source, /switch \(permission\)/, 'permission dispatch must use a switch');
  assert.doesNotMatch(
    source,
    /\{\s*usage: plugin\.openUsageAccessSettings\(\)/,
    'do not reintroduce the eager object-literal dispatch'
  );
});

test('native settings launches have a fallback chain and report failure', async () => {
  const plugin = await read('resources/android/FocusEnforcerPlugin.java');

  assert.match(plugin, /launchFirstAvailable/, 'settings launches must try multiple destinations');
  assert.match(plugin, /ACTION_USAGE_ACCESS_SETTINGS, self/, 'prefer the app-specific Usage Access deep link');
  assert.match(plugin, /call\.reject\(/, 'an unopenable screen must reject so the UI can explain it');
  // The original single unguarded call threw ActivityNotFoundException.
  assert.doesNotMatch(
    plugin,
    /getActivity\(\)\.startActivity\(new Intent\(Settings\.ACTION_USAGE_ACCESS_SETTINGS\)\);/,
    'do not reintroduce the unguarded single-intent launch'
  );
});

test('settings-launch errors are surfaced, not swallowed', async () => {
  const lib = await read('src/lib/nativeFocusEnforcer.ts');
  const ui = await read('src/components/MobileFocusEnforcerSettings.tsx');

  // `.catch(() => null)` on a user-initiated action made the button look dead.
  assert.doesNotMatch(
    lib,
    /openUsageAccessSettings\(\)\.catch\(\(\) => null\)/,
    'do not swallow Usage Access launch failures'
  );
  assert.doesNotMatch(
    lib,
    /openOverlaySettings\(\)\.catch\(\(\) => null\)/,
    'do not swallow overlay launch failures'
  );
  // Read-only status may stay tolerant.
  assert.match(lib, /getStatus\(\)\.catch\(\(\) => null\)/, 'status reads may remain best-effort');

  assert.match(ui, /catch \(cause\)/, 'the UI must catch launch failures');
  assert.match(ui, /role="alert"/, 'the failure must be announced accessibly');
});

test('Digital Discipline handlers report native rejections', async () => {
  const view = await read('src/views/DigitalDiscipline.tsx');

  // try/finally with no catch turned every native rejection into an unhandled
  // promise rejection with no user-visible feedback.
  const finallyCount = (view.match(/\} finally \{/g) || []).length;
  const catchCount = (view.match(/\} catch \(error\) \{/g) || []).length;
  assert.ok(
    catchCount >= finallyCount,
    `every try/finally handler needs a catch (finally=${finallyCount}, catch=${catchCount})`
  );
  assert.match(view, /reportFailure/, 'failures should route through the shared reporter');

  // `a?.b[c]` only short-circuits on `a`; a missing featureFlags object threw.
  assert.doesNotMatch(view, /diagnostics\?\.featureFlags\[/, 'index featureFlags with ?.[ ]');
});

test('Android services cannot be killed by a failed app launch', async () => {
  const [java, kotlin] = await Promise.all([
    read('resources/android/FocusEnforcerService.java'),
    read('resources/android/digitaldiscipline/ConsumerEnforcementService.kt'),
  ]);

  // An uncaught throw on a service's main thread terminates the service.
  const javaLaunch = java.slice(java.indexOf('openStudyBuddy.setOnClickListener'));
  assert.match(javaLaunch.slice(0, 500), /try \{[\s\S]*startActivity\(launch\);/, 'guard startActivity in the focus service');
  assert.match(kotlin, /runCatching \{ startActivity\(launch\) \}/, 'guard startActivity in the enforcement service');
});
