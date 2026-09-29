'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { Clock, Moon, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  setZenEnabled,
  setZenWindows,
  zenEnterNow,
  zenExitNow,
  type ZenConfig,
  type ZenWindow,
} from '@/lib/studyToolkit';
import {
  DayChips,
  SECTION_MIN_BODY,
  SwitchRow,
  ToolSection,
  minutesToTime,
  timeToMinutes,
  type SectionProps,
} from './shared';

const newWindowId = (): string =>
  `zen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

interface ZenSectionProps extends SectionProps {
  zen: ZenConfig;
  nativeAvailable: boolean;
  onZen: (next: ZenConfig | null) => void;
  open: boolean;
  onToggle: (id: string) => void;
}

export const ZenSection = memo(function ZenSection({
  zen,
  nativeAvailable,
  disabled,
  onRun,
  onZen,
  open,
  onToggle,
}: ZenSectionProps) {
  const [draft, setDraft] = useState<ZenWindow[]>(zen.windows);
  const [zenNowMinutes, setZenNowMinutes] = useState('45');

  useEffect(() => {
    setDraft(zen.windows);
  }, [zen.windows]);

  const updateWindow = useCallback((id: string, patch: Partial<ZenWindow>) => {
    setDraft((windows) => windows.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  }, []);

  const toggleDay = useCallback((id: string, day: number) => {
    setDraft((windows) =>
      windows.map((w) =>
        w.id === id
          ? {
              ...w,
              daysOfWeek: w.daysOfWeek.includes(day)
                ? w.daysOfWeek.filter((d) => d !== day)
                : [...w.daysOfWeek, day].sort((a, b) => a - b),
            }
          : w
      )
    );
  }, []);

  const addWindow = useCallback(() => {
    setDraft((windows) => [
      ...windows,
      {
        id: newWindowId(),
        label: 'Study window',
        daysOfWeek: [2, 3, 4, 5, 6],
        startMinute: 19 * 60,
        endMinute: 21 * 60,
        enabled: true,
        startFocus: false,
        allowPriorityOnly: true,
      },
    ]);
  }, []);

  return (
    <ToolSection
      id="zen"
      title="Zen mode"
      icon={<Moon className="h-5 w-5" />}
      minBodyHeight={SECTION_MIN_BODY.zen}
      open={open}
      onToggle={onToggle}
    >
      <p className="text-sm text-muted-foreground">
        Turns Do Not Disturb on for the hours you set, and puts it back the way you had it
        afterwards. If you had Do Not Disturb on yourself, Zen will not turn it off.
      </p>

      <SwitchRow
        id="zen-master"
        label="Follow my Zen schedule"
        hint={
          <>
            {zen.active && <p className="text-xs text-primary">A Zen window is active now.</p>}
            {nativeAvailable && !zen.hasPolicyAccess && (
              <p className="text-xs text-muted-foreground">
                Grant Do Not Disturb access in step 3 first.
              </p>
            )}
          </>
        }
      >
        <Switch
          id="zen-master"
          aria-label="Follow my Zen schedule"
          checked={zen.enabled}
          disabled={disabled || !zen.hasPolicyAccess}
          onCheckedChange={(checked) =>
            onRun('zen-enabled', async () => onZen(await setZenEnabled(checked)))
          }
        />
      </SwitchRow>

      <div className="space-y-3">
        {draft.length === 0 && <p className="text-sm text-muted-foreground">No Zen windows yet.</p>}
        {draft.map((window) => (
          <div key={window.id} className="space-y-3 rounded-xl border border-border/60 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[8rem] flex-1 space-y-1">
                <Label htmlFor={`zen-label-${window.id}`} className="text-xs">
                  Name
                </Label>
                <Input
                  id={`zen-label-${window.id}`}
                  value={window.label}
                  maxLength={60}
                  disabled={disabled}
                  onChange={(event) => updateWindow(window.id, { label: event.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`zen-start-${window.id}`} className="text-xs">
                  From
                </Label>
                <Input
                  id={`zen-start-${window.id}`}
                  type="time"
                  className="w-28"
                  value={minutesToTime(window.startMinute)}
                  disabled={disabled}
                  onChange={(event) => {
                    const minutes = timeToMinutes(event.target.value);
                    if (minutes !== null) updateWindow(window.id, { startMinute: minutes });
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`zen-end-${window.id}`} className="text-xs">
                  To
                </Label>
                <Input
                  id={`zen-end-${window.id}`}
                  type="time"
                  className="w-28"
                  value={minutesToTime(window.endMinute)}
                  disabled={disabled}
                  onChange={(event) => {
                    const minutes = timeToMinutes(event.target.value);
                    if (minutes !== null) updateWindow(window.id, { endMinute: minutes });
                  }}
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-10 min-w-10"
                aria-label={`Remove ${window.label}`}
                disabled={disabled}
                onClick={() => setDraft((list) => list.filter((w) => w.id !== window.id))}
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>

            {window.endMinute <= window.startMinute && (
              <p className="text-xs text-muted-foreground">
                This window runs past midnight and ends the next morning.
              </p>
            )}

            <DayChips
              legend="Days"
              namePrefix={`zen-${window.id}`}
              selected={window.daysOfWeek}
              disabled={disabled}
              onToggle={(day) => toggleDay(window.id, day)}
            />

            <div className="grid gap-2 sm:grid-cols-2">
              <SwitchRow id={`zen-priority-${window.id}`} label="Still allow priority alerts">
                <Switch
                  id={`zen-priority-${window.id}`}
                  aria-label={`Allow priority alerts during ${window.label}`}
                  checked={window.allowPriorityOnly}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    updateWindow(window.id, { allowPriorityOnly: checked })
                  }
                />
              </SwitchRow>
              <SwitchRow id={`zen-focus-${window.id}`} label="Start a focus session too">
                <Switch
                  id={`zen-focus-${window.id}`}
                  aria-label={`Start a focus session during ${window.label}`}
                  checked={window.startFocus}
                  disabled={disabled}
                  onCheckedChange={(checked) => updateWindow(window.id, { startFocus: checked })}
                />
              </SwitchRow>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-11"
          disabled={disabled}
          onClick={addWindow}
        >
          <Plus aria-hidden="true" className="mr-1.5 h-4 w-4" />
          Add window
        </Button>
        <Button
          type="button"
          size="sm"
          className="min-h-11"
          disabled={disabled}
          onClick={() =>
            onRun('zen-save', async () => onZen(await setZenWindows(draft)), 'Zen schedule saved')
          }
        >
          Save schedule
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t border-border/60 pt-4">
        <div className="space-y-1">
          <Label htmlFor="zen-now-minutes" className="text-xs">
            Quiet hours right now (minutes)
          </Label>
          <Input
            id="zen-now-minutes"
            type="number"
            min={1}
            max={600}
            inputMode="numeric"
            className="w-28"
            value={zenNowMinutes}
            disabled={disabled}
            onChange={(event) => setZenNowMinutes(event.target.value)}
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="min-h-11"
          disabled={disabled || !zen.hasPolicyAccess}
          onClick={() =>
            onRun(
              'zen-now',
              async () => onZen(await zenEnterNow(Number(zenNowMinutes) || 45)),
              'Zen mode on'
            )
          }
        >
          <Clock aria-hidden="true" className="mr-1.5 h-4 w-4" />
          Start Zen now
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-11"
          disabled={disabled}
          onClick={() => onRun('zen-exit', async () => onZen(await zenExitNow()), 'Zen mode off')}
        >
          End Zen
        </Button>
      </div>
    </ToolSection>
  );
});
