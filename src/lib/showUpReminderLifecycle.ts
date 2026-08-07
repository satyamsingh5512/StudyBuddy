import {
  foregroundReminderDedupePrefix,
  shouldTriggerShowUpReminder,
  type ShowUpReminderSettings,
} from '@/lib/showUpReminder';

interface ReminderStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ReminderNotificationGateway {
  readonly permission: NotificationPermission;
  show(title: string, options: NotificationOptions): void;
}

interface ShowUpReminderLifecycleEnvironment {
  now(): Date;
  storage?: ReminderStorage;
  visibilityState(): DocumentVisibilityState;
  notification?: ReminderNotificationGateway;
  setInterval(callback: () => void, delay: number): unknown;
  clearInterval(handle: unknown): void;
}

interface StartShowUpReminderLifecycleOptions {
  userId: string;
  timeZone: string;
  settings: ShowUpReminderSettings;
  toast(message: { title: string; description: string; duration: number }): void;
  environment: ShowUpReminderLifecycleEnvironment;
  fired?: Set<string>;
}

const sessionFired = new Set<string>();

/** Starts the foreground reminder poller. It consumes permission state but never requests it. */
export const startShowUpReminderLifecycle = ({
  userId,
  timeZone,
  settings,
  toast,
  environment,
  fired = sessionFired,
}: StartShowUpReminderLifecycleOptions): (() => void) => {
  if (!settings.enabled) return () => undefined;

  const check = () => {
    const knownFired = new Set(fired);
    const prefix = foregroundReminderDedupePrefix('show-up', userId);
    const storage = environment.storage;
    if (storage) {
      try {
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index);
          if (key?.startsWith(prefix) && storage.getItem(key)) knownFired.add(key);
        }
      } catch {
        // Foreground session state still deduplicates when storage is unavailable.
      }
    }

    const decision = shouldTriggerShowUpReminder(
      environment.now(),
      timeZone,
      userId,
      settings,
      knownFired
    );
    if (!decision.trigger || !decision.dedupeKey) return;

    fired.add(decision.dedupeKey);
    try {
      storage?.setItem(decision.dedupeKey, '1');
    } catch {
      // Foreground session state still deduplicates when storage is unavailable.
    }

    toast({
      title: 'Time to show up',
      description: 'Record today’s progress for your active goals.',
      duration: 9000,
    });

    if (
      environment.notification?.permission === 'granted' &&
      environment.visibilityState() !== 'visible'
    ) {
      try {
        environment.notification.show('Time to show up', {
          body: 'Record today’s progress for your active StudyBuddy goals.',
          icon: '/icons/icon-192.png',
          tag: `studybuddy-show-up-${userId}-${decision.dateKey}`,
        });
      } catch {
        // Notification support varies by browser context.
      }
    }
  };

  check();
  const interval = environment.setInterval(check, 30_000);
  return () => environment.clearInterval(interval);
};
