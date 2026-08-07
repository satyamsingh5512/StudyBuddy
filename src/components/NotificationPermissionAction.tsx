'use client';

import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  requestBrowserNotificationPermission,
  type NotificationPermissionAPI,
} from '@/lib/notificationPermission';

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
    if (!notificationAPI) {
      onUnsupported();
      return;
    }
    onPermission(await requestBrowserNotificationPermission(notificationAPI));
  };

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
        ? 'Browser notifications enabled'
        : permission === 'unsupported'
          ? 'Notifications unsupported'
          : 'Enable browser notifications'}
    </Button>
  );
}
