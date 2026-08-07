export interface ShowUpReminderSettings {
  enabled: boolean;
  time: string;
  days: number[];
}

export interface ZonedReminderTime {
  dateKey: string;
  weekday: number;
  minutes: number;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const FOREGROUND_REMINDER_VERSION = 'studybuddy:foreground-reminder:v1';

export const foregroundReminderDedupePrefix = (
  namespace: string,
  userId: string
): string => `${FOREGROUND_REMINDER_VERSION}:${encodeURIComponent(userId)}:${namespace}:`;

export const foregroundReminderDedupeKey = (
  namespace: string,
  userId: string,
  dateKey: string,
  instance?: string
): string => `${foregroundReminderDedupePrefix(namespace, userId)}${dateKey}${instance ? `:${instance}` : ''}`;

export const zonedReminderTime = (now: Date, timeZone: string): ZonedReminderTime | null => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
    }).formatToParts(now);
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
    const weekday = WEEKDAYS[get('weekday')];
    const hour = Number(get('hour'));
    const minute = Number(get('minute'));
    if (weekday === undefined || !Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return { dateKey: `${get('year')}-${get('month')}-${get('day')}`, weekday, minutes: hour * 60 + minute };
  } catch {
    return null;
  }
};

export const reminderDedupeKey = (userId: string, dateKey: string): string =>
  foregroundReminderDedupeKey('show-up', userId, dateKey);

export const shouldTriggerShowUpReminder = (
  now: Date,
  timeZone: string,
  userId: string,
  settings: ShowUpReminderSettings,
  alreadyFired: ReadonlySet<string> = new Set()
): { trigger: boolean; dateKey?: string; dedupeKey?: string } => {
  if (!userId || !settings.enabled || !/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.time)) return { trigger: false };
  const local = zonedReminderTime(now, timeZone);
  if (!local) return { trigger: false };
  if (settings.days.length > 0 && !settings.days.includes(local.weekday)) return { trigger: false, dateKey: local.dateKey };
  const [hour, minute] = settings.time.split(':').map(Number);
  const key = reminderDedupeKey(userId, local.dateKey);
  if (local.minutes < hour * 60 + minute || alreadyFired.has(key)) return { trigger: false, dateKey: local.dateKey, dedupeKey: key };
  return { trigger: true, dateKey: local.dateKey, dedupeKey: key };
};
