import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/config/api';
import { JOURNAL_MAX_MARKDOWN_BYTES, journalMarkdownBytes } from '@/lib/contentUtils';
import type {
  AchievementsResponse,
  JournalAttachment,
  JournalEntry,
  MentorRequest,
  MentorResponse,
} from '@/types/content';

export const CONTENT_QUERY_KEYS = {
  journal: () => ['journal'] as const,
  journalEntry: (date: string) => ['journal', 'entry', date] as const,
  journalRange: (from: string, to: string) => ['journal', 'range', from, to] as const,
  achievements: () => ['achievements'] as const,
};

export type ContentApiErrorKind =
  | 'network'
  | 'validation'
  | 'revision-conflict'
  | 'attachment-conflict'
  | 'server';

export class ContentApiError extends Error {
  constructor(
    message: string,
    readonly kind: ContentApiErrorKind,
    readonly status?: number
  ) {
    super(message);
    this.name = 'ContentApiError';
  }
}

export class ContentNetworkError extends ContentApiError {
  constructor(message = 'Network request failed', readonly cause?: unknown) {
    super(message, 'network');
    this.name = 'ContentNetworkError';
  }
}

export class ContentValidationError extends ContentApiError {
  constructor(message: string, status = 400) {
    super(message, 'validation', status);
    this.name = 'ContentValidationError';
  }
}

export class ContentServerError extends ContentApiError {
  constructor(message: string, status?: number) {
    super(message, 'server', status);
    this.name = 'ContentServerError';
  }
}

export class JournalConflictError extends ContentApiError {
  constructor(message: string, readonly current: JournalEntry) {
    super(message, 'revision-conflict', 409);
    this.name = 'JournalConflictError';
  }
}

export type JournalAttachmentConflictReason = 'referenced' | 'deleting' | 'unavailable';

export class JournalAttachmentConflictError extends ContentApiError {
  constructor(message: string, readonly reason: JournalAttachmentConflictReason) {
    super(message, 'attachment-conflict', 409);
    this.name = 'JournalAttachmentConflictError';
  }
}

type ErrorBody = { error?: string; message?: string; current?: JournalEntry };

const readErrorBody = async (response: Response): Promise<ErrorBody> =>
  (await response.json().catch(() => ({}))) as ErrorBody;

const responseMessage = (body: ErrorBody, fallback: string): string =>
  body.error || body.message || fallback;

const fetchContent = async (path: string, options?: RequestInit): Promise<Response> => {
  try {
    return await apiFetch(path, options);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ContentNetworkError('Unable to reach StudyBuddy. Check your connection and retry.', error);
  }
};

const throwResponseError = async (response: Response, fallback: string): Promise<never> => {
  const body = await readErrorBody(response);
  const message = responseMessage(body, fallback);
  if (response.status === 400 || response.status === 413 || response.status === 422) {
    throw new ContentValidationError(message, response.status);
  }
  throw new ContentServerError(message, response.status);
};

const fetchContentJSON = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const headers = new Headers(options?.headers);
  if (options?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetchContent(path, { ...options, headers });
  if (!response.ok) return throwResponseError(response, 'Request failed');
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};

