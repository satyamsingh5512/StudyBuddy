'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { Ban, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  MAX_STRICT_COOLOFF_MINUTES,
  openToolkitPermission,
  requestStrictDisable,
  setShortsBlockConfig,
  type LaunchableApp,
  type ShortsBlockConfig,
} from '@/lib/studyToolkit';
import { AppPicker, SECTION_MIN_BODY, SwitchRow, ToolSection, type SectionProps } from './shared';
import { useDebouncedCommit } from './useDebouncedCommit';

const PLATFORMS = [
  ['youtubeEnabled', 'YouTube Shorts'],
  ['instagramEnabled', 'Instagram Reels'],
  ['facebookEnabled', 'Facebook Reels'],
  ['snapchatEnabled', 'Snapchat Spotlight'],
] as const;

/** Whole minutes left, rounded up, so a countdown never reads "0 min" while waiting. */
const minutesLeft = (untilMs: number, nowMs: number): number =>
  Math.max(0, Math.ceil((untilMs - nowMs) / 60_000));

interface ShortsBlockSectionProps extends SectionProps {
  shortsBlock: ShortsBlockConfig;
  installedApps: LaunchableApp[];
  nativeAvailable: boolean;
  onShortsBlock: (next: ShortsBlockConfig | null) => void;
  open: boolean;
  onToggle: (id: string) => void;
}

