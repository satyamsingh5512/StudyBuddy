import type {
  Achievement,
  JournalDraft,
  MentorHistoryMessage,
  MentorMessage,
  MentorRequest,
} from '@/types/content';

export const JOURNAL_AUTOSAVE_MS = 750;
export const JOURNAL_MAX_DAYS = 366;
export const MENTOR_MAX_HISTORY = 12;
export const MENTOR_MAX_MESSAGE_RUNES = 2000;
export const MENTOR_THREAD_LIMIT = 25;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ATTACHMENT_PATH = /^\/api\/journal\/attachments\/([0-9a-f]{24})$/i;
const IMAGE_MARKDOWN = /!\[[^\]]*\]\((?:\/api)?\/journal\/attachments\/([0-9a-f]{24})(?:\s+"[^"]*")?\)/gi;

export const dateKey = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const isDateKey = (value: string): boolean => {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

export const addJournalDays = (value: string, amount: number): string => {
  if (!isDateKey(value)) throw new Error('Invalid journal date');
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}`;
};

export const journalYearRange = (value: string): { from: string; to: string } => {
  if (!isDateKey(value)) throw new Error('Invalid journal date');
  const year = value.slice(0, 4);
  return { from: `${year}-01-01`, to: `${year}-12-31` };
};

export const journalDraftKey = (value: string): string => `studybuddy:journal-draft:${value}`;

export const parseJournalDraft = (raw: string | null, date: string): JournalDraft | null => {
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as Partial<JournalDraft>;
    if (
      draft.date !== date ||
      typeof draft.markdown !== 'string' ||
      !Number.isSafeInteger(draft.baseRevision) ||
      Number(draft.baseRevision) < 0 ||
      typeof draft.savedAt !== 'string'
    ) {
      return null;
    }
    return draft as JournalDraft;
  } catch {
    return null;
  }
};

export type MarkdownTransform =
  | 'bold'
  | 'italic'
  | 'underline-equivalent'
  | 'highlight'
  | 'link'
  | 'bullets'
  | 'numbering';

export interface TextTransformResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

const wrapSelection = (
  value: string,
  start: number,
  end: number,
  before: string,
  after = before,
  placeholder = 'text'
): TextTransformResult => {
  const selected = value.slice(start, end) || placeholder;
  const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
  const selectionStart = start + before.length;
  return { value: next, selectionStart, selectionEnd: selectionStart + selected.length };
};

const transformLines = (
  value: string,
  start: number,
  end: number,
  numbered: boolean
): TextTransformResult => {
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEndIndex = value.indexOf('\n', end);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const transformed = lines
    .map((line, index) => `${numbered ? `${index + 1}.` : '-'} ${line.replace(/^\s*(?:[-*+] |\d+\. )/, '')}`)
    .join('\n');
  return {
    value: `${value.slice(0, lineStart)}${transformed}${value.slice(lineEnd)}`,
    selectionStart: lineStart,
    selectionEnd: lineStart + transformed.length,
  };
};

export const applyMarkdownTransform = (
  value: string,
  start: number,
  end: number,
  transform: MarkdownTransform,
  linkUrl = 'https://'
): TextTransformResult => {
  const safeStart = Math.max(0, Math.min(start, value.length));
  const safeEnd = Math.max(safeStart, Math.min(end, value.length));
  switch (transform) {
    case 'bold':
      return wrapSelection(value, safeStart, safeEnd, '**', '**', 'bold text');
    case 'italic':
      return wrapSelection(value, safeStart, safeEnd, '_', '_', 'italic text');
    case 'underline-equivalent':
      return wrapSelection(value, safeStart, safeEnd, '~~', '~~', 'marked text');
    case 'highlight':
      return wrapSelection(value, safeStart, safeEnd, '`', '`', 'highlighted text');
    case 'link': {
      const label = value.slice(safeStart, safeEnd) || 'link text';
      const url = sanitizeMarkdownUrl(linkUrl, 'link') || 'https://';
      const replacement = `[${label}](${url})`;
      return {
        value: `${value.slice(0, safeStart)}${replacement}${value.slice(safeEnd)}`,
        selectionStart: safeStart + 1,
        selectionEnd: safeStart + 1 + label.length,
      };
    }
    case 'bullets':
      return transformLines(value, safeStart, safeEnd, false);
    case 'numbering':
      return transformLines(value, safeStart, safeEnd, true);
  }
};

export const sanitizeMarkdownUrl = (url: string, kind: 'link' | 'image'): string => {
  const candidate = url.trim();
  if (kind === 'image') return ATTACHMENT_PATH.test(candidate) ? candidate : '';
  if (/^https?:\/\//i.test(candidate) || /^mailto:/i.test(candidate)) return candidate;
  return /^#[A-Za-z][\w:.-]*$/.test(candidate) ? candidate : '';
};

export const extractJournalAttachmentIds = (markdown: string): string[] => {
  const ids = new Set<string>();
  IMAGE_MARKDOWN.lastIndex = 0;
  for (const match of markdown.matchAll(IMAGE_MARKDOWN)) ids.add(match[1].toLowerCase());
  return [...ids];
};

export const removeJournalAttachment = (markdown: string, id: string): string => {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return markdown
    .replace(
      new RegExp(`!\\[[^\\]]*\\]\\((?:/api)?/journal/attachments/${escaped}(?:\\s+"[^"]*")?\\)`, 'gi'),
      ''
    )
    .replace(/\n{3,}/g, '\n\n');
};

