'use client';

import { memo } from 'react';
import { Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  openToolkitPermission,
  setActiveBlocksChip,
  setStandingNotification,
  type ActiveBlocksConfig,
} from '@/lib/studyToolkit';
import { SECTION_MIN_BODY, SwitchRow, ToolSection, type SectionProps } from './shared';

interface ActiveBlocksSectionProps extends SectionProps {
  activeBlocks: ActiveBlocksConfig;
  nativeAvailable: boolean;
  onActiveBlocks: (next: ActiveBlocksConfig | null) => void;
  open: boolean;
  onToggle: (id: string) => void;
}

export const ActiveBlocksSection = memo(function ActiveBlocksSection({
  activeBlocks,
  nativeAvailable,
  disabled,
  onRun,
  onActiveBlocks,
  open,
  onToggle,
}: ActiveBlocksSectionProps) {
  const needsOverlay = nativeAvailable && !activeBlocks.overlayPermission;

  return (
    <ToolSection
      id="active-blocks"
      title="Always-visible summary"
      icon={<Eye className="h-5 w-5" />}
      minBodyHeight={SECTION_MIN_BODY.activeBlocks}
      open={open}
      onToggle={onToggle}
    >
      <p className="text-sm text-muted-foreground">
        Two optional read-only surfaces. Neither blocks anything itself; they only show what is
        already in force, so you can see the state without opening StudyBuddy.
      </p>

      <SwitchRow
        id="active-blocks-chip"
        label="Floating chip over other apps"
        hint={
          <p className="text-xs text-muted-foreground">
            A small draggable chip showing what is blocked and how long the current focus session has
            run. Tap it for the detail; drag it anywhere.
            {needsOverlay && ' Needs permission to display over other apps.'}
          </p>
        }
      >
        <Switch
          id="active-blocks-chip"
          aria-label="Show the floating active-blocks chip"
          checked={activeBlocks.chipEnabled}
          disabled={disabled || (needsOverlay && !activeBlocks.chipEnabled)}
          onCheckedChange={(checked) =>
            onRun('active-blocks-chip', async () => onActiveBlocks(await setActiveBlocksChip(checked)))
          }
        />
      </SwitchRow>

      {needsOverlay && (
        <Button
          type="button"
          size="sm"
          className="min-h-11"
          disabled={disabled}
          onClick={() =>
            onRun('permission-overlay', async () => {
              await openToolkitPermission('overlay');
            })
          }
        >
          Allow display over other apps
        </Button>
      )}

      {activeBlocks.chipEnabled && (
        <Badge variant={activeBlocks.chipRunning ? 'secondary' : 'outline'}>
          {activeBlocks.chipRunning ? 'Chip is on screen' : 'Chip is waiting for permission'}
        </Badge>
      )}

      <SwitchRow
        id="active-blocks-standing"
        label="Standing notification with today's figures"
        hint={
          <p className="text-xs text-muted-foreground">
            Silent and low priority, refreshed every 15 minutes. Figures that have not been measured
            are left out rather than shown as zero. &quot;Hide today&quot; dismisses it until tomorrow.
          </p>
        }
      >
        <Switch
          id="active-blocks-standing"
          aria-label="Show a standing notification with today's figures"
          checked={activeBlocks.standingEnabled}
          disabled={disabled}
          onCheckedChange={(checked) =>
            onRun('active-blocks-standing', async () =>
              onActiveBlocks(await setStandingNotification(checked))
            )
          }
        />
      </SwitchRow>
    </ToolSection>
  );
});
