'use client';

import { memo, useCallback } from 'react';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  openToolkitPermission,
  setLauncherAllowedApps,
  setLauncherEnabled,
  type LaunchableApp,
  type LauncherConfig,
} from '@/lib/studyToolkit';
import { AppPicker, SECTION_MIN_BODY, SwitchRow, ToolSection, type SectionProps } from './shared';

interface LauncherSectionProps extends SectionProps {
  launcher: LauncherConfig;
  installedApps: LaunchableApp[];
  nativeAvailable: boolean;
  onLauncher: (next: LauncherConfig | null) => void;
  open: boolean;
  onToggle: (id: string) => void;
}

export const LauncherSection = memo(function LauncherSection({
  launcher,
  installedApps,
  nativeAvailable,
  disabled,
  onRun,
  onLauncher,
  open,
  onToggle,
}: LauncherSectionProps) {
  const toggleApp = useCallback(
    (packageName: string) => {
      const next = launcher.allowedApps.includes(packageName)
        ? launcher.allowedApps.filter((p) => p !== packageName)
        : [...launcher.allowedApps, packageName];
      onRun('launcher-apps', async () => onLauncher(await setLauncherAllowedApps(next)));
    },
    [launcher.allowedApps, onLauncher, onRun]
  );

  return (
    <ToolSection
      id="launcher"
      title="Focus home screen"
      icon={<Home className="h-5 w-5" />}
      minBodyHeight={SECTION_MIN_BODY.launcher}
      open={open}
      onToggle={onToggle}
    >
      <p className="text-sm text-muted-foreground">
        A plain home screen with the clock, today&apos;s focus time, and only the apps you allow.
        Nothing is uninstalled or hidden from the device, and you can switch back to your usual
        launcher whenever you like.
      </p>

      <SwitchRow
        id="launcher-enabled"
        label="Offer StudyBuddy as a home screen"
        hint={
          launcher.isDefaultHome ? (
            <p className="text-xs text-primary">This is currently your home screen.</p>
          ) : undefined
        }
      >
        <Switch
          id="launcher-enabled"
          aria-label="Offer StudyBuddy as a home screen"
          checked={launcher.enabled}
          disabled={disabled}
          onCheckedChange={(checked) =>
            onRun('launcher', async () => onLauncher(await setLauncherEnabled(checked)))
          }
        />
      </SwitchRow>

      {launcher.enabled && !launcher.isDefaultHome && (
        <Button
          type="button"
          size="sm"
          className="min-h-11"
          disabled={disabled}
          onClick={() =>
            onRun('permission-defaultHome', async () => {
              await openToolkitPermission('defaultHome');
            })
          }
        >
          Set as default home
        </Button>
      )}

      <AppPicker
        label="Apps to show"
        apps={installedApps}
        selected={launcher.allowedApps}
        disabled={disabled}
        nativeAvailable={nativeAvailable}
        idPrefix="launcher-app"
        onToggle={toggleApp}
      />
    </ToolSection>
  );
});
