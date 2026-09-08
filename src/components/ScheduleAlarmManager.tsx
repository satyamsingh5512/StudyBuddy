'use client';

/**
 * ScheduleAlarmManager
 *
 * Client-side alarm engine that:
 *  1. Polls every 30 seconds with setInterval
 *  2. Uses notification permission only when it was granted from Settings
 *  3. Fires an in-app toast + optional browser notification for each scheduled item:
 *     – 5 minutes before the task starts ("⏰ Starting soon")
 *     – Exactly at the task start time ("🚀 Time to start!")
 *  4. Tracks which items have already fired to avoid duplicate toasts
 *
 * Usage: mount once inside Schedule.tsx — no JSX rendered, pure side-effect component.
 */

import { useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import type { Schedule, ScheduleItem } from '@/lib/queries';
import { useAtomValue } from 'jotai';
import { userAtom } from '@/store/atoms';
import { foregroundReminderDedupeKey } from '@/lib/showUpReminder';
import { cancelNativeAlarms, scheduleNativeAlarms, stableAlarmId } from '@/lib/nativeAlarms';
import { desktopNotifySync } from '@/lib/desktop';

interface ScheduleAlarmManagerProps {
  schedules: Schedule[];
}

function timeToMinutesOfDay(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatTime12(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m ?? 0).padStart(2, '0')} ${ampm}`;
}

// Global store of alarm IDs that have already fired this session.
// Using a module-level Set so it survives re-renders without causing re-renders.
const firedAlarms = new Set<string>();

export default function ScheduleAlarmManager({ schedules }: ScheduleAlarmManagerProps) {
  const user = useAtomValue(userAtom);
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Native layer (APK): mirror upcoming alarms into the OS notification tray
  // so they fire even when the WebView is backgrounded or the phone sleeps.
  // Stable ids make rescheduling idempotent; completed items cancel theirs.
  useEffect(() => {
    if (!user || !schedules || schedules.length === 0) return;
    let cancelled = false;

    const syncNative = async () => {
      try {
        const { ensureAlarmPermission } = await import('@/lib/nativeAlarms');
        const granted = await ensureAlarmPermission().catch(() => false);
        if (!granted || cancelled) return;

        const now = new Date();
        const horizon = now.getTime() + 7 * 24 * 60 * 60 * 1000;
        const toSchedule: { id: number; title: string; body: string; at: Date; tag?: string }[] = [];
        const toCancel: number[] = [];

        for (const schedule of schedules) {
          for (const item of schedule.items) {
            const warnId = stableAlarmId(`${schedule.id}:${item.id}:warn`);
            const startId = stableAlarmId(`${schedule.id}:${item.id}:start`);
            if (item.completed) {
              toCancel.push(warnId, startId);
              continue;
            }
            const startAt = new Date(`${schedule.date}T${item.startTime}:00`);
            if (!Number.isFinite(startAt.getTime()) || startAt.getTime() > horizon) continue;
            const warnAt = new Date(startAt.getTime() - 5 * 60 * 1000);
            if (warnAt.getTime() > Date.now()) {
              toSchedule.push({
                id: warnId,
                title: `⏰ Starting in 5 min: ${item.taskTitle}`,
                body: `Starts at ${formatTime12(item.startTime)}${item.subject ? ` · ${item.subject}` : ''}`,
                at: warnAt,
                tag: 'schedule-warn',
              });
            }
            if (startAt.getTime() > Date.now()) {
              toSchedule.push({
                id: startId,
                title: `🚀 Time to start: ${item.taskTitle}`,
                body: `${formatTime12(item.startTime)} – ${formatTime12(item.endTime)}${item.subject ? ` · ${item.subject}` : ''}`,
                at: startAt,
                tag: 'schedule-start',
              });
            }
          }
        }

        if (toCancel.length > 0) await cancelNativeAlarms(toCancel);
        if (toSchedule.length > 0) await scheduleNativeAlarms(toSchedule);
      } catch {
        /* offline / web — foreground toasts below still cover it */
      }
    };

    void syncNative();
    return () => {
      cancelled = true;
    };
  }, [schedules, user]);

  useEffect(() => {
    if (!user || !schedules || schedules.length === 0) return;

    const checkAlarms = () => {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const nowMins = now.getHours() * 60 + now.getMinutes();

      for (const schedule of schedules) {
        // Only alarm for today's schedule
        if (schedule.date !== todayStr) continue;

        for (const item of schedule.items) {
          if (item.completed) continue;

          const startMins = timeToMinutesOfDay(item.startTime);
          const diffMins = startMins - nowMins;

          // "5 minutes before" alarm
          const warnKey = foregroundReminderDedupeKey('schedule', user.id, todayStr, `${item.id}:warn`);
          if (!firedAlarms.has(warnKey) && diffMins > 0 && diffMins <= 5) {
            firedAlarms.add(warnKey);
            fireAlarm({
              title: `⏰ Starting in ${Math.round(diffMins)} min`,
              body: `${item.taskTitle} starts at ${formatTime12(item.startTime)}`,
              subject: item.subject,
              type: 'warn',
            });
          }

          // "Start now" alarm (within 0–1 minute window)
          const startKey = foregroundReminderDedupeKey('schedule', user.id, todayStr, `${item.id}:start`);
          if (!firedAlarms.has(startKey) && diffMins >= 0 && diffMins < 1) {
            firedAlarms.add(startKey);
            fireAlarm({
              title: `🚀 Time to start!`,
              body: `${item.taskTitle} (${formatTime12(item.startTime)} – ${formatTime12(item.endTime)})`,
              subject: item.subject,
              type: 'start',
            });
          }
        }
      }
    };

    const fireAlarm = ({
      title,
      body,
      subject,
      type,
    }: {
      title: string;
      body: string;
      subject?: string;
      type: 'warn' | 'start';
    }) => {
      // In-app toast
      toastRef.current({
        title,
        description: body + (subject ? ` · ${subject}` : ''),
        duration: 8000,
      });

      // OS notification when the tab is hidden (desktop shell routes through
      // libnotify via the main process; browsers use Web Notifications).
      if (typeof window !== 'undefined' && document.visibilityState !== 'visible') {
        desktopNotifySync(title, body + (subject ? ` · ${subject}` : ''), `studybuddy-alarm-${type}`);
      }
    };

    // Run immediately on mount, then every 30 seconds
    checkAlarms();
    const interval = setInterval(checkAlarms, 30 * 1000);
    return () => clearInterval(interval);
  }, [schedules, user]);

  // No visible output — this is a pure side-effect component
  return null;
}
