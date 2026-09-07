/**
 * Native alarms bridge.
 *
 * - On the Capacitor APK: schedules local notifications via
 *   @capacitor/local-notifications (dynamic import — safe on web).
 * - On web: no-op — the existing foreground toast engine remains the delivery
 *   path.
 *
 * Callers pass stable numeric ids derived from the schedule item so
 * re-scheduling the same item overwrites instead of duplicating.
 */

export interface NativeAlarm {
  id: number;
  title: string;
  body: string;
  at: Date;
  tag?: string;
}

type LocalNotificationsBridge = {
  checkPermissions?: () => Promise<{ display?: string }>;
  requestPermissions: () => Promise<{ display?: string }>;
  createChannel?: (channel: unknown) => Promise<unknown>;
  checkExactNotificationSetting?: () => Promise<{ exact_alarm?: string }>;
  changeExactNotificationSetting?: () => Promise<{ exact_alarm?: string }>;
  schedule: (opts: unknown) => Promise<unknown>;
  cancel: (opts: unknown) => Promise<unknown>;
};

const ALARM_CHANNEL_ID = 'studybuddy-alarms';

export function stableAlarmId(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash % 2000000000);
}

async function localNotifications(): Promise<LocalNotificationsBridge | null> {
  try {
    const { Capacitor } = (await import('@capacitor/core').catch(() => ({ Capacitor: null }))) as {
      Capacitor?: { isNativePlatform?: () => boolean };
    };
    if (!Capacitor?.isNativePlatform?.()) return null;
    const mod = await import('@capacitor/local-notifications').catch(() => null);
    return (mod?.LocalNotifications as LocalNotificationsBridge | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function ensureAlarmPermission(): Promise<boolean> {
  try {
    const ln = await localNotifications();
    if (!ln) {
      return typeof Notification !== 'undefined' && Notification.permission === 'granted';
    }
    const current = await ln.checkPermissions?.().catch(() => null);
    const permission =
      current?.display === 'granted' || current?.display === 'denied'
        ? current
        : await ln.requestPermissions().catch(() => null);
    return permission?.display === 'granted';
  } catch {
    return false;
  }
}

/** Exact scheduling is opt-in on Android 12+. Inexact alarms still fall back safely. */
export async function hasExactAlarmPermission(): Promise<boolean | null> {
  const ln = await localNotifications();
  if (!ln?.checkExactNotificationSetting) return null;
  try {
    return (await ln.checkExactNotificationSetting()).exact_alarm === 'granted';
  } catch {
    return false;
  }
}

/** Opens the Android per-app Exact Alarms screen only after an explicit user action. */
export async function requestExactAlarmPermission(): Promise<boolean> {
  const ln = await localNotifications();
  if (!ln?.changeExactNotificationSetting) return false;
  if ((await hasExactAlarmPermission()) === true) return true;
  try {
    await ln.changeExactNotificationSetting();
    return (await hasExactAlarmPermission()) === true;
  } catch {
    return false;
  }
}

async function ensureAlarmChannel(ln: LocalNotificationsBridge): Promise<void> {
  try {
    await ln.createChannel?.({
      id: ALARM_CHANNEL_ID,
      name: 'Study reminders',
      description: 'Scheduled StudyBuddy task and focus reminders',
      importance: 4,
      visibility: 1,
      vibration: true,
    });
  } catch {
    /* channel creation is idempotent; default channel remains a fallback */
  }
}

/** Schedule (or reschedule) native alarms. Past times are skipped. */
export async function scheduleNativeAlarms(alarms: NativeAlarm[]): Promise<void> {
  const ln = await localNotifications();
  if (!ln) return;
  const now = Date.now();
  const upcoming = alarms
    .filter((alarm) => alarm.at.getTime() > now + 5_000)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, 50);
  if (upcoming.length === 0) return;
  try {
    await ensureAlarmChannel(ln);
    await ln.schedule({
      notifications: upcoming.map((alarm) => ({
        id: alarm.id,
        title: alarm.title,
        body: alarm.body,
        schedule: { at: alarm.at, allowWhileIdle: true },
        channelId: ALARM_CHANNEL_ID,
        smallIcon: 'ic_stat_studybuddy',
        extra: alarm.tag ? { tag: alarm.tag } : undefined,
      })),
    });
  } catch {
    /* alarms are best-effort; foreground reminders remain available */
  }
}

export async function cancelNativeAlarms(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const ln = await localNotifications();
  if (!ln) return;
  try {
    await ln.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch {
    /* ignore */
  }
}
