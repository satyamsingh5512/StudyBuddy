'use client';

import { memo, useCallback, useState } from 'react';
import { AlarmClock, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { setNudgeConfig, type LaunchableApp, type NudgeConfig } from '@/lib/studyToolkit';
import {
  AppPicker,
  DayChips,
  SECTION_MIN_BODY,
  SwitchRow,
  ToolSection,
  minutesToTime,
  timeToMinutes,
  type SectionProps,
} from './shared';

interface NudgesSectionProps extends SectionProps {
  nudges: NudgeConfig;
  installedApps: LaunchableApp[];
  nativeAvailable: boolean;
  onNudges: (next: NudgeConfig | null) => void;
  open: boolean;
  onToggle: (id: string) => void;
}

export const NudgesSection = memo(function NudgesSection({
  nudges,
  installedApps,
  nativeAvailable,
  disabled,
  onRun,
  onNudges,
  open,
  onToggle,
}: NudgesSectionProps) {
  const { toast } = useToast();
  const [reminderTimeDraft, setReminderTimeDraft] = useState('19:00');

  const save = useCallback(
    (
      key: string,
      patch: {
        leaveFocusEnabled?: boolean;
        studyPackages?: string[];
        reminderTimes?: number[];
        reminderDays?: number[];
        remindersEnabled?: boolean;
      }
    ) => {
      onRun(key, async () =>
        onNudges(
          await setNudgeConfig({
            leaveFocusEnabled: patch.leaveFocusEnabled ?? nudges.leaveFocusEnabled,
            studyPackages: patch.studyPackages ?? nudges.studyPackages,
            reminderTimes: patch.reminderTimes ?? nudges.reminderTimes,
            reminderDays: patch.reminderDays ?? nudges.reminderDays,
            remindersEnabled: patch.remindersEnabled ?? nudges.remindersEnabled,
          })
        )
      );
    },
    [nudges, onNudges, onRun]
  );

  const toggleStudyApp = useCallback(
    (packageName: string) => {
      save('nudge-apps', {
        studyPackages: nudges.studyPackages.includes(packageName)
          ? nudges.studyPackages.filter((p) => p !== packageName)
          : [...nudges.studyPackages, packageName],
      });
    },
    [nudges.studyPackages, save]
  );

  const scheduleIncomplete =
    nudges.reminderTimes.length === 0 || nudges.reminderDays.length === 0;

  return (
    <ToolSection
      id="nudges"
      title="Nudges and reminders"
      icon={<BellRing className="h-5 w-5" />}
      minBodyHeight={SECTION_MIN_BODY.nudges}
      open={open}
      onToggle={onToggle}
    >
      <SwitchRow
        id="nudge-leave-focus"
        label="Remind me when I leave a focus session"
        hint={
          <p className="text-xs text-muted-foreground">
            At most one reminder every three minutes, and five per session.
          </p>
        }
      >
        <Switch
          id="nudge-leave-focus"
          aria-label="Remind me when I leave a focus session"
          checked={nudges.leaveFocusEnabled}
          disabled={disabled}
          onCheckedChange={(checked) => save('nudges', { leaveFocusEnabled: checked })}
        />
      </SwitchRow>

      <AppPicker
        label="Study apps"
        description="Opening one of these never triggers a nudge, and they appear as shortcuts on your study reminders."
        apps={installedApps}
        selected={nudges.studyPackages}
        disabled={disabled}
        nativeAvailable={nativeAvailable}
        idPrefix="nudge-app"
        onToggle={toggleStudyApp}
      />

      <div className="space-y-3 border-t border-border/60 pt-4">
        <SwitchRow
          id="reminders-enabled"
          label="Daily study reminders"
          hint={
            scheduleIncomplete ? (
              <p className="text-xs text-muted-foreground">
                Add at least one time and one day before switching reminders on.
              </p>
            ) : undefined
          }
        >
          <Switch
            id="reminders-enabled"
            aria-label="Daily study reminders"
            checked={nudges.remindersEnabled}
            disabled={disabled || scheduleIncomplete}
            onCheckedChange={(checked) => save('nudges', { remindersEnabled: checked })}
          />
        </SwitchRow>

        <div className="flex flex-wrap items-center gap-2">
          {nudges.reminderTimes.map((minutes) => (
            <span
              key={minutes}
              className="inline-flex min-h-10 items-center gap-1 rounded-full bg-muted px-3 text-xs"
            >
              {minutesToTime(minutes)}
              <button
                type="button"
                aria-label={`Remove the ${minutesToTime(minutes)} reminder`}
                disabled={disabled}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-50"
                onClick={() =>
                  save('nudges', {
                    reminderTimes: nudges.reminderTimes.filter((m) => m !== minutes),
                  })
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="reminder-new-time" className="text-xs">
              Add a reminder time
            </Label>
            <Input
              id="reminder-new-time"
              type="time"
              className="w-32"
              value={reminderTimeDraft}
              disabled={disabled}
              onChange={(event) => setReminderTimeDraft(event.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11"
            disabled={disabled}
            onClick={() => {
              const minutes = timeToMinutes(reminderTimeDraft);
              if (minutes === null) {
                toast({ title: 'Enter a time as HH:MM', variant: 'destructive' });
                return;
              }
              if (nudges.reminderTimes.includes(minutes)) return;
              save('nudges', {
                reminderTimes: [...nudges.reminderTimes, minutes].sort((a, b) => a - b),
              });
            }}
          >
            <AlarmClock aria-hidden="true" className="mr-1.5 h-4 w-4" />
            Add time
          </Button>
        </div>

        <DayChips
          legend="Reminder days"
          namePrefix="reminder-day"
          selected={nudges.reminderDays}
          disabled={disabled}
          onToggle={(day) =>
            save('nudges', {
              reminderDays: nudges.reminderDays.includes(day)
                ? nudges.reminderDays.filter((d) => d !== day)
                : [...nudges.reminderDays, day].sort((a, b) => a - b),
            })
          }
        />
      </div>
    </ToolSection>
  );
});
