import type { QueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/config/api';

interface RealtimeEvent {
  id: string;
  topic: string;
  at: string;
}

interface RealtimeChanges {
  enabled: boolean;
  events: RealtimeEvent[];
  cursor: string;
}

const CURSOR_KEY = 'sb_realtime_cursor_v1';
const DISABLED_RETRY_MS = 30_000;
const ERROR_RETRY_MS = 5_000;

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

const readCursor = (): string => {
  try {
    return window.sessionStorage.getItem(CURSOR_KEY) || '';
  } catch {
    return '';
  }
};

const saveCursor = (cursor: string) => {
  if (!cursor) return;
  try {
    window.sessionStorage.setItem(CURSOR_KEY, cursor);
  } catch {
    /* Session storage is optional. The next request safely starts at stream tail. */
  }
};

function invalidateForTopic(queryClient: QueryClient, topic: string) {
  switch (topic) {
    case 'todos':
      void queryClient.invalidateQueries({ queryKey: ['todos'] });
      void queryClient.invalidateQueries({ queryKey: ['efficiency'] });
      break;
    case 'timer':
    case 'analytics':
      void queryClient.invalidateQueries({ queryKey: ['timer', 'analytics'] });
      void queryClient.invalidateQueries({ queryKey: ['efficiency'] });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      void queryClient.invalidateQueries({ queryKey: ['userStats'] });
      break;
    case 'focus':
      window.dispatchEvent(new Event('studybuddy:focus-changed'));
      break;
    case 'leaderboard':
      void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      break;
    case 'rooms':
      // Personal room-scoped nudge (invite, role change, mention). The room's own
      // long-poll carries in-room activity; this only refreshes the user's lists.
      void queryClient.invalidateQueries({ queryKey: ['rooms', 'mine'] });
      void queryClient.invalidateQueries({ queryKey: ['rooms', 'achievements'] });
      break;
    default:
      // Future topics remain forward-compatible; no payload is trusted here.
      break;
  }
}

/**
 * Starts an authenticated Redis-Streams long-poll loop. It uses no document
 * payloads: each event only asks React Query to refetch authorized resources.
 */
export function startRealtimeSync(queryClient: QueryClient): () => void {
  if (typeof window === 'undefined') return () => undefined;

  let stopped = false;
  let controller: AbortController | null = null;
  let cursor = readCursor();

  const run = async () => {
    while (!stopped) {
      if (!navigator.onLine) {
        await wait(ERROR_RETRY_MS);
        continue;
      }

      controller = new AbortController();
      try {
        const params = new URLSearchParams({ timeout: '25' });
        if (cursor) params.set('cursor', cursor);
        const response = await apiFetch(`/realtime/changes?${params}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          await wait(response.status === 401 || response.status === 403 ? DISABLED_RETRY_MS : ERROR_RETRY_MS);
          continue;
        }
        const changes = (await response.json()) as RealtimeChanges;
        if (changes.cursor) {
          cursor = changes.cursor;
          saveCursor(cursor);
        }
        for (const event of Array.isArray(changes.events) ? changes.events : []) {
          invalidateForTopic(queryClient, event.topic);
        }
        if (!changes.enabled) await wait(DISABLED_RETRY_MS);
      } catch (error) {
        if (!stopped && !(error instanceof DOMException && error.name === 'AbortError')) {
          await wait(ERROR_RETRY_MS);
        }
      } finally {
        controller = null;
      }
    }
  };

  void run();
  return () => {
    stopped = true;
    controller?.abort();
  };
}
