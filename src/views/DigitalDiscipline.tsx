'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { AlertTriangle, CheckCircle2, ExternalLink, LockKeyhole, ShieldAlert, Smartphone, Trash2, XCircle } from 'lucide-react';
import { userAtom } from '@/store/atoms';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  clearNativeFocusHistory,
  clearNativeUsageData,
  disableNativeDigitalDisciplineMonitoring,
  getDigitalDisciplineDiagnostics,
  getNativeDigitalUsageSummary,
  getProtectedApplications,
  isDigitalDisciplineNativeAvailable,
  openDigitalDisciplinePermission,
  saveProtectedApplications,
  setConsumerDigitalDisciplineMonitoring,
  setDigitalDisciplineFeatureFlags,
  type DigitalDisciplineDiagnostics,
  type DigitalUsageSummary,
  type ProtectedApplication,
  type ProtectedAppPolicy,
} from '@/lib/digitalDiscipline';

const formatDuration = (milliseconds?: number) => {
  const seconds = Math.max(0, Math.floor((milliseconds ?? 0) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

type PermissionKey = 'usage' | 'overlay' | 'notifications' | 'battery';

export default function DigitalDiscipline() {
  const user = useAtomValue(userAtom);
  const { toast } = useToast();
  const [diagnostics, setDiagnostics] = useState<DigitalDisciplineDiagnostics | null>(null);
  const [usage, setUsage] = useState<DigitalUsageSummary | null>(null);
  const [apps, setApps] = useState<ProtectedApplication[]>([]);
  const [packageName, setPackageName] = useState('');
  const [policy, setPolicy] = useState<ProtectedAppPolicy>('INTERVENE');
  const [busy, setBusy] = useState(false);

  const nativeAvailable = isDigitalDisciplineNativeAvailable();
  const userId = user?.id ?? '';

  const refresh = useCallback(async () => {
    if (!nativeAvailable || !userId) return;
    try {
      const [nextDiagnostics, nextUsage, nextApps] = await Promise.all([
        getDigitalDisciplineDiagnostics(),
        getNativeDigitalUsageSummary(userId),
        getProtectedApplications(userId),
      ]);
      setDiagnostics(nextDiagnostics);
      setUsage(nextUsage);
      setApps(nextApps);
    } catch (error) {
      toast({
        title: 'Digital Discipline needs attention',
        description: error instanceof Error ? error.message : 'Could not read local Android status.',
        variant: 'destructive',
      });
    }
  }, [nativeAvailable, toast, userId]);

  useEffect(() => {
    void refresh();
    window.addEventListener('studybuddy:app-resumed', refresh);
    return () => window.removeEventListener('studybuddy:app-resumed', refresh);
  }, [refresh]);

  const permissions = useMemo(() => [
    {
      key: 'usage' as PermissionKey,
      name: 'Usage Access',
      granted: diagnostics?.usageAccess ?? false,
      why: 'Reads aggregate app foreground time locally for your device analytics and configured rules. It does not read app content.',
    },
    {
      key: 'overlay' as PermissionKey,
      name: 'Intervention overlay',
      granted: diagnostics?.overlay ?? false,
      why: 'Shows the visible 10-second consumer intervention over a configured distracting app. Without it, no consumer intervention is started.',
    },
    {
      key: 'notifications' as PermissionKey,
      name: 'Notifications',
      granted: diagnostics?.notifications ?? false,
      why: 'Keeps the user-enabled foreground service visible and lets Android show delivery status. Monitoring still has a clear fallback if denied.',
    },
    {
      key: 'battery' as PermissionKey,
      name: 'Battery optimization',
      granted: diagnostics?.batteryOptimizationsIgnored ?? false,
      why: 'Optional OEM reliability setting. StudyBuddy never changes this automatically; background service reliability may be lower when it remains optimized.',
    },
  ], [diagnostics]);

  if (!nativeAvailable) {
    return (
      <div className="mx-auto max-w-4xl space-y-5 pb-12">
        <div className="pt-4"><h1 className="text-3xl font-bold">Digital Discipline</h1><p className="mt-1 text-sm text-muted-foreground">Local device analytics and enforcement are available only in the StudyBuddy Android app.</p></div>
        <Card className="p-6"><div className="flex gap-3"><Smartphone className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><div><p className="font-semibold">Android capability required</p><p className="mt-1 text-sm text-muted-foreground">The web version remains a normal StudyBuddy experience. It does not claim to monitor or control other apps.</p></div></div></Card>
      </div>
    );
  }

  const openPermission = async (key: PermissionKey) => {
    setBusy(true);
    try {
      await openDigitalDisciplinePermission(key);
      toast({
        title: 'Android Settings opened',
        description: 'Grant the permission if it matches what you want. Return to this page to verify.',
      });
    } finally {
      // Keep busy true until user returns and refreshes
      setTimeout(() => setBusy(false), 500);
    }
  };

  const updateConsumerMonitoring = async (enabled: boolean) => {
    setBusy(true);
    try {
      const next = await setConsumerDigitalDisciplineMonitoring(userId, enabled);
      setDiagnostics(next);
      toast({
        title: enabled && next?.consumerMonitoringEnabled ? 'Consumer Digital Discipline enabled' : 'Consumer Digital Discipline not enabled',
        description: enabled && !next?.consumerMonitoringEnabled
          ? 'Usage Access and overlay permission are both required; no monitoring was started.'
          : enabled ? 'Configured app rules can now show a transparent intervention during an active native focus session.' : 'Consumer monitoring is disabled.',
      });
    } finally {
      setBusy(false);
    }
  };

  const addProtectedApp = () => {
    const normalized = packageName.trim();
    if (!/^[A-Za-z0-9_.$]+$/.test(normalized)) {
      toast({ title: 'Enter a package name', description: 'Example: com.instagram.android. StudyBuddy does not request a broad installed-app inventory.', variant: 'destructive' });
      return;
    }
    setApps((current) => [
      ...current.filter((app) => app.packageName !== normalized),
      { packageName: normalized, displayName: normalized, category: 'SOCIAL', policy, scheduleType: 'FOCUS_SESSIONS' },
    ]);
    setPackageName('');
  };

  const persistApps = async () => {
    setBusy(true);
    try {
      const saved = await saveProtectedApplications(userId, apps);
      toast({ title: 'Rules saved locally', description: `${saved} configured app${saved === 1 ? '' : 's'} will use your selected policy during focus.` });
    } finally {
      setBusy(false);
    }
  };

  const setFlag = async (name: 'usageAnalytics' | 'antiDoomscroll' | 'strictFocus' | 'hardcoreFocus' | 'studyRoomFocus', enabled: boolean) => {
    setBusy(true);
    try {
      const next = await setDigitalDisciplineFeatureFlags(userId, { [name]: enabled });
      setDiagnostics(next);
    } finally {
      setBusy(false);
    }
  };

  const deleteLocal = async (action: 'usage' | 'focus' | 'disable') => {
    setBusy(true);
    try {
      if (action === 'usage') await clearNativeUsageData(userId);
      if (action === 'focus') await clearNativeFocusHistory(userId);
      if (action === 'disable') await disableNativeDigitalDisciplineMonitoring();
      await refresh();
      toast({ title: action === 'disable' ? 'Monitoring disabled' : 'Local data cleared', description: 'The operation affects this device only. Existing StudyBuddy account data is unchanged.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-12">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 pt-4">
        <div className="min-w-0"><h1 className="text-3xl font-bold">Digital Discipline</h1><p className="mt-1 text-sm text-muted-foreground">Local-first Android measurement and user-configured, explainable interventions.</p></div>
        <span className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${diagnostics?.controlLevel === 'MANAGED' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>Device Control Level: {diagnostics?.controlLevel === 'MANAGED' ? 'Managed' : 'Standard'}</span>
      </div>

      <Card><CardHeader><CardTitle>Today — local estimates</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ['Screen Time', formatDuration(usage?.screenTimeMs)], ['Study Time', formatDuration(usage?.studyTimeMs)], ['Focus Time', formatDuration(usage?.focusTimeMs)],
          ['Doomscroll Time', formatDuration(usage?.doomscrollTimeMs)], ['Blocked Attempts', String(usage?.blockedAttempts ?? 0)], ['Time Recovered', `~${formatDuration(usage?.estimatedRecoveredMs)}`],
        ].map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-hairline bg-surface-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate text-lg font-semibold tabular-nums">{value}</p></div>)}
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="flex items-center justify-between gap-3">Permission Center <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void refresh()}>Refresh</Button></CardTitle></CardHeader><CardContent className="space-y-3">
        {permissions.map((permission) => <div key={permission.key} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline p-3"><div className="min-w-0 flex-1"><p className="flex items-center gap-2 text-sm font-semibold">{permission.granted ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />}{permission.name}: {permission.granted ? 'Granted' : 'Not Granted'}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{permission.why}</p></div><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void openPermission(permission.key)}>{permission.granted ? 'Verify' : 'Open Settings'} <ExternalLink className="ml-1 h-3.5 w-3.5" aria-hidden="true" /></Button></div>)}
        <p className="text-xs text-muted-foreground">Accessibility: not used. StudyBuddy currently registers no AccessibilityService and does not read screen content or perform autonomous actions.</p>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Consumer Anti-Doomscroll</CardTitle></CardHeader><CardContent className="space-y-4"><div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-sm"><p className="font-medium">Supported consumer action: visible intervention and return to StudyBuddy</p><p className="mt-1 text-xs leading-5 text-muted-foreground">During an active local focus session, a configured app with <strong>Intervene</strong> or <strong>Block</strong> policy receives a deterministic 10-second overlay. “Block” means the same consumer intervention unless this device has separately provisioned managed-device authority; it does not force-stop the app.</p></div>
        <div className="flex flex-wrap gap-2"><Button type="button" disabled={busy || diagnostics?.consumerMonitoringEnabled} onClick={() => void updateConsumerMonitoring(true)}>Enable consumer monitoring</Button><Button type="button" variant="outline" disabled={busy || !diagnostics?.consumerMonitoringEnabled} onClick={() => void updateConsumerMonitoring(false)}>Disable consumer monitoring</Button></div>
        <div className="grid gap-3 rounded-xl border border-hairline p-3 sm:grid-cols-[1fr_auto_auto]"><div><Label htmlFor="protected-package">Protected app package</Label><Input id="protected-package" value={packageName} onChange={(event) => setPackageName(event.target.value)} placeholder="com.instagram.android" autoCapitalize="none" autoCorrect="off" /></div><div><Label htmlFor="protected-policy">Policy</Label><select id="protected-policy" value={policy} onChange={(event) => setPolicy(event.target.value as ProtectedAppPolicy)} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="WARN">Warn</option><option value="INTERVENE">Intervene</option><option value="BLOCK">Block (managed only when available)</option><option value="ALLOW">Allow</option></select></div><Button type="button" className="self-end" variant="outline" onClick={addProtectedApp}>Add</Button></div>
        <ul className="space-y-2">{apps.map((app) => <li key={app.packageName} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-hairline p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{app.displayName || app.packageName}</p><p className="truncate font-mono text-xs text-muted-foreground">{app.packageName} · {app.policy.toLowerCase()} during focus</p></div><Button type="button" size="icon" variant="ghost" aria-label={`Remove ${app.packageName}`} onClick={() => setApps((current) => current.filter((candidate) => candidate.packageName !== app.packageName))}><XCircle className="h-4 w-4" aria-hidden="true" /></Button></li>)}</ul>
        <Button type="button" disabled={busy} onClick={() => void persistApps()}>Save protected-app rules</Button>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Focus and rollout controls</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{([
        ['usageAnalytics', 'Usage analytics', 'Aggregate UsageStats locally every six hours when Usage Access is granted.'],
        ['antiDoomscroll', 'Anti-doomscroll', 'Enables user-configured deterministic rule evaluation.'],
        ['strictFocus', 'Strict Focus', 'Makes native focus available alongside existing StudyBuddy sessions.'],
        ['hardcoreFocus', 'Hardcore Focus', 'Requires a Keystore-protected local unlock credential and managed capability for strong enforcement.'],
        ['studyRoomFocus', 'Study Room Focus', 'Associates a joined room session with locally calculated focus time.'],
      ] as const).map(([key, title, detail]) => <div key={key} className="flex items-start justify-between gap-3 rounded-xl border border-hairline p-3"><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div><Button type="button" size="sm" variant={diagnostics?.featureFlags[key] ? 'default' : 'outline'} disabled={busy} onClick={() => void setFlag(key, !diagnostics?.featureFlags[key])}>{diagnostics?.featureFlags[key] ? 'On' : 'Off'}</Button></div>)}</CardContent></Card>

      <Card><CardHeader><CardTitle>Managed Device / Hardcore Enforcement</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><p className="text-sm text-muted-foreground">{diagnostics?.deviceOwner ? 'This device reports Device Owner status. Managed lock-task and package-suspension calls remain explicit and require verified provisioning.' : 'This is not a managed device. Consumer mode cannot lock the phone, force-stop apps, or suspend packages. Device Owner provisioning is a separate administrative process and is never enabled from this screen.'}</p></div><p className="text-xs text-muted-foreground">Use the repository’s MANAGED_DEVICE_SETUP.md before testing Device Owner mode. Preserve emergency access and a documented recovery path.</p></CardContent></Card>

      <Card><CardHeader><CardTitle>Local privacy controls</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => void deleteLocal('usage')}><Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />Delete usage data</Button><Button type="button" variant="outline" disabled={busy} onClick={() => void deleteLocal('focus')}>Clear focus history</Button><Button type="button" variant="destructive" disabled={busy} onClick={() => void deleteLocal('disable')}><ShieldAlert className="mr-1.5 h-4 w-4" aria-hidden="true" />Disable monitoring</Button></CardContent></Card>
    </div>
  );
}
