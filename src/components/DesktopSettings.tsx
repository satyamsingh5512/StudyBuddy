'use client';

import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { getDesktopAutostart, isDesktopApp, setDesktopAutostart } from '@/lib/desktop';

/** Launch-at-login + shell info. Rendered only inside the Ubuntu desktop app. */
export default function DesktopSettings() {
  const { toast } = useToast();
  const [autostart, setAutostart] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isDesktopApp()) return;
    getDesktopAutostart()
      .then((value) => {
        setAutostart(value);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!isDesktopApp()) return null;

  const handleToggle = async (checked: boolean) => {
    setAutostart(checked);
    const applied = await setDesktopAutostart(checked);
    setAutostart(applied);
    toast({
      title: applied ? 'StudyBuddy will start at login' : 'Launch at login off',
      description: applied
        ? 'Reminders resume automatically after a reboot.'
        : 'Start StudyBuddy manually to receive reminders.',
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-hairline bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="desktopAutostart">Start at login</Label>
          <p className="text-xs text-muted-foreground">
            Keep StudyBuddy in the tray after reboot so reminders keep working.
          </p>
        </div>
        <Switch id="desktopAutostart" checked={autostart} disabled={!loaded} onCheckedChange={handleToggle} />
      </div>
      <p className="text-xs text-muted-foreground">
        Desktop build: native window, tray icon, system notifications. Closing the window hides it
        to the tray — use Quit from the tray to exit fully.
      </p>
    </div>
  );
}
