import test from 'node:test';
import assert from 'node:assert/strict';
import { NotificationPermissionAction } from '../../src/components/NotificationPermissionAction.tsx';
import { startShowUpReminderLifecycle } from '../../src/lib/showUpReminderLifecycle.ts';

test('production Settings notification action requests permission only on its explicit click handler', async () => {
  let requestCalls = 0;
  let observedPermission: NotificationPermission | undefined;
  const element = NotificationPermissionAction({
    permission: 'default',
    notificationAPI: {
      requestPermission: async () => {
        requestCalls += 1;
        return 'granted';
      },
    },
    onPermission: (permission) => {
      observedPermission = permission;
    },
    onUnsupported: () => assert.fail('supported API was treated as unsupported'),
  });

  assert.equal(requestCalls, 0);
  await element.props.onClick();
  assert.equal(requestCalls, 1);
  assert.equal(observedPermission, 'granted');
});

test('production show-up reminder lifecycle consumes granted state without requesting permission', () => {
  let requestCalls = 0;
  let notificationCalls = 0;
  let toastCalls = 0;
  let clearedHandle: unknown;
  const values = new Map<string, string>();
  const notification = {
    permission: 'granted' as NotificationPermission,
    requestPermission: async () => {
      requestCalls += 1;
      return 'granted' as NotificationPermission;
    },
    show: () => {
      notificationCalls += 1;
    },
  };

  const stop = startShowUpReminderLifecycle({
    userId: 'notification-lifecycle-test-user',
    timeZone: 'Asia/Kolkata',
    settings: { enabled: true, time: '20:00', days: [] },
    toast: () => {
      toastCalls += 1;
    },
    fired: new Set(),
    environment: {
      now: () => new Date('2026-08-07T15:00:00.000Z'),
      storage: {
        get length() { return values.size; },
        key: (index) => [...values.keys()][index] ?? null,
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
      },
      visibilityState: () => 'hidden',
      notification,
      setInterval: () => 42,
      clearInterval: (handle) => {
        clearedHandle = handle;
      },
    },
  });

  assert.equal(requestCalls, 0);
  assert.equal(toastCalls, 1);
  assert.equal(notificationCalls, 1);
  stop();
  assert.equal(clearedHandle, 42);
  assert.equal(requestCalls, 0);
});
