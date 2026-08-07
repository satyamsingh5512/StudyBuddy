import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DashboardWidgetLayout from '../../src/components/dashboard/DashboardWidgetLayout.tsx';
import { APPEARANCE_PREPAINT_SCRIPT } from '../../src/lib/appearancePrepaint.ts';
import { ACCENT_IDS } from '../../src/types/content.ts';
import {
  ACCENT_OPTIONS,
  APPEARANCE_STORAGE_KEY,
  DASHBOARD_WIDGET_IDS,
  applyAppearancePreferences,
  isValidTimeZone,
  normalizeDashboardPreferences,
  normalizePreferences,
  orderedVisibleDashboardWidgetIds,
} from '../../src/lib/preferences.ts';

const expectedAccents = [
  'blue', 'violet', 'teal', 'green', 'orange', 'rose', 'purple',
  'indigo', 'cyan', 'lime', 'yellow', 'amber', 'red', 'pink',
] as const;

const renderDashboardComposition = (preferences: ReturnType<typeof normalizePreferences>) => {
  const renderers = Object.fromEntries(
    DASHBOARD_WIDGET_IDS.map((id) => [id, id])
  ) as Partial<Record<(typeof DASHBOARD_WIDGET_IDS)[number], ReactNode>>;
  return renderToStaticMarkup(createElement(DashboardWidgetLayout, {
    orderedVisibleIds: orderedVisibleDashboardWidgetIds(preferences),
    renderers,
  }));
};

const executePrepaint = (appearance: unknown) => {
  const root = {
    classList: { toggle: () => undefined },
    dataset: {} as Record<string, string>,
    style: {} as Record<string, string>,
  };
  runInNewContext(APPEARANCE_PREPAINT_SCRIPT, {
    document: { documentElement: root },
    localStorage: {
      getItem: (key: string) => key === APPEARANCE_STORAGE_KEY ? JSON.stringify(appearance) : null,
    },
    window: { matchMedia: () => ({ matches: false }) },
  });
  return root.dataset;
};

test('old-user preferences receive safe defaults', () => {
  const preferences = normalizePreferences();
  assert.equal(preferences.font, 'sans');
  assert.equal(preferences.accent, 'blue');
  assert.deepEqual(preferences.dashboard.order, DASHBOARD_WIDGET_IDS);
  assert.deepEqual(preferences.dashboard.hidden, []);
  assert.equal(preferences.showUpReminder.time, '20:00');
});

test('dashboard registry advertises only independent top-level widgets', () => {
  assert.deepEqual(DASHBOARD_WIDGET_IDS, ['overview', 'goals', 'schedule', 'leaderboard', 'daily-summary', 'weekly-check-in', 'achievements', 'quick-show-up']);
  for (const fixedId of ['timer', 'tasks', 'activity', 'efficiency', 'analytics']) {
    assert.equal((DASHBOARD_WIDGET_IDS as readonly string[]).includes(fixedId), false);
  }
});

test('production dashboard layout renders saved order and excludes hidden widgets', () => {
  const preferences = normalizePreferences({
    dashboard: {
      order: ['quick-show-up', 'overview', 'achievements'],
      hidden: ['overview'],
    },
  });
  const markup = renderDashboardComposition(preferences);

  assert.equal(markup.includes('data-widget-id="overview"'), false);
  assert.ok(markup.indexOf('data-widget-id="quick-show-up"') < markup.indexOf('data-widget-id="achievements"'));
  assert.equal((markup.match(/data-widget-id=/g) || []).length, DASHBOARD_WIDGET_IDS.length - 1);
});

test('dashboard order and hidden IDs are unique, allowlisted, and complete', () => {
  const dashboard = normalizeDashboardPreferences({
    order: ['quick-show-up', 'unknown', 'goals', 'quick-show-up'],
    hidden: ['overview', 'unknown', 'overview'],
  });
  assert.deepEqual(dashboard.order.slice(0, 2), ['quick-show-up', 'goals']);
  assert.equal(new Set(dashboard.order).size, DASHBOARD_WIDGET_IDS.length);
  assert.deepEqual(dashboard.hidden, ['overview']);
});

test('all fourteen accents share the type, controls, normalizer, executable pre-paint, backend, and CSS contracts', () => {
  assert.deepEqual(ACCENT_IDS, expectedAccents);
  assert.deepEqual(ACCENT_OPTIONS.map((option) => option.id), expectedAccents);

  for (const accent of expectedAccents) {
    assert.equal(normalizePreferences({ accent }).accent, accent);
    assert.equal(executePrepaint({ font: 'serif', accent }).accent, accent);
  }
  assert.deepEqual(executePrepaint({ font: 'invalid', accent: 'javascript:bad' }), {
    theme: 'light',
    font: 'sans',
    accent: 'blue',
  });

  const css = readFileSync(new URL('../../src/styles/studybuddy-theme.css', import.meta.url), 'utf8');
  for (const accent of expectedAccents) {
    assert.match(css, new RegExp(`:root\\[data-accent='${accent}'\\] \\{[^}]*--accent-raw: #[0-9a-f]{6};[^}]*--accent-rgb: \\d+ \\d+ \\d+;[^}]*\\}`));
  }

  const backendModel = readFileSync(new URL('../../backend/internal/models/user.go', import.meta.url), 'utf8');
  const declaration = backendModel.match(/PreferenceAccentIDs = \[\]string\{([^}]+)\}/)?.[1] || '';
  const backendAccents = [...declaration.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(backendAccents, expectedAccents);
});

test('appearance application rejects arbitrary values and persists normalized choice', () => {
  const root = { dataset: {} as DOMStringMap };
  const values = new Map<string, string>();
  const storage = { setItem: (key: string, value: string) => values.set(key, value) };
  const applied = applyAppearancePreferences({ font: 'serif', accent: 'teal' }, root, storage);
  assert.deepEqual(applied, { font: 'serif', accent: 'teal' });
  assert.equal(root.dataset.font, 'serif');
  assert.equal(root.dataset.accent, 'teal');
  assert.deepEqual(JSON.parse(values.get(APPEARANCE_STORAGE_KEY)!), applied);

  applyAppearancePreferences({ font: 'comic' as never, accent: 'javascript:bad' as never }, root, storage);
  assert.equal(root.dataset.font, 'sans');
  assert.equal(root.dataset.accent, 'blue');
});

test('timezone validation accepts IANA zones and rejects arbitrary labels', () => {
  assert.equal(isValidTimeZone('Asia/Kolkata'), true);
  assert.equal(isValidTimeZone('Not/AZone'), false);
});