export const JOURNAL_MAX_MARKDOWN_BYTES = 64 * 1024;

export const journalMarkdownBytes = (markdown: string): number =>
  new TextEncoder().encode(markdown).byteLength;

export const journalMarkdownWithinLimit = (markdown: string): boolean =>
  journalMarkdownBytes(markdown) <= JOURNAL_MAX_MARKDOWN_BYTES;

export interface JournalSaveRequest {
  date: string;
  markdown: string;
  expectedRevision: number;
}

export interface JournalSaveResult {
  entry: import('@/types/content').JournalEntry;
  markdown: string;
}

type JournalSaveTransport = (
  request: JournalSaveRequest
) => Promise<import('@/types/content').JournalEntry>;

type PendingJournalSave = {
  markdown: string;
  waiters: Array<{
    resolve: (result: JournalSaveResult) => void;
    reject: (error: unknown) => void;
  }>;
};

/**
 * Owns the revision chain for one journal date. At most one transport call can
 * run at a time; edits made while it runs collapse into one latest queued save.
 * Request cancellation is deliberately left to the UI lifecycle, never used as
 * a concurrency mechanism.
 */
export class JournalSaveSequencer {
  private active: { markdown: string; promise: Promise<JournalSaveResult> } | null = null;
  private pending: PendingJournalSave | null = null;

  constructor(
    readonly date: string,
    private currentRevision: number,
    private readonly transport: JournalSaveTransport
  ) {}

  get revision(): number {
    return this.currentRevision;
  }

  get isSaving(): boolean {
    return this.active !== null || this.pending !== null;
  }

  enqueue(markdown: string): Promise<JournalSaveResult> {
    if (this.active?.markdown === markdown && this.pending === null) {
      return this.active.promise;
    }

    const result = new Promise<JournalSaveResult>((resolve, reject) => {
      if (this.pending) {
        this.pending.markdown = markdown;
        this.pending.waiters.push({ resolve, reject });
      } else {
        this.pending = { markdown, waiters: [{ resolve, reject }] };
      }
    });
    this.drain();
    return result;
  }

  cancelPending(reason: unknown = new DOMException('Journal date changed', 'AbortError')): void {
    const pending = this.pending;
    this.pending = null;
    pending?.waiters.forEach(({ reject }) => reject(reason));
  }

  private drain(): void {
    if (this.active || !this.pending) return;

    const pending = this.pending;
    this.pending = null;
    const expectedRevision = this.currentRevision;
    const markdown = pending.markdown;
    const promise = this.transport({
      date: this.date,
      markdown,
      expectedRevision,
    }).then((entry) => {
      if (entry.date !== this.date || entry.revision <= expectedRevision) {
        throw new Error('Journal save returned an invalid revision');
      }
      this.currentRevision = entry.revision;
      const result = { entry, markdown };
      pending.waiters.forEach(({ resolve }) => resolve(result));
      return result;
    });

    this.active = { markdown, promise };
    void promise.then(
      () => {
        this.active = null;
        this.drain();
      },
      (error) => {
        pending.waiters.forEach(({ reject }) => reject(error));
        const queued = this.pending;
        this.pending = null;
        queued?.waiters.forEach(({ reject }) => reject(error));
        this.active = null;
      }
    );
  }
}

const truncateRunes = (value: string, maximum: number): string =>
  Array.from(value.trim()).slice(0, maximum).join('');

export const buildMentorRequest = (
  messages: Pick<MentorMessage, 'role' | 'content'>[],
  message: string,
  includeJournal: boolean
): MentorRequest => {
  const history: MentorHistoryMessage[] = messages
    .filter((item) => (item.role === 'user' || item.role === 'assistant') && item.content.trim())
    .slice(-MENTOR_MAX_HISTORY)
    .map((item) => ({ role: item.role, content: truncateRunes(item.content, MENTOR_MAX_MESSAGE_RUNES) }));
  return {
    message: truncateRunes(message, MENTOR_MAX_MESSAGE_RUNES),
    history,
    maxOutputTokens: 600,
    includeJournal,
  };
};

export const appendMentorExchange = (
  messages: MentorMessage[],
  additions: MentorMessage[]
): MentorMessage[] => [...messages, ...additions].slice(-MENTOR_THREAD_LIMIT);

export const STREAK_THRESHOLDS = [3, 5, 7, 14, 30, 60, 100, 365] as const;
export const GOAL_THRESHOLDS = [1, 3, 5, 10] as const;

export const achievementProgress = (progress: number, target: number): number => {
  if (!Number.isFinite(progress) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((progress / target) * 100)));
};

export const deriveAchievements = (bestStreak: number, completedGoals: number): Achievement[] => {
  const streak = Math.max(0, Math.floor(bestStreak || 0));
  const goals = Math.max(0, Math.floor(completedGoals || 0));
  return [
    ...STREAK_THRESHOLDS.map((target) => ({
      id: `streak-${target}`,
      category: 'streak' as const,
      title: `${target} day streak`,
      target,
      progress: Math.min(streak, target),
      earned: streak >= target,
    })),
    ...GOAL_THRESHOLDS.map((target) => ({
      id: `goals-${target}`,
      category: 'goals' as const,
      title: `Complete ${target} goals`,
      target,
      progress: Math.min(goals, target),
      earned: goals >= target,
    })),
  ];
};
