'use client';

import { memo } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TOOLKIT_PERMISSION_KEYS,
  openToolkitPermission,
  type ToolkitPermissionKey,
  type ToolkitPermissions,
} from '@/lib/studyToolkit';
import { SECTION_MIN_BODY, ToolSection, type SectionProps } from './shared';

const PERMISSION_LABELS: Record<ToolkitPermissionKey, { title: string; why: string }> = {
  notifications: {
    title: 'Notifications',
    why: 'Every tool here reports back through a notification — reminders, Zen changes, and the sound controls.',
  },
  exactAlarms: {
    title: 'Alarms and reminders',
    why: 'Zen windows and study reminders fire at an exact minute. Without this they drift by up to an hour.',
  },
  dndPolicy: {
    title: 'Do Not Disturb access',
    why: 'Needed for StudyBuddy to switch Do Not Disturb on and off for your scheduled Zen windows.',
  },
  accessibility: {
    title: 'StudyGuard service',
    why: 'Reads the screen of the apps you choose so a Shorts or Reels feed can be closed. Nothing leaves the device.',
  },
  usageAccess: {
    title: 'Usage access',
    why: 'Powers the screen-time figures in Digital Discipline. Optional for the tools on this page.',
  },
  overlay: {
    title: 'Display over other apps',
    why: 'Needed by the active-blocks chip and the floating focus bubble.',
  },
  batteryOptimization: {
    title: 'Unrestricted battery',
    why: 'Stops Android pausing a long focus session or a scheduled reminder in the background.',
  },
  defaultHome: {
    title: 'Home app',
    why: 'Only needed if you want the distraction-free home screen to actually be your home screen.',
  },
};

interface PermissionsSectionProps extends SectionProps {
  permissions: ToolkitPermissions;
  nativeAvailable: boolean;
  open: boolean;
  onToggle: (id: string) => void;
}

export const PermissionsSection = memo(function PermissionsSection({
  permissions,
  nativeAvailable,
  disabled,
  onRun,
  open,
  onToggle,
}: PermissionsSectionProps) {
  const outstanding = TOOLKIT_PERMISSION_KEYS.filter(
    (key) => permissions[key].required && !permissions[key].granted
  );

  return (
    <ToolSection
      id="permissions"
      title="Permission setup"
      icon={<ShieldCheck className="h-5 w-5" />}
      minBodyHeight={SECTION_MIN_BODY.permissions}
      open={open}
      onToggle={onToggle}
    >
      <p className="text-sm text-muted-foreground">
        {nativeAvailable && outstanding.length === 0
          ? 'Everything the tools you have switched on need is granted.'
          : 'Android only lets you grant these in system settings. Each button opens the right screen and tells you which switch to look for.'}
      </p>
      <ol className="space-y-3">
        {TOOLKIT_PERMISSION_KEYS.map((key, index) => {
          const state = permissions[key];
          const meta = PERMISSION_LABELS[key];
          return (
            <li
              key={key}
              className="flex flex-col gap-3 rounded-xl border border-border/60 p-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex min-w-0 gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold"
                >
                  {index + 1}
                </span>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-words text-sm font-medium">{meta.title}</p>
                    {state.granted ? (
                      <Badge variant="secondary">Granted</Badge>
                    ) : state.required ? (
                      <Badge variant="destructive">Needed</Badge>
                    ) : (
                      <Badge variant="outline">Optional</Badge>
                    )}
                  </div>
                  <p className="break-words text-xs text-muted-foreground">{meta.why}</p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                className="min-h-11 w-full shrink-0 sm:w-auto"
                variant={state.required && !state.granted ? 'default' : 'outline'}
                disabled={disabled || state.granted}
                onClick={() =>
                  onRun(`permission-${key}`, async () => {
                    const opened = await openToolkitPermission(key);
                    if (!opened) throw new Error('Android did not offer a settings screen for this.');
                  })
                }
              >
                {state.granted ? 'Done' : `Grant ${meta.title.toLowerCase()}`}
              </Button>
            </li>
          );
        })}
      </ol>
    </ToolSection>
  );
});
