'use client';

import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  requestBrowserNotificationPermission,
  type NotificationPermissionAPI,
} from '@/lib/notificationPermission';
import { isDesktopApp } from '@/lib/desktop';

interface NotificationPermissionActionProps {
  permission: NotificationPermission | 'unsupported';
  onPermission(permission: NotificationPermission): void;
  onUnsupported(): void;
  notificationAPI?: NotificationPermissionAPI | null;
}

/** The sole browser-notification permission gesture exposed by Settings. */
export function NotificationPermissionAction({
  permission,
  onPermission,
  onUnsupported,
  notificationAPI = typeof window !== 'undefined' && 'Notification' in window
    ? Notification
    : null,
}: NotificationPermissionActionProps) {
  const requestPermission = async () => {
    // The Ubuntu desktop shell notifies via libnotify — no browser grant needed.
    if (isDesktopApp()) {
      onPermission('granted');
      return;
    }
    if (!notificationAPI) {
      onUnsupported();
      return;
    }
    onPermission(await requestBrowserNotificationPermission(notificationAPI));
  };

  if (typeof window !== 'undefined' && isDesktopApp() && permission !== 'granted') {
    return (
      <Button type="button" variant="outline" onClick={requestPermission} className="gap-2">
        <Bell className="h-4 w-4" />
        Enable system notifications
      </Button>
    );
  }

  const desktop = typeof window !== 'undefined' && isDesktopApp();

  return (
    <Button
      type="button"
      variant="outline"
      onClick={requestPermission}
      disabled={permission === 'granted' || permission === 'unsupported'}
      className="gap-2"
    >
      <Bell className="h-4 w-4" />
      {permission === 'granted'
        ? desktop
          ? 'System notifications enabled'
          : 'Browser notifications enabled'
        : permission === 'unsupported'
          ? 'Notifications unsupported'
          : desktop
            ? 'Enable system notifications'
            : 'Enable browser notifications'}
    </Button>
  );
}
