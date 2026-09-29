'use client';

/**
 * Focus tools — the settings surface for the native study toolkit.
 *
 * Everything on this page except the invite section needs the Android app, because
 * each control maps onto an OS capability a browser has no access to: audio focus,
 * Do Not Disturb policy, exact alarms, accessibility events, an overlay window, and
 * the home-screen role. On the web the page still renders so the options are
 * discoverable, with the native sections disabled and labelled rather than hidden —
 * a blank screen would just read as broken.
 *
 * Two structural decisions worth keeping:
 *
 * 1. **Each section is its own memoized component** under src/components/focus-tools.
 *    This file only holds the device snapshot and the per-slice appliers. A write to
 *    one toggle patches only the slice it belongs to, so changing the volume does not
 *    re-render the permission checklist or the app list.
 * 2. **A write applies the payload the plugin returns, rather than re-reading
 *    everything.** Every setter on the bridge resolves the section it just changed,
 *    so one bridge round-trip is enough. A full `getToolkitStatus` is reserved for
 *    first load and for coming back to the foreground, which is the only moment a
 *    setting could have changed outside the app.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import { useToast } from '@/components/ui/use-toast';
import { Info, Loader2 } from 'lucide-react';
import {
  emptyToolkitStatus,
  getAppUsageToday,
  getToolkitStatus,
  isStudyToolkitAvailable,
  listLaunchableApps,
  listSoundscapes,
  type ActiveBlocksConfig,
  type AppRule,
  type AppUsageEntry,
  type FocusSoundStatus,
  type LaunchableApp,
  type LauncherConfig,
  type NudgeConfig,
  type ShortsBlockConfig,
  type Soundscape,
  type ToolkitStatus,
  type ZenConfig,
} from '@/lib/studyToolkit';
import { SECTION_MIN_BODY, SectionSkeleton } from '@/components/focus-tools/shared';
import { PermissionsSection } from '@/components/focus-tools/PermissionsSection';
import { SoundsSection } from '@/components/focus-tools/SoundsSection';
import { ZenSection } from '@/components/focus-tools/ZenSection';
import { NudgesSection } from '@/components/focus-tools/NudgesSection';
import { ShortsBlockSection } from '@/components/focus-tools/ShortsBlockSection';
import { AppLimitsSection } from '@/components/focus-tools/AppLimitsSection';
import { ActiveBlocksSection } from '@/components/focus-tools/ActiveBlocksSection';
import { LauncherSection } from '@/components/focus-tools/LauncherSection';
import { InviteSection } from '@/components/focus-tools/InviteSection';

export default function FocusTools() {
  const [user] = useAtom(userAtom);
  const { toast } = useToast();

  const nativeAvailable = isStudyToolkitAvailable();
  const [status, setStatus] = useState<ToolkitStatus>(() => emptyToolkitStatus());
  const [soundscapes, setSoundscapes] = useState<Soundscape[]>([]);
  const [installedApps, setInstalledApps] = useState<LaunchableApp[]>([]);
  const [usageToday, setUsageToday] = useState<AppUsageEntry[]>([]);
  const [loading, setLoading] = useState(nativeAvailable);
  const [busy, setBusy] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleSection = useCallback((id: string) => {
    setCollapsed((current) => ({ ...current, [id]: !current[id] }));
  }, []);
  const isOpen = useCallback((id: string) => collapsed[id] !== true, [collapsed]);

  const refresh = useCallback(async () => {
    if (!nativeAvailable) {
      setLoading(false);
      return;
    }
    try {
      const [next, usage] = await Promise.all([
        getToolkitStatus(),
        getAppUsageToday().catch(() => [] as AppUsageEntry[]),
      ]);
      setStatus(next);
      setUsageToday(usage);
    } catch {
      // A failed read leaves the previous snapshot on screen rather than blanking
      // the page; the plugin never returns partial data, only all or nothing.
      toast({
        title: 'Could not read device settings',
        description: 'Reopen this page to try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [nativeAvailable, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!nativeAvailable) return;
    void (async () => {
      const [catalog, apps] = await Promise.all([
        listSoundscapes().catch(() => []),
        listLaunchableApps().catch(() => []),
      ]);
      setSoundscapes(catalog);
      setInstalledApps(apps);
    })();
  }, [nativeAvailable]);

  // Permissions, the accessibility service and the home role are all granted in the
  // system settings app, so the only reliable moment to re-check them is when
  // StudyBuddy comes back to the foreground.
  useEffect(() => {
    if (!nativeAvailable) return;
    const onResumed = () => void refresh();
    window.addEventListener('studybuddy:app-resumed', onResumed);
    return () => window.removeEventListener('studybuddy:app-resumed', onResumed);
  }, [nativeAvailable, refresh]);

  /**
   * Runs one write. The action is responsible for applying whatever slice came back,
   * so nothing else on the page is touched and no second read is needed.
   */
  const onRun = useCallback(
    (key: string, action: () => Promise<void>, successMessage?: string) => {
      setBusy(key);
      void (async () => {
        try {
          await action();
          if (successMessage) toast({ title: successMessage });
        } catch (error) {
          toast({
            title: 'That change was not applied',
            description: error instanceof Error ? error.message : 'The device rejected the request.',
            variant: 'destructive',
          });
        } finally {
          setBusy(null);
        }
      })();
    },
    [toast]
  );

  // One applier per slice. Each is stable, so a memoized section never re-renders
  // because its callback identity changed.
  const onSounds = useCallback((next: FocusSoundStatus | null) => {
    if (next) setStatus((current) => ({ ...current, sounds: next }));
  }, []);
  const onZen = useCallback((next: ZenConfig | null) => {
    if (next) setStatus((current) => ({ ...current, zen: next }));
  }, []);
  const onNudges = useCallback((next: NudgeConfig | null) => {
    if (next) setStatus((current) => ({ ...current, nudges: next }));
  }, []);
  const onShortsBlock = useCallback((next: ShortsBlockConfig | null) => {
    if (next) setStatus((current) => ({ ...current, shortsBlock: next }));
  }, []);
  const onAppRules = useCallback((next: AppRule[] | null) => {
    if (next) setStatus((current) => ({ ...current, appRules: next }));
  }, []);
  const onActiveBlocks = useCallback((next: ActiveBlocksConfig | null) => {
    if (next) setStatus((current) => ({ ...current, activeBlocks: next }));
  }, []);
  const onLauncher = useCallback((next: LauncherConfig | null) => {
    if (next) setStatus((current) => ({ ...current, launcher: next }));
  }, []);

  const inviteLink = useMemo(() => {
    if (!user?.id) return '';
    const origin = typeof window === 'undefined' ? 'https://sbd.satym.in' : window.location.origin;
    return `${origin}/invite/${user.id}`;
  }, [user?.id]);

  const disabled = !nativeAvailable || busy !== null;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-3 py-6 sm:px-6">
      <header className="space-y-2">
        <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">Focus tools</h1>
        <p className="text-sm text-muted-foreground">
          Device-level tools that protect study time: ambient sound, scheduled quiet hours, gentle
          nudges, short-form feed blocking, per-app limits, and a stripped-back home screen.
        </p>
      </header>

      {!nativeAvailable && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            These tools run on the device, so they need the StudyBuddy Android app. Sounds, Zen mode,
            nudges, feed blocking, app limits, the floating chip and the focus home screen all depend
            on Android permissions a browser cannot request. Inviting a friend works here.
          </p>
        </div>
      )}

      {loading ? (
        <>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            <span>Reading device settings…</span>
          </div>
          {Object.values(SECTION_MIN_BODY).map((height, index) => (
            <SectionSkeleton key={index} minBodyHeight={height} />
          ))}
        </>
      ) : (
        <>
          <PermissionsSection
            permissions={status.permissions}
            nativeAvailable={nativeAvailable}
            disabled={disabled}
            onRun={onRun}
            open={isOpen('permissions')}
            onToggle={toggleSection}
          />
          <SoundsSection
            sounds={status.sounds}
            soundscapes={soundscapes}
            disabled={disabled}
            onRun={onRun}
            onSounds={onSounds}
            open={isOpen('sounds')}
            onToggle={toggleSection}
          />
          <ZenSection
            zen={status.zen}
            nativeAvailable={nativeAvailable}
            disabled={disabled}
            onRun={onRun}
            onZen={onZen}
            open={isOpen('zen')}
            onToggle={toggleSection}
          />
          <NudgesSection
            nudges={status.nudges}
            installedApps={installedApps}
            nativeAvailable={nativeAvailable}
            disabled={disabled}
            onRun={onRun}
            onNudges={onNudges}
            open={isOpen('nudges')}
            onToggle={toggleSection}
          />
          <ShortsBlockSection
            shortsBlock={status.shortsBlock}
            installedApps={installedApps}
            nativeAvailable={nativeAvailable}
            disabled={disabled}
            onRun={onRun}
            onShortsBlock={onShortsBlock}
            open={isOpen('shorts')}
            onToggle={toggleSection}
          />
          <AppLimitsSection
            appRules={status.appRules}
            usageToday={usageToday}
            installedApps={installedApps}
            nativeAvailable={nativeAvailable}
            disabled={disabled}
            onRun={onRun}
            onAppRules={onAppRules}
            open={isOpen('app-limits')}
            onToggle={toggleSection}
          />
          <ActiveBlocksSection
            activeBlocks={status.activeBlocks}
            nativeAvailable={nativeAvailable}
            disabled={disabled}
            onRun={onRun}
            onActiveBlocks={onActiveBlocks}
            open={isOpen('active-blocks')}
            onToggle={toggleSection}
          />
          <LauncherSection
            launcher={status.launcher}
            installedApps={installedApps}
            nativeAvailable={nativeAvailable}
            disabled={disabled}
            onRun={onRun}
            onLauncher={onLauncher}
            open={isOpen('launcher')}
            onToggle={toggleSection}
          />
          <InviteSection inviteLink={inviteLink} open={isOpen('invite')} onToggle={toggleSection} />
        </>
      )}
    </div>
  );
}
