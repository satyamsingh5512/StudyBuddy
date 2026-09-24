'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isNativeApp } from '@/lib/capacitor';
import {
  disableNativeFocusEnforcer,
  enableNativeFocusEnforcer,
  nativeFocusStatus,
  openOverlaySettings,
  openUsageAccessSettings,
} from '@/lib/nativeFocusEnforcer';

type PermissionStep = 'usageAccess' | 'overlay' | 'done';

export default function MobileFocusEnforcerSettings() {
  const [native, setNative] = useState(false);
  const [status, setStatus] = useState<{
    usageAccess: boolean;
    overlay: boolean;
    enabled: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [currentStep, setCurrentStep] = useState<PermissionStep | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!isNativeApp()) return;
    setNative(true);
    const newStatus = await nativeFocusStatus();
    setStatus(newStatus);
    // Auto-clear step indicator when both permissions are granted
    if (newStatus?.usageAccess && newStatus?.overlay) {
      setCurrentStep('done');
    }
  }, []);

  useEffect(() => {
    void refresh();
    window.addEventListener('studybuddy:app-resumed', refresh);
    // Also refresh on visibility change for faster feedback
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('studybuddy:app-resumed', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  if (!native) return null;

  const determineNextStep = (): PermissionStep | null => {
    if (!status?.usageAccess) return 'usageAccess';
    if (!status.overlay) return 'overlay';
    return null;
  };

  const openSettingsForStep = async (step: PermissionStep) => {
    setBusy(true);
    setError('');
    try {
      if (step === 'usageAccess') {
        await openUsageAccessSettings();
      } else if (step === 'overlay') {
        await openOverlaySettings();
      }
      // Only show the follow-up instructions once a screen actually opened.
      setCurrentStep(step);
    } catch (cause) {
      // The native side rejects with an actionable message when the device has
      // no such settings screen. Showing it beats a button that does nothing.
      setCurrentStep(null);
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : 'Android could not open that settings screen on this device.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleEnable = async () => {
    const nextStep = determineNextStep();
    if (nextStep) {
      await openSettingsForStep(nextStep);
      return;
    }
    // Both permissions are granted: start the guard.
    setBusy(true);
    setError('');
    const next = await enableNativeFocusEnforcer();
    setStatus(next);
    if (!next?.enabled) {
      // enableNativeFocusEnforcer() resolves to null on a native rejection, so
      // an unexplained failure would otherwise leave the toggle silently off.
      setError('Android did not start the focus guard. Re-check both permissions and try again.');
    }
    setBusy(false);
  };

  const handleDisable = async () => {
    setBusy(true);
    const next = await disableNativeFocusEnforcer();
    setStatus(next);
    setBusy(false);
  };

  const handleResume = async () => {
    setBusy(true);
    await refresh();
    setBusy(false);
  };

  const needsPermissions = !status?.usageAccess || !status.overlay;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      <div className="flex gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Phone-wide focus guard (Android)</p>
          <p className="mt-1 text-xs text-muted-foreground">
            With your permission, StudyBuddy checks only the current foreground app while a remote focus session is active.
            It ignores StudyBuddy itself, displays a reminder over other apps, and ends the session after 2.5 minutes of continued phone use.
            It never records app history, locks the phone, or force-stops apps.
          </p>
        </div>
      </div>

      {/* Permission status indicators */}
      {status && needsPermissions && (
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            {status.usageAccess ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <div className="h-4 w-4 rounded-full border-2 border-amber-500" />
            )}
            <span className={status.usageAccess ? 'text-emerald-600' : ''}>
              Usage Access permission
            </span>
          </div>
          <div className="flex items-center gap-2">
            {status.overlay ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <div className="h-4 w-4 rounded-full border-2 border-amber-500" />
            )}
            <span className={status.overlay ? 'text-emerald-600' : ''}>
              Display over other apps permission
            </span>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* Step-by-step instructions when settings opened */}
      {currentStep && !currentStep.startsWith('done') && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 space-y-2">
          <p className="text-xs font-medium text-amber-600">
            {currentStep === 'usageAccess' ? (
              <>
                Step 1: Find <strong>StudyBuddy</strong> in the list, tap it, and enable <strong>&quot;Permit usage access&quot;</strong>
              </>
            ) : (
              <>
                Step 2: Enable <strong>&quot;Allow display over other apps&quot;</strong> for StudyBuddy
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Android requires you to grant these permissions manually for security. After enabling, return here.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleResume()}
            disabled={busy}
            className="w-full"
          >
            <ArrowRight className="mr-2 h-4 w-4" />
            I&apos;ve enabled the permission — continue
          </Button>
        </div>
      )}

      {/* Success message */}
      {currentStep === 'done' && status?.enabled && (
        <p className="text-xs text-emerald-600 font-medium">
          Phone-wide focus reminders are enabled.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {status?.enabled ? (
          <Button type="button" variant="outline" size="sm" onClick={() => void handleDisable()} disabled={busy}>
            {busy ? 'Updating…' : 'Disable phone-wide guard'}
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => void handleEnable()} disabled={busy}>
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
