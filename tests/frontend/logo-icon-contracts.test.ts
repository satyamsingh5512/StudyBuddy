import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const read = (file: string) => readFile(path.join(process.cwd(), file), 'utf8');

/** The three shapes that define the StudyBuddy mark in src/components/Logo.tsx. */
const LOGO_PATHS = [
  'M8 10 L8 30 L20 28 L20 8 Z',
  'M20 8 L20 28 L32 30 L32 10 Z',
  'M18 6 L18 16 L20 14 L22 16 L22 6 Z',
];

/** Same geometry in Android vector `pathData` form (comma-separated coordinates). */
const ANDROID_LOGO_PATHS = [
  'M8,10 L8,30 L20,28 L20,8 Z',
  'M20,8 L20,28 L32,30 L32,10 Z',
  'M18,6 L18,16 L20,14 L22,16 L22,6 Z',
];

test('icon sources reuse the exact in-app logo geometry', async () => {
  const [logo, iconSvg, foregroundSvg, favicon] = await Promise.all([
    read('src/components/Logo.tsx'),
    read('resources/logo/studybuddy-icon.svg'),
    read('resources/logo/studybuddy-icon-foreground.svg'),
    read('public/favicon.svg'),
  ]);

  for (const shape of LOGO_PATHS) {
    assert.ok(logo.includes(shape), `Logo.tsx no longer contains ${shape}`);
    assert.ok(iconSvg.includes(shape), `app icon source drifted from the logo: ${shape}`);
    assert.ok(foregroundSvg.includes(shape), `adaptive foreground drifted from the logo: ${shape}`);
    assert.ok(favicon.includes(shape), `favicon drifted from the logo: ${shape}`);
  }

  // The adaptive foreground must stay inside Android's 72dp safe zone.
  assert.match(foregroundSvg, /viewBox="0 0 108 108"/);
  assert.match(foregroundSvg, /translate\(18 18\) scale\(1\.8\)/);
});

test('Android launcher and notification artwork use the logo, not template icons', async () => {
  const [adaptive, roundAdaptive, foreground, monochrome, background, colors, prepare] = await Promise.all([
    read('resources/android/launcher/mipmap-anydpi-v26/ic_launcher.xml'),
    read('resources/android/launcher/mipmap-anydpi-v26/ic_launcher_round.xml'),
    read('resources/android/launcher/drawable/ic_launcher_foreground.xml'),
    read('resources/android/launcher/drawable/ic_launcher_monochrome.xml'),
    read('resources/android/launcher/drawable/ic_launcher_background.xml'),
    read('resources/android/launcher/values/ic_launcher_background.xml'),
    read('scripts/prepare-android.mjs'),
  ]);

  for (const declaration of [adaptive, roundAdaptive]) {
    assert.match(declaration, /<background android:drawable="@color\/ic_launcher_background" \/>/);
    assert.match(declaration, /<foreground android:drawable="@drawable\/ic_launcher_foreground" \/>/);
    assert.match(declaration, /<monochrome android:drawable="@drawable\/ic_launcher_monochrome" \/>/);
  }

  for (const shape of ANDROID_LOGO_PATHS) {
    assert.ok(foreground.includes(shape), `adaptive foreground vector drifted: ${shape}`);
    assert.ok(monochrome.includes(shape), `themed monochrome icon drifted: ${shape}`);
    // The status-bar icon is written by the preparation script.
    assert.ok(prepare.includes(shape), `notification icon drifted: ${shape}`);
  }

  assert.match(background, /#0F172A/);
  assert.match(colors, /<color name="ic_launcher_background">#0F172A<\/color>/);

  // The generated project must receive the tracked launcher assets, and the
  // Android Studio template drawables must be removed so they cannot win the
  // drawable-v24 qualifier on API 24+.
  assert.match(prepare, /copyDirectory\(launcherSourceDir, resTargetDir\)/);
  assert.match(prepare, /drawable-v24\/ic_launcher_foreground\.xml/);
  assert.match(prepare, /drawable-v24\/ic_launcher_background\.xml/);
});

test('service worker precache version changes when icon assets change', async () => {
  const worker = await read('public/sw.js');
  assert.match(worker, /const CACHE_NAME = 'studybuddy-static-v4'/);
  assert.match(worker, /'\/favicon\.svg'/);
  assert.match(worker, /'\/icons\/icon-192\.png'/);
  assert.match(worker, /'\/icons\/icon-512\.png'/);
});