export const ShortsBlockSection = memo(function ShortsBlockSection({
  shortsBlock,
  installedApps,
  nativeAvailable,
  disabled,
  onRun,
  onShortsBlock,
  open,
  onToggle,
}: ShortsBlockSectionProps) {
  const [allowance, setAllowance] = useState(shortsBlock.dailyAllowanceMinutes);
  const [swipeLimit, setSwipeLimit] = useState(shortsBlock.swipeLimit);
  const [cooloff, setCooloff] = useState(shortsBlock.strictCooloffMinutes);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => setAllowance(shortsBlock.dailyAllowanceMinutes), [shortsBlock.dailyAllowanceMinutes]);
  useEffect(() => setSwipeLimit(shortsBlock.swipeLimit), [shortsBlock.swipeLimit]);
  useEffect(() => setCooloff(shortsBlock.strictCooloffMinutes), [shortsBlock.strictCooloffMinutes]);

  // The countdown only ticks while there is something to count down, so an idle page
  // is not waking up once a second for nothing.
  const pendingUntil = shortsBlock.strictPendingUntilMs;
  useEffect(() => {
    if (pendingUntil === undefined) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    setNow(Date.now());
    return () => window.clearInterval(timer);
  }, [pendingUntil]);

  const write = useCallback(
    (key: string, patch: Parameters<typeof setShortsBlockConfig>[0], message?: string) => {
      onRun(key, async () => onShortsBlock(await setShortsBlockConfig(patch)), message);
    },
    [onRun, onShortsBlock]
  );

  const allowanceCommit = useDebouncedCommit(
    useCallback((next: number) => write('shorts-allowance', { dailyAllowanceMinutes: next }), [write])
  );
  const swipeCommit = useDebouncedCommit(
    useCallback((next: number) => write('shorts-swipe', { swipeLimit: next }), [write])
  );
  const cooloffCommit = useDebouncedCommit(
    useCallback((next: number) => write('shorts-cooloff', { strictCooloffMinutes: next }), [write])
  );

  const toggleBlockedApp = useCallback(
    (packageName: string) => {
      write('shorts-apps', {
        blockedPackages: shortsBlock.blockedPackages.includes(packageName)
          ? shortsBlock.blockedPackages.filter((p) => p !== packageName)
          : [...shortsBlock.blockedPackages, packageName],
      });
    },
    [shortsBlock.blockedPackages, write]
  );

  const pendingMinutes = pendingUntil === undefined ? null : minutesLeft(pendingUntil, now);

  return (
    <ToolSection
      id="shorts"
      title="Shorts and Reels"
      icon={<Ban className="h-5 w-5" />}
      minBodyHeight={SECTION_MIN_BODY.shorts}
      open={open}
      onToggle={onToggle}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={shortsBlock.serviceEnabled ? 'secondary' : 'outline'}>
          {shortsBlock.serviceEnabled ? 'StudyGuard is running' : 'StudyGuard is off'}
        </Badge>
        {shortsBlock.serviceEnabled && (
          <span className="text-xs text-muted-foreground">
            {shortsBlock.blockedToday} feed{shortsBlock.blockedToday === 1 ? '' : 's'} closed
            {shortsBlock.browserBlocks > 0 && `, ${shortsBlock.browserBlocks} in a browser`}
            {shortsBlock.reelsSwiped > 0 && `, ${shortsBlock.reelsSwiped} videos swiped`} today
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        StudyGuard watches for a short-form feed in the apps you pick and closes it. It reads only
        view names and labels, on the device, and sends nothing anywhere.
      </p>
      {!shortsBlock.serviceEnabled && (
        <Button
          type="button"
          size="sm"
          className="min-h-11"
          disabled={disabled}
          onClick={() =>
            onRun('permission-accessibility', async () => {
              await openToolkitPermission('accessibility');
            })
          }
        >
          Turn StudyGuard on
        </Button>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {PLATFORMS.map(([key, label]) => (
          <SwitchRow key={key} id={`shorts-${key}`} label={label}>
            <Switch
              id={`shorts-${key}`}
              aria-label={`Block ${label}`}
              checked={shortsBlock[key]}
              disabled={disabled}
              onCheckedChange={(checked) => write(`shorts-${key}`, { [key]: checked })}
            />
          </SwitchRow>
        ))}
        <SwitchRow id="shorts-tiktok" label="TikTok (whole app)">
          <Switch
            id="shorts-tiktok"
            aria-label="Block the TikTok app entirely"
            checked={shortsBlock.blockTikTok}
            disabled={disabled}
            onCheckedChange={(checked) => write('shorts-tiktok', { blockTikTok: checked })}
          />
        </SwitchRow>
        <SwitchRow
          id="shorts-browsers"
          label="Short-form sites in browsers"
          hint={
            <p className="text-xs text-muted-foreground">
              Matches the address bar in memory. No URL is stored.
            </p>
          }
        >
          <Switch
            id="shorts-browsers"
            aria-label="Block short-form sites opened in a browser"
            checked={shortsBlock.blockInBrowsers}
            disabled={disabled}
            onCheckedChange={(checked) => write('shorts-browsers', { blockInBrowsers: checked })}
          />
        </SwitchRow>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <SwitchRow id="shorts-only-focus" label="Only during focus sessions">
          <Switch
            id="shorts-only-focus"
            aria-label="Only block during focus sessions"
            checked={shortsBlock.onlyDuringFocus}
            disabled={disabled}
            onCheckedChange={(checked) => write('shorts-only', { onlyDuringFocus: checked })}
          />
        </SwitchRow>
        <SwitchRow id="shorts-protect" label="Warn me if I try to turn this off mid-session">
          <Switch
            id="shorts-protect"
            aria-label="Warn me if I try to turn this off during a focus session"
            checked={shortsBlock.protectSettings}
            disabled={disabled}
            onCheckedChange={(checked) => write('shorts-protect', { protectSettings: checked })}
          />
        </SwitchRow>
      </div>

      <div className="space-y-2">
        <Label htmlFor="shorts-allowance">Daily allowance: {allowance} min</Label>
        <p className="text-xs text-muted-foreground">
          Minutes of short-form video allowed each day before blocking starts. Zero blocks from the
          first swipe.
        </p>
        <Slider
          id="shorts-allowance"
          aria-label="Daily short-form video allowance in minutes"
          min={0}
          max={120}
          step={5}
          value={allowance}
          disabled={disabled}
          onChange={(next) => {
            setAllowance(next);
            allowanceCommit.schedule(next);
          }}
          onChangeEnd={allowanceCommit.commit}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="shorts-swipe-limit">
          Swipe limit: {swipeLimit === 0 ? 'off' : `${swipeLimit} videos a day`}
        </Label>
        <p className="text-xs text-muted-foreground">
          Counts how many videos you move through in a feed, which a time allowance does not. The
          feed closes once you reach the limit. Zero turns the count off.
        </p>
        <Slider
          id="shorts-swipe-limit"
          aria-label="Videos allowed per day in a short-form feed"
          min={0}
          max={200}
          step={5}
          value={swipeLimit}
          disabled={disabled}
          onChange={(next) => {
            setSwipeLimit(next);
            swipeCommit.schedule(next);
          }}
          onChangeEnd={swipeCommit.commit}
        />
      </div>

      {/* Strict mode ------------------------------------------------------- */}
      <div className="space-y-3 rounded-xl border border-border/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Lock aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm font-medium">Strict mode</p>
          {shortsBlock.strictActive && <Badge variant="secondary">In force now</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          Backs you out of the screens that would switch StudyGuard off — the accessibility list,
          StudyBuddy&apos;s app info page, and the uninstall dialog. It does not stop you getting
          there; it just makes it a decision rather than a reflex.
        </p>
        <p className="text-xs text-muted-foreground">
          Turning strict mode off is not instant while it applies all the time. StudyBuddy starts a
          cool-off and keeps protecting until it runs out, so a moment of wanting to scroll cannot
          undo the setting. It always does switch off once the cool-off passes, and you can cancel
          the request by switching strict mode back on.
        </p>

        <SwitchRow id="shorts-strict" label="Strict mode on">
          <Switch
            id="shorts-strict"
            aria-label="Strict mode"
            checked={shortsBlock.strictMode}
            disabled={disabled}
            onCheckedChange={(checked) =>
              checked
                ? write('shorts-strict', { strictMode: true }, 'Strict mode on')
                : onRun(
                    'shorts-strict-disable',
                    async () => onShortsBlock(await requestStrictDisable())
                  )
            }
          />
        </SwitchRow>

        <SwitchRow
          id="shorts-strict-always"
          label="Apply all the time, not only during focus"
          hint={
            shortsBlock.strictMode && shortsBlock.strictAlways ? (
              <p className="text-xs text-muted-foreground">
                Locked while strict mode is on. Start the cool-off to change it.
              </p>
            ) : undefined
          }
        >
          <Switch
            id="shorts-strict-always"
            aria-label="Apply strict mode all the time"
            checked={shortsBlock.strictAlways}
            disabled={disabled || (shortsBlock.strictMode && shortsBlock.strictAlways)}
            onCheckedChange={(checked) => write('shorts-strict-always', { strictAlways: checked })}
          />
        </SwitchRow>

        <div className="space-y-2">
          <Label htmlFor="shorts-cooloff">Cool-off: {cooloff} min</Label>
          <Slider
            id="shorts-cooloff"
            aria-label="Cool-off in minutes before strict mode switches off"
            min={0}
            max={MAX_STRICT_COOLOFF_MINUTES}
            step={5}
            value={cooloff}
            disabled={disabled}
            onChange={(next) => {
              setCooloff(next);
              cooloffCommit.schedule(next);
            }}
            onChangeEnd={cooloffCommit.commit}
          />
          {shortsBlock.strictMode && shortsBlock.strictAlways && (
            <p className="text-xs text-muted-foreground">
              While strict mode is on you can lengthen the cool-off but not shorten it.
            </p>
          )}
        </div>

        {pendingMinutes !== null && (
          <p className="break-words text-xs text-primary" role="status">
            {pendingMinutes === 0
              ? 'The cool-off has finished. Strict mode switches off on the next check.'
              : `Strict mode switches off in about ${pendingMinutes} min${
                  pendingMinutes === 1 ? '' : 's'
                }. Switch it back on to cancel.`}
          </p>
        )}
      </div>

      <AppPicker
        label="Pause these apps during focus"
        apps={installedApps}
        selected={shortsBlock.blockedPackages}
        disabled={disabled}
        nativeAvailable={nativeAvailable}
        idPrefix="shorts-app"
        onToggle={toggleBlockedApp}
      />
    </ToolSection>
  );
});
