/**
 * Google sign-in for the Android APK.
 *
 * Problem this solves: tapping "Continue with Google" used to navigate the
 * WebView to Google, and because Google refuses OAuth inside embedded WebViews
 * Capacitor handed the URL to an external Chrome tab. The session cookie was
 * then set in Chrome, which the app's WebView cannot read, so the user was
 * bounced out of the app and never actually signed in.
 *
 * What happens instead:
 *  1. Generate a PKCE verifier here and send only its SHA-256 challenge.
 *  2. Open the flow in an in-app Custom Tab (a real browser surface, which
 *     Google permits, presented inside the app task).
 *  3. The backend returns to `studybuddy://auth/callback?code=...` with a
 *     single-use code and no session cookie for the browser.
 *  4. This module exchanges that code plus the verifier from the WebView, so
 *     `connect.sid` is set in the app's own cookie jar.
 *
 * On web/desktop these helpers report unsupported and the existing redirect
 * flow is used unchanged.
 */

import { registerPlugin } from '@capacitor/core';
import { API_URL, apiFetch } from '@/config/api';
import { getPlatform, isNativeApp } from '@/lib/capacitor';

interface AuthBridgePlugin {
  openAuthSession(options: { url: string }): Promise<{ opened: boolean; surface?: string }>;
  closeAuthSession(): Promise<{ closed: boolean }>;
}

const AuthBridge = registerPlugin<AuthBridgePlugin>('AuthBridge');

/** Custom scheme registered by the Android manifest (see scripts/prepare-android.mjs). */
export const NATIVE_AUTH_CALLBACK_PREFIX = 'studybuddy://auth/callback';
const VERIFIER_STORAGE_KEY = 'sb_google_pkce_verifier_v1';

export type NativeGoogleSignInResult =
  | { status: 'unsupported' }
  | { status: 'started' }
  | { status: 'completed'; onboardingDone: boolean }
  | { status: 'cancelled'; message: string }
  | { status: 'error'; code?: string; message: string };

/** Only the Android shell has the Custom Tab bridge and the deep-link handler. */
export function supportsNativeGoogleSignIn(): boolean {
  return isNativeApp() && getPlatform() === 'android';
}

const base64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** 32 random bytes → 43-character base64url, which is what the backend validates. */
const createVerifier = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
};

const createChallenge = async (verifier: string): Promise<string> => {
  if (!crypto.subtle) {
    // Requires a secure context. The APK loads the app over HTTPS, so this is
    // only reachable in an unexpected configuration.
    throw new Error('Secure crypto is unavailable, so Google sign-in cannot start.');
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
};

const rememberVerifier = (verifier: string): void => {
  try {
    window.sessionStorage.setItem(VERIFIER_STORAGE_KEY, verifier);
  } catch {
    /* Storage can be unavailable; the in-memory copy below still covers the common path. */
  }
  inMemoryVerifier = verifier;
};

let inMemoryVerifier: string | null = null;

const takeVerifier = (): string | null => {
  let stored: string | null = null;
  try {
    stored = window.sessionStorage.getItem(VERIFIER_STORAGE_KEY);
    window.sessionStorage.removeItem(VERIFIER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  const verifier = stored || inMemoryVerifier;
  inMemoryVerifier = null;
  return verifier;
};

/** Opens the Google consent screen in an in-app Custom Tab. */
export async function startNativeGoogleSignIn(): Promise<NativeGoogleSignInResult> {
  if (!supportsNativeGoogleSignIn()) return { status: 'unsupported' };
  try {
    const verifier = createVerifier();
    const challenge = await createChallenge(verifier);
    rememberVerifier(verifier);
    const url = `${window.location.origin}${API_URL}/auth/google?platform=android&code_challenge=${encodeURIComponent(challenge)}`;
    await AuthBridge.openAuthSession({ url });
    return { status: 'started' };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Google sign-in could not be started.',
    };
  }
}

export function isNativeAuthCallbackUrl(url: string): boolean {
  return typeof url === 'string' && url.startsWith(NATIVE_AUTH_CALLBACK_PREFIX);
}

const ERROR_MESSAGES: Record<string, string> = {
  google_denied: 'Google sign-in was cancelled.',
  google_failed: 'Google sign-in failed. Please try again.',
  google_not_configured: 'Google sign-in is not configured yet.',
  google_invalid_state: 'Google sign-in session expired. Please try again.',
  google_unverified_email: 'Google account email is not verified.',
};

/**
 * Completes sign-in for a `studybuddy://auth/callback` deep link. The session
 * cookie is only created by this request, inside the app WebView.
 */
export async function completeNativeGoogleSignIn(callbackUrl: string): Promise<NativeGoogleSignInResult> {
  if (!isNativeAuthCallbackUrl(callbackUrl)) return { status: 'unsupported' };

  const closeBrowser = () => AuthBridge.closeAuthSession().catch(() => undefined);
  let query = '';
  const separator = callbackUrl.indexOf('?');
  if (separator >= 0) query = callbackUrl.slice(separator + 1);
  const params = new URLSearchParams(query);

  const errorCode = params.get('error');
  if (errorCode) {
    takeVerifier();
    await closeBrowser();
    return {
      status: errorCode === 'google_denied' ? 'cancelled' : 'error',
      code: errorCode,
      message: ERROR_MESSAGES[errorCode] || 'Google sign-in failed. Please try again.',
    };
  }

  const code = params.get('code');
  const verifier = takeVerifier();
  if (!code || !verifier) {
    await closeBrowser();
    return {
      status: 'error',
      message: 'This sign-in attempt could not be verified. Please start Google sign-in again.',
    };
  }

  try {
    const response = await apiFetch('/auth/google/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, codeVerifier: verifier }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { authenticated?: boolean; onboardingDone?: boolean; error?: string; message?: string }
      | null;
    if (!response.ok || !payload?.authenticated) {
      await closeBrowser();
      return {
        status: 'error',
        message: payload?.message || payload?.error || 'Google sign-in could not be completed.',
      };
    }
    await closeBrowser();
    return { status: 'completed', onboardingDone: payload.onboardingDone === true };
  } catch {
    await closeBrowser();
    return { status: 'error', message: 'No connection while completing Google sign-in.' };
  }
}
