export interface NotificationPermissionAPI {
  requestPermission(): Promise<NotificationPermission>;
}

/**
 * This function must only be called from an explicit Settings interaction.
 * Reminder managers consume an already-granted permission and never call it.
 */
export const requestBrowserNotificationPermission = (
  notificationAPI: NotificationPermissionAPI
): Promise<NotificationPermission> => notificationAPI.requestPermission();
