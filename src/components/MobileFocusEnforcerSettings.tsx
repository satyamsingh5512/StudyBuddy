'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isNativeApp } from '@/lib/capacitor';
import {
  disableNativeFocusEnforcer,
  enableNativeFocusEnforcer,
  nativeFocusStatus,
  openOverlaySettings,
  openUsageAccessSettings,
} from '@/lib/nativeFocusEnforcer';

export default function MobileFocusEnforcerSettings() {
  const [native, setNative] = useState(false);
  const [status, setStatus] = useState<{
    usageAccess: boolean;
    overlay: boolean;
    enabled: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');

  const refresh = useCallback(async () => {
    if (!isNativeApp()) return;
    setNative(true);
    setStatus(await nativeFocusStatus());
  }, []);

  useEffect(() => {
    void refresh();
    window.addEventListener('studybuddy:app-resumed', refresh);
    return () => window.removeEventListener('studybuddy:app-resumed', refresh);
  }, [refresh]);

  if (!native) return null;

  const enable = async () => {
    setBusy(true);
    if (!status?.usageAccess) {
      setHint('Grant Usage Access in Android Settings, then return here to continue.');
      await openUsageAccessSettings();
    } else if (!status.overlay) {
      setHint('Allow “Display over other apps” for StudyBuddy, then return here to continue.');
      await openOverlaySettings();
    } else {
      const next = await enableNativeFocusEnforcer();
      setStatus(next);
      setHint(next?.enabled ? 'Phone-wide focus reminders are enabled.' : 'Unable to start the focus guard.');
    }
    await refresh();
    setBusy(false);
  };

  const disable = async () => {
    setBusy(true);
    const next = await disableNativeFocusEnforcer();
    setStatus(next);
    setHint('Phone-wide focus reminders are disabled.');
    setBusy(false);
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      <div className="flex gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden />
        <div>
          <p className="text-sm font-medium">Phone-wide focus guard (Android)</p>
          <p className="mt-1 text-xs text-muted-foreground">
            With your permission, StudyBuddy checks only the current foreground app while a remote focus session is active.
            It ignores StudyBuddy itself, displays a reminder over other apps, and ends the session after 2.5 minutes of continued phone use.
            It never records app history, locks the phone, or force-stops apps.
          </p>
        </div>
      </div>
      {hint && <p className="text-xs text-muted-foreground" role="status">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {status?.enabled ? (
          <Button type="button" variant="outline" size="sm" onClick={() => void disable()} disabled={busy}>
            {busy ? 'Updating…' : 'Disable phone-wide guard'}
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => void enable()} disabled={busy}>
            {busy
              ? 'Opening settings…'
              : !status?.usageAccess
                ? 'Grant Usage Access'
                : !status.overlay
                  ? 'Allow reminder overlay'
                  : 'Enable phone-wide guard'}
          </Button>
        )}
      </div>
    </div>
  );
}
