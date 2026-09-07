import { registerPlugin } from '@capacitor/core';
import { getDeviceId, isNativeApp } from '@/lib/capacitor';

interface FocusEnforcerStatus {
  usageAccess: boolean;
  overlay: boolean;
  enabled: boolean;
}

interface FocusEnforcerPlugin {
  getStatus(): Promise<FocusEnforcerStatus>;
  openUsageAccessSettings(): Promise<FocusEnforcerStatus>;
  openOverlaySettings(): Promise<FocusEnforcerStatus>;
  enable(options: { apiBaseUrl: string; deviceId: string; graceMs: number }): Promise<FocusEnforcerStatus>;
  disable(): Promise<FocusEnforcerStatus>;
}

const FocusEnforcer = registerPlugin<FocusEnforcerPlugin>('FocusEnforcer');
const STUDYBUDDY_FOCUS_API = 'https://sbd.satym.in/api';

const plugin = (): FocusEnforcerPlugin | null => (isNativeApp() ? FocusEnforcer : null);

export async function nativeFocusStatus(): Promise<FocusEnforcerStatus | null> {
  const native = plugin();
  return native ? native.getStatus().catch(() => null) : null;
}

export async function openUsageAccessSettings(): Promise<FocusEnforcerStatus | null> {
  const native = plugin();
  return native ? native.openUsageAccessSettings().catch(() => null) : null;
}

export async function openOverlaySettings(): Promise<FocusEnforcerStatus | null> {
  const native = plugin();
  return native ? native.openOverlaySettings().catch(() => null) : null;
}

export async function enableNativeFocusEnforcer(): Promise<FocusEnforcerStatus | null> {
  const native = plugin();
  return native
    ? native
        .enable({ apiBaseUrl: STUDYBUDDY_FOCUS_API, deviceId: getDeviceId(), graceMs: 150_000 })
        .catch(() => null)
    : null;
}

export async function disableNativeFocusEnforcer(): Promise<FocusEnforcerStatus | null> {
  const native = plugin();
  return native ? native.disable().catch(() => null) : null;
}
