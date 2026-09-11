'use client';

export interface PromptHistoryEntry {
  prompt: string;
  date: string; // YYYY-MM-DD the prompt was used for
  createdAt: string; // ISO timestamp
  source: 'local' | 'schedule';
}

const STORAGE_KEY = 'studybuddy:schedule-prompt-history:v1';
const MAX_ENTRIES = 20;

function safeParse(raw: string | null): PromptHistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e && typeof e.prompt === 'string' && e.prompt.trim().length > 0)
      .map((e) => ({
        prompt: String(e.prompt).slice(0, 2000),
        date: typeof e.date === 'string' ? e.date : '',
        createdAt: typeof e.createdAt === 'string' ? e.createdAt : new Date().toISOString(),
        source: 'local' as const,
      }));
  } catch {
    return [];
  }
}

export function loadPromptHistory(): PromptHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return safeParse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function savePromptToHistory(prompt: string, date: string): PromptHistoryEntry[] {
  const trimmed = prompt.trim();
  if (!trimmed || typeof window === 'undefined') return loadPromptHistory();
  const entry: PromptHistoryEntry = {
    prompt: trimmed.slice(0, 2000),
    date,
    createdAt: new Date().toISOString(),
    source: 'local',
  };
  const existing = loadPromptHistory().filter((e) => e.prompt !== entry.prompt);
  const next = [entry, ...existing].slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage full / unavailable — history is best-effort */
  }
  return next;
}

export function removePromptFromHistory(prompt: string): PromptHistoryEntry[] {
  const next = loadPromptHistory().filter((e) => e.prompt !== prompt);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function clearPromptHistory(): PromptHistoryEntry[] {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return [];
}

/**
 * Merge locally saved prompts with prompts recovered from past schedules.
 * Schedules are the source of truth for prompts generated on other devices;
 * local entries preserve ordering for the current device. De-duplicated by
 * prompt text, newest first.
 */
export function mergeHistory(
  local: PromptHistoryEntry[],
  schedules: Array<{ prompt?: string; date?: string; generatedAt?: string; createdAt?: string }>
): PromptHistoryEntry[] {
  const seen = new Set<string>();
  const merged: PromptHistoryEntry[] = [];

  for (const e of local) {
    const key = e.prompt.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(e);
  }
  for (const s of schedules ?? []) {
    const prompt = (s.prompt ?? '').trim();
    if (!prompt || seen.has(prompt)) continue;
    seen.add(prompt);
    merged.push({
      prompt,
      date: s.date ?? '',
      createdAt: s.generatedAt ?? s.createdAt ?? new Date().toISOString(),
      source: 'schedule',
    });
  }

  merged.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return merged.slice(0, MAX_ENTRIES);
}
