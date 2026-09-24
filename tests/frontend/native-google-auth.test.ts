import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const read = (file: string) => readFile(path.join(process.cwd(), file), 'utf8');

test('Android Google sign-in uses an in-app Custom Tab, never the WebView', async () => {
  const [plugin, bridge] = await Promise.all([
    read('resources/android/auth/AuthBridgePlugin.kt'),
    read('src/lib/nativeGoogleAuth.ts'),
  ]);

  // A Custom Tab is a real browser surface; Google rejects embedded WebViews.
  assert.match(plugin, /CustomTabsIntent/);
  assert.match(plugin, /@CapacitorPlugin\(name = "AuthBridge"\)/);
  // The bridge must not be usable to launch arbitrary destinations.
  assert.match(plugin, /allowedOrigin = "https:\/\/sbd\.satym\.in"/);
  assert.match(plugin, /call\.reject\("Only StudyBuddy sign-in URLs can be opened\."\)/);

  assert.match(bridge, /registerPlugin<AuthBridgePlugin>\('AuthBridge'\)/);
  assert.match(bridge, /isNativeApp\(\) && getPlatform\(\) === 'android'/);
});

test('native sign-in is PKCE bound and exchanges a code rather than reusing a browser session', async () => {
  const bridge = await read('src/lib/nativeGoogleAuth.ts');

  assert.match(bridge, /crypto\.getRandomValues/);
  assert.match(bridge, /crypto\.subtle\.digest\('SHA-256'/);
  assert.match(bridge, /platform=android&code_challenge=/);
  assert.match(bridge, /'\/auth\/google\/exchange'/);
  assert.match(bridge, /codeVerifier: verifier/);
  // The verifier must never leave the device.
  assert.doesNotMatch(bridge, /code_verifier=/);
  // The callback deep link is the only accepted completion trigger.
  assert.match(bridge, /NATIVE_AUTH_CALLBACK_PREFIX = 'studybuddy:\/\/auth\/callback'/);
});

test('deep link completion is wired into the native app bridge', async () => {
  const nativeBridge = await read('src/components/NativeAppBridge.tsx');
  assert.match(nativeBridge, /appUrlOpen/);
  assert.match(nativeBridge, /isNativeAuthCallbackUrl\(url\)/);
  assert.match(nativeBridge, /completeNativeGoogleSignIn\(url\)/);
});

test('both Google entry points prefer the in-app flow on Android', async () => {
  const [auth, landing] = await Promise.all([
    read('src/views/Auth.tsx'),
    read('src/views/Landing.tsx'),
  ]);

  for (const [name, source] of [['Auth', auth], ['Landing', landing]] as const) {
    assert.match(source, /supportsNativeGoogleSignIn\(\)/, `${name} does not check native support`);
    assert.match(source, /startNativeGoogleSignIn\(\)/, `${name} does not start the native flow`);
  }
  // The web path must remain the plain redirect.
  assert.match(auth, /window\.location\.href = `\$\{API_URL\}\/auth\/google`/);
  assert.match(landing, /href="\/api\/auth\/google"/);
  assert.match(landing, /event\.preventDefault\(\)/);
});

test('Android manifest registers the OAuth deep link and the auth bridge', async () => {
  const prepare = await read('scripts/prepare-android.mjs');
  assert.match(prepare, /StudyBuddy OAuth deep link/);
  assert.match(prepare, /android:scheme="studybuddy" android:host="auth"/);
  assert.match(prepare, /android\.intent\.category\.BROWSABLE/);
  assert.match(prepare, /registerPlugin\(AuthBridgePlugin\.class\)/);
  assert.match(prepare, /androidx\.browser:browser:1\.8\.0/);
});
