'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isNativeApp } from '@/lib/capacitor';
import {
  ensureAlarmPermission,
  hasExactAlarmPermission,
  requestExactAlarmPermission,
} from '@/lib/nativeAlarms';

export default function MobileReminderSettings() {
  const [native, setNative] = useState(false);
  const [notificationsAllowed, setNotificationsAllowed] = useState<boolean | null>(null);
  const [exactAllowed, setExactAllowed] = useState<boolean | null>(null);
  const [openingSettings, setOpeningSettings] = useState(false);

  const refresh = useCallback(async () => {
    if (!isNativeApp()) return;
    setNative(true);
    setNotificationsAllowed(await ensureAlarmPermission());
    setExactAllowed(await hasExactAlarmPermission());
  }, []);

  useEffect(() => {
    void refresh();
    window.addEventListener('studybuddy:app-resumed', refresh);
    return () => window.removeEventListener('studybuddy:app-resumed', refresh);
  }, [refresh]);

  if (!native) return null;

  const enableExactAlarms = async () => {
    setOpeningSettings(true);
    await ensureAlarmPermission();
    await requestExactAlarmPermission();
    await refresh();
    setOpeningSettings(false);
  };

  return (
    <div className="rounded-xl border border-hairline bg-muted/30 p-4 space-y-3">
      <div className="flex gap-3">
        <BellRing className="mt-0.5 h-5 w-5 text-primary shrink-0" aria-hidden />
        <div>
          <p className="text-sm font-medium">Android schedule alarms</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {notificationsAllowed === false
              ? 'Allow notifications to receive schedule reminders while StudyBuddy is in the background.'
              : exactAllowed === true
                ? 'Exact task reminders are enabled for this APK.'
                : 'Enable exact alarms for the most reliable task-start reminders on Android 12+.'}
          </p>
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => void enableExactAlarms()} disabled={openingSettings}>
        {openingSettings ? 'Opening Android settings…' : exactAllowed === true ? 'Check alarm settings' : 'Enable exact alarms'}
      </Button>
    </div>
  );
}
