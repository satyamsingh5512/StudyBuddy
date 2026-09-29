/**
 * Manual drag-to-reorder for the dashboard to-do list.
 *
 * Todos have no server-side position field, so the order the user drags into is
 * kept on this device, keyed per user. It is a *preference layered on top of* the
 * priority sort, not a replacement: ids the user has placed keep their relative
 * order, and anything new (or never dragged) keeps its priority position.
 */

const STORAGE_PREFIX = 'sb_todo_order_v1:';
/** Bounded so a long-lived account cannot grow localStorage without limit. */
const MAX_IDS = 500;

export function applyManualOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  if (order.length === 0 || items.length < 2) return items;
  const rank = new Map<string, number>();
  order.forEach((id, index) => {
    if (!rank.has(id)) rank.set(id, index);
  });

  // Ordered items fill the slots that ordered items occupied in the priority
  // list; unordered items stay exactly where the priority sort put them.
  const ordered = items.filter((item) => rank.has(item.id));
  if (ordered.length < 2) return items;
  ordered.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));

  let cursor = 0;
  return items.map((item) => (rank.has(item.id) ? ordered[cursor++] : item));
}

/**
 * Records a completed drag. `visibleIds` is the list after the move; ids that were
 * ordered earlier but are not currently visible (another day, completed filter)
 * are kept after it so their placement is not forgotten.
 */
export function mergeOrder(previous: string[], visibleIds: string[]): string[] {
  const visible = new Set(visibleIds);
  const next = [...visibleIds, ...previous.filter((id) => !visible.has(id))];
  return next.slice(0, MAX_IDS);
}

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function loadTodoOrder(userId: string | undefined | null): string[] {
  if (!userId || typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey(userId)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string').slice(0, MAX_IDS) : [];
  } catch {
    return [];
  }
}

export function saveTodoOrder(userId: string | undefined | null, order: string[]): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(order.slice(0, MAX_IDS)));
  } catch {
    /* storage full or disabled: the order still applies for this session */
  }
}
