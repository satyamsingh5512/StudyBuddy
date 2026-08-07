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

      // Browser notification (only if permitted and document not focused)
      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted' &&
        document.visibilityState !== 'visible'
      ) {
        try {
          new Notification(title, {
            body: body + (subject ? ` · ${subject}` : ''),
            icon: '/favicon.svg',
            tag: `studybuddy-alarm-${type}`,
          });
        } catch {
          // Notifications may fail in some browser contexts — ignore silently
        }
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
