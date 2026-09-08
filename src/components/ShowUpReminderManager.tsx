'use client';

import { useEffect, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { userAtom } from '@/store/atoms';
import { useToast } from '@/components/ui/use-toast';
import { normalizePreferences } from '@/lib/preferences';
import { desktopNotifySync, getNotificationPermission } from '@/lib/desktop';
import {
  startShowUpReminderLifecycle,
  type ReminderNotificationGateway,
} from '@/lib/showUpReminderLifecycle';

export default function ShowUpReminderManager() {
  const user = useAtomValue(userAtom);
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    if (!user) return;
    const preferences = normalizePreferences(user.preferences);
    const settings = preferences.showUpReminder;
    if (!settings.enabled) return;
    const timeZone = user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      // The lifecycle continues with in-memory deduplication.
    }

    // Desktop shell (Ubuntu .deb/AppImage) notifies via libnotify through the
    // main process; browsers use the Web Notification API when permitted.
    const notification: ReminderNotificationGateway = {
      get permission() {
        return getNotificationPermission() === 'granted' ? 'granted' : 'denied';
      },
      show(title, options) {
        desktopNotifySync(title, options.body ?? '', options.tag);
      },
    };

    return startShowUpReminderLifecycle({
      userId: user.id,
      timeZone,
      settings,
      toast: (message) => toastRef.current(message),
      environment: {
        now: () => new Date(),
        storage,
        visibilityState: () => document.visibilityState,
        notification,
        setInterval: (callback, delay) => window.setInterval(callback, delay),
        clearInterval: (handle) => window.clearInterval(handle as number),
      },
    });
  }, [user]);

  return null;
}