export const saveJournalEntry = async (
  date: string,
  markdown: string,
  expectedRevision: number,
  signal?: AbortSignal
): Promise<JournalEntry> => {
  const bytes = journalMarkdownBytes(markdown);
  if (bytes > JOURNAL_MAX_MARKDOWN_BYTES) {
    throw new ContentValidationError(
      `Journal entry is ${bytes.toLocaleString()} bytes; reduce it to ${JOURNAL_MAX_MARKDOWN_BYTES.toLocaleString()} bytes or less.`
    );
  }

  const response = await fetchContent(`/journal/${encodeURIComponent(date)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown, expectedRevision }),
    signal,
  });
  if (response.status === 409) {
    const body = await readErrorBody(response);
    if (body.current) {
      throw new JournalConflictError(responseMessage(body, 'Journal revision conflict'), body.current);
    }
    throw new JournalAttachmentConflictError(
      responseMessage(body, 'Journal references an unavailable attachment.'),
      'unavailable'
    );
  }
  if (!response.ok) return throwResponseError(response, 'Journal could not be saved');
  return response.json() as Promise<JournalEntry>;
};

export const fetchJournalEntry = (date: string): Promise<JournalEntry> =>
  fetchContentJSON<JournalEntry>(`/journal/${encodeURIComponent(date)}`);

export const useJournalEntry = (date: string) =>
  useQuery<JournalEntry, ContentApiError>({
    queryKey: CONTENT_QUERY_KEYS.journalEntry(date),
    queryFn: () => fetchJournalEntry(date),
    enabled: Boolean(date),
    staleTime: 30_000,
  });

export const useJournalRange = (from: string, to: string) =>
  useQuery<JournalEntry[], ContentApiError>({
    queryKey: CONTENT_QUERY_KEYS.journalRange(from, to),
    queryFn: async () => {
      const data = await fetchContentJSON<JournalEntry[]>(
        `/journal?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(from && to),
    staleTime: 60_000,
    placeholderData: [],
  });

export const useSaveJournalEntry = () => {
  const queryClient = useQueryClient();
  return useMutation<
    JournalEntry,
    ContentApiError,
    { date: string; markdown: string; expectedRevision: number; signal?: AbortSignal }
  >({
    mutationFn: ({ date, markdown, expectedRevision, signal }) =>
      saveJournalEntry(date, markdown, expectedRevision, signal),
    onSuccess: (entry) => {
      queryClient.setQueryData(CONTENT_QUERY_KEYS.journalEntry(entry.date), entry);
      queryClient.invalidateQueries({ queryKey: CONTENT_QUERY_KEYS.journal() });
    },
  });
};

export const uploadJournalAttachment = async (file: File): Promise<JournalAttachment> => {
  const body = new FormData();
  body.append('file', file);
  const response = await fetchContent('/journal/attachments', { method: 'POST', body });
  if (!response.ok) return throwResponseError(response, 'Image could not be uploaded');
  return response.json() as Promise<JournalAttachment>;
};

export const useUploadJournalAttachment = () =>
  useMutation<JournalAttachment, ContentApiError, File>({ mutationFn: uploadJournalAttachment });

export const deleteJournalAttachment = async (id: string): Promise<void> => {
  const response = await fetchContent(`/journal/attachments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (response.status === 409) {
    const body = await readErrorBody(response);
    const message = responseMessage(body, 'Attachment cannot be deleted yet.');
    const reason: JournalAttachmentConflictReason = /currently|retry|being referenced/i.test(message)
      ? 'deleting'
      : 'referenced';
    throw new JournalAttachmentConflictError(message, reason);
  }
  if (!response.ok) return throwResponseError(response, 'Image could not be deleted');
};

export const useDeleteJournalAttachment = () =>
  useMutation<void, ContentApiError, string>({ mutationFn: deleteJournalAttachment });

export const requestMentorResponse = (request: MentorRequest): Promise<MentorResponse> =>
  fetchContentJSON<MentorResponse>('/mentor/respond', {
    method: 'POST',
    body: JSON.stringify(request),
  });

export const useMentorResponse = () =>
  useMutation<MentorResponse, ContentApiError, MentorRequest>({ mutationFn: requestMentorResponse });

export const setMentorJournalPreference = (enabled: boolean) =>
  fetchContentJSON<unknown>('/users/profile', {
    method: 'PATCH',
    body: JSON.stringify({ preferences: { mentorJournalContext: enabled } }),
  });

export const useAchievements = () =>
  useQuery<AchievementsResponse, ContentApiError>({
    queryKey: CONTENT_QUERY_KEYS.achievements(),
    queryFn: () => fetchContentJSON<AchievementsResponse>('/achievements'),
    staleTime: 5 * 60_000,
  });
