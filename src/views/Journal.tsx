import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bold,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Code2,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Mic,
  MicOff,
  Plus,
  RefreshCw,
  Save,
  Strikethrough,
  Trash2,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import {
  CONTENT_QUERY_KEYS,
  ContentNetworkError,
  ContentValidationError,
  JournalAttachmentConflictError,
  JournalConflictError,
  useDeleteJournalAttachment,
  useJournalEntry,
  useJournalRange,
  useSaveJournalEntry,
  useUploadJournalAttachment,
} from '@/lib/contentQueries';
import {
  JOURNAL_AUTOSAVE_MS,
  JOURNAL_MAX_MARKDOWN_BYTES,
  JournalSaveSequencer,
  addJournalDays,
  applyMarkdownTransform,
  dateKey,
  extractJournalAttachmentIds,
  journalDraftKey,
  journalMarkdownBytes,
  journalYearRange,
  parseJournalDraft,
  removeJournalAttachment,
  sanitizeMarkdownUrl,
  type MarkdownTransform,
} from '@/lib/contentUtils';
import { useCreateTodo } from '@/lib/queries';
import type { JournalEntry, JournalSaveState } from '@/types/content';

interface RecognitionResultEvent extends Event {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const formatDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day, 12));
};

const localDateISO = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12).toISOString();
};

const toolbarItems: { transform: MarkdownTransform; label: string; icon: typeof Bold }[] = [
  { transform: 'bold', label: 'Bold', icon: Bold },
  { transform: 'italic', label: 'Italic', icon: Italic },
  { transform: 'underline-equivalent', label: 'Strikethrough (underline alternative)', icon: Strikethrough },
  { transform: 'highlight', label: 'Inline code (highlight alternative)', icon: Code2 },
  { transform: 'link', label: 'Insert link', icon: LinkIcon },
  { transform: 'bullets', label: 'Bulleted list', icon: List },
  { transform: 'numbering', label: 'Numbered list', icon: ListOrdered },
];

export default function Journal() {
  const today = dateKey();
  const [selectedDate, setSelectedDate] = useState(today);
  const [markdown, setMarkdown] = useState('');
  const [saveState, setSaveState] = useState<JournalSaveState>('Saved');
  const [saveMessage, setSaveMessage] = useState('');
  const [conflict, setConflict] = useState<JournalEntry | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechMessage, setSpeechMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const timerRef = useRef<number | null>(null);
  const sequencerRef = useRef<JournalSaveSequencer | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const initializedDateRef = useRef('');
  const dateRef = useRef(selectedDate);
  const markdownRef = useRef('');
  const revisionRef = useRef(0);
  const persistedRef = useRef('');
  const conflictRef = useRef<JournalEntry | null>(null);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const range = useMemo(() => journalYearRange(selectedDate), [selectedDate]);
  const entryQuery = useJournalEntry(selectedDate);
  const rangeQuery = useJournalRange(range.from, range.to);
  const saveMutation = useSaveJournalEntry();
  const saveEntryRef = useRef(saveMutation.mutateAsync);
  saveEntryRef.current = saveMutation.mutateAsync;
  const uploadMutation = useUploadJournalAttachment();
  const deleteAttachmentMutation = useDeleteJournalAttachment();
  const createTodo = useCreateTodo();

  const resetSaveQueue = useCallback((date: string, revision: number) => {
    requestAbortRef.current?.abort();
    sequencerRef.current?.cancelPending();
    const controller = new AbortController();
    requestAbortRef.current = controller;
    const queue = new JournalSaveSequencer(date, revision, (request) =>
      saveEntryRef.current({ ...request, signal: controller.signal })
    );
    sequencerRef.current = queue;
    return queue;
  }, []);

  useEffect(() => {
    dateRef.current = selectedDate;
  }, [selectedDate]);

  const writeCrashDraft = useCallback((date: string, value: string, revision: number) => {
    sessionStorage.setItem(
      journalDraftKey(date),
      JSON.stringify({ date, markdown: value, baseRevision: revision, savedAt: new Date().toISOString() })
    );
  }, []);

  const scheduleSave = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void flushRef.current(), JOURNAL_AUTOSAVE_MS);
  }, []);

  const updateMarkdown = useCallback(
    (value: string) => {
      setMarkdown(value);
      markdownRef.current = value;
      writeCrashDraft(dateRef.current, value, revisionRef.current);
      setSaveMessage('');
      const bytes = journalMarkdownBytes(value);
      if (bytes > JOURNAL_MAX_MARKDOWN_BYTES) {
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        setSaveState('Error');
        setSaveMessage(
          `Entry is ${bytes.toLocaleString()} bytes. Remove ${(bytes - JOURNAL_MAX_MARKDOWN_BYTES).toLocaleString()} bytes to save.`
        );
        return;
      }
      if (!navigator.onLine) {
        setSaveState('Offline');
        setSaveMessage('Draft kept in this tab. It will retry when you reconnect.');
        return;
      }
      if (!conflictRef.current) {
        setSaveState('Saving');
        scheduleSave();
      }
    },
    [scheduleSave, writeCrashDraft]
  );

  const flush = useCallback(async (): Promise<boolean> => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const date = dateRef.current;
    const value = markdownRef.current;
    const bytes = journalMarkdownBytes(value);
    if (conflictRef.current) return false;
    if (bytes > JOURNAL_MAX_MARKDOWN_BYTES) {
      writeCrashDraft(date, value, revisionRef.current);
      setSaveState('Error');
      setSaveMessage(
        `Entry is ${bytes.toLocaleString()} bytes. Remove ${(bytes - JOURNAL_MAX_MARKDOWN_BYTES).toLocaleString()} bytes to save.`
      );
      return false;
    }

    const queue = sequencerRef.current;
    if (value === persistedRef.current && !queue?.isSaving) {
      sessionStorage.removeItem(journalDraftKey(date));
      setSaveState('Saved');
      setSaveMessage('');
      return true;
    }
    if (!navigator.onLine) {
      writeCrashDraft(date, value, revisionRef.current);
      setSaveState('Offline');
      setSaveMessage('Draft kept in this tab. It will retry when you reconnect.');
      return false;
    }
    if (!queue || queue.date !== date) {
      writeCrashDraft(date, value, revisionRef.current);
      setSaveState('Error');
      setSaveMessage('Journal is still loading. Wait a moment, then save again.');
      return false;
    }

    setSaveState('Saving');
    setSaveMessage('');
    try {
      const result = await queue.enqueue(value);
      await Promise.resolve();
      if (sequencerRef.current !== queue || dateRef.current !== date) return false;

      revisionRef.current = result.entry.revision;
      persistedRef.current = result.markdown;
      if (markdownRef.current === result.markdown && !queue.isSaving) {
        sessionStorage.removeItem(journalDraftKey(date));
        setSaveState('Saved');
        setSaveMessage(`Saved revision ${result.entry.revision}`);
      } else {
        writeCrashDraft(date, markdownRef.current, queue.revision);
        setSaveState('Saving');
        if (!queue.isSaving) scheduleSave();
      }
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false;
      if (sequencerRef.current !== queue || dateRef.current !== date) return false;

      writeCrashDraft(date, markdownRef.current, queue.revision);
      if (error instanceof JournalConflictError) {
        conflictRef.current = error.current;
        setConflict(error.current);
        setSaveState('Conflict');
        setSaveMessage('A newer server revision exists. Choose which version to keep.');
      } else if (error instanceof ContentNetworkError) {
        setSaveState('Offline');
        setSaveMessage('Network save failed. Your draft is retained in this tab; reconnect and retry.');
      } else if (error instanceof ContentValidationError) {
        setSaveState('Error');
        setSaveMessage(`${error.message} Your draft has not been changed.`);
      } else if (error instanceof JournalAttachmentConflictError) {
        setSaveState('Error');
        setSaveMessage('A referenced image is unavailable or being deleted. Restore/remove it, then save again.');
      } else {
        setSaveState('Error');
        setSaveMessage('The server could not save this draft. Your content is retained; retry shortly.');
      }
      return false;
    }
  }, [scheduleSave, writeCrashDraft]);

  flushRef.current = flush;

  useEffect(() => {
    const entry = entryQuery.data;
    if (!entry || entry.date !== selectedDate || initializedDateRef.current === selectedDate) return;
    initializedDateRef.current = selectedDate;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    resetSaveQueue(selectedDate, entry.revision);
    revisionRef.current = entry.revision;
    persistedRef.current = entry.markdown;
    conflictRef.current = null;
    setConflict(null);

    const draft = parseJournalDraft(sessionStorage.getItem(journalDraftKey(selectedDate)), selectedDate);
    if (draft && draft.markdown !== entry.markdown) {
      markdownRef.current = draft.markdown;
      setMarkdown(draft.markdown);
      if (draft.baseRevision !== entry.revision) {
        conflictRef.current = entry;
        setConflict(entry);
        setSaveState('Conflict');
        setSaveMessage('Recovered tab draft is based on an older server revision.');
      } else if (journalMarkdownBytes(draft.markdown) > JOURNAL_MAX_MARKDOWN_BYTES) {
        const bytes = journalMarkdownBytes(draft.markdown);
        setSaveState('Error');
        setSaveMessage(
          `Recovered draft is ${bytes.toLocaleString()} bytes. Remove ${(bytes - JOURNAL_MAX_MARKDOWN_BYTES).toLocaleString()} bytes to save.`
        );
      } else {
        setSaveState(navigator.onLine ? 'Saving' : 'Offline');
        scheduleSave();
      }
    } else {
      markdownRef.current = entry.markdown;
      setMarkdown(entry.markdown);
      sessionStorage.removeItem(journalDraftKey(selectedDate));
      setSaveState('Saved');
      setSaveMessage(entry.revision ? `Revision ${entry.revision}` : 'New entry');
    }
  }, [entryQuery.data, resetSaveQueue, scheduleSave, selectedDate]);

  useEffect(() => {
    const handleOnline = () => {
      if (
        markdownRef.current !== persistedRef.current &&
        journalMarkdownBytes(markdownRef.current) <= JOURNAL_MAX_MARKDOWN_BYTES &&
        !conflictRef.current
      ) {
        setSaveState('Saving');
        scheduleSave();
      }
    };
    const handleOffline = () => {
      if (markdownRef.current !== persistedRef.current) setSaveState('Offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [scheduleSave]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      sequencerRef.current?.cancelPending();
      requestAbortRef.current?.abort();
      recognitionRef.current?.abort();
    },
    []
  );

  const navigateTo = async (nextDate: string) => {
    if (!nextDate || nextDate === selectedDate) return;
    await flushRef.current();
    sequencerRef.current?.cancelPending();
    requestAbortRef.current?.abort();
    sequencerRef.current = null;
    initializedDateRef.current = '';
    setSelectedDate(nextDate);
    dateRef.current = nextDate;
    setSaveMessage('');
    setConflict(null);
    conflictRef.current = null;
  };

  const useServerVersion = () => {
    if (!conflict) return;
    resetSaveQueue(selectedDate, conflict.revision);
    revisionRef.current = conflict.revision;
    persistedRef.current = conflict.markdown;
    markdownRef.current = conflict.markdown;
    setMarkdown(conflict.markdown);
    sessionStorage.removeItem(journalDraftKey(selectedDate));
    conflictRef.current = null;
    setConflict(null);
    setSaveState('Saved');
    setSaveMessage(`Using server revision ${conflict.revision}`);
  };

  const keepDraft = () => {
    if (!conflict) return;
    resetSaveQueue(selectedDate, conflict.revision);
    revisionRef.current = conflict.revision;
    persistedRef.current = conflict.markdown;
    conflictRef.current = null;
    setConflict(null);
    writeCrashDraft(selectedDate, markdownRef.current, conflict.revision);
    setSaveState('Saving');
    scheduleSave();
  };

  const applyToolbar = (transform: MarkdownTransform) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    let url = 'https://';
    if (transform === 'link') {
      const answer = window.prompt('Link URL (https://, http://, mailto:, or #heading)', 'https://');
      if (answer === null) return;
      url = answer;
    }
    const result = applyMarkdownTransform(
      markdownRef.current,
      textarea.selectionStart,
      textarea.selectionEnd,
      transform,
      url
    );
    updateMarkdown(result.value);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  };

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type) || file.size > 1024 * 1024) {
      toast({
        title: 'Image not accepted',
        description: 'Choose a JPEG, PNG, or GIF no larger than 1 MiB.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const attachment = await uploadMutation.mutateAsync(file);
      const label = file.name.replace(/[\[\]]/g, '').slice(0, 80) || 'Journal image';
      const prefix = markdownRef.current && !markdownRef.current.endsWith('\n') ? '\n\n' : '';
      updateMarkdown(`${markdownRef.current}${prefix}![${label}](${attachment.url})\n`);
      toast({ title: 'Image added', description: 'It will be committed with this journal revision.' });
    } catch {
      toast({ title: 'Image upload failed', description: 'The image was not added.', variant: 'destructive' });
    }
  };

  const deleteImage = async (attachmentId: string) => {
    const previous = markdownRef.current;
    const next = removeJournalAttachment(previous, attachmentId);
    updateMarkdown(next);
    const saved = await flushRef.current();
    if (!saved) {
      toast({
        title: 'Image was not deleted',
        description: 'Resolve or retry the journal save first. The image remains private.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await deleteAttachmentMutation.mutateAsync(attachmentId);
      toast({ title: 'Image deleted' });
    } catch {
      updateMarkdown(previous);
      toast({
        title: 'Image deletion failed',
        description: 'The reference was restored in your draft so you can retry safely.',
        variant: 'destructive',
      });
    }
  };

  const addTask = async () => {
    const title = taskTitle.trim();
    if (!title || createTodo.isPending) return;
    try {
      await createTodo.mutateAsync({
        title,
        subject: 'General',
        difficulty: 'medium',
        questionsTarget: 10,
        scheduledDate: localDateISO(selectedDate),
      });
      const prefix = markdownRef.current && !markdownRef.current.endsWith('\n') ? '\n' : '';
      updateMarkdown(`${markdownRef.current}${prefix}- [ ] ${title}\n`);
      setTaskTitle('');
      toast({ title: 'Task created and inserted' });
    } catch {
      toast({ title: 'Task was not created', description: 'Nothing was inserted.', variant: 'destructive' });
    }
  };

  const toggleDictation = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Constructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Constructor) {
      setSpeechMessage('Dictation is not supported by this browser. You can continue typing.');
      return;
    }
    const recognition = new Constructor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = navigator.language || 'en-US';
    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = 0; index < event.results.length; index += 1) {
        if (event.results[index].isFinal) transcript += event.results[index][0].transcript;
      }
      if (!transcript.trim()) return;
      const textarea = textareaRef.current;
      const position = textarea?.selectionStart ?? markdownRef.current.length;
      const separator = position > 0 && !/\s$/.test(markdownRef.current.slice(0, position)) ? ' ' : '';
      const next = `${markdownRef.current.slice(0, position)}${separator}${transcript.trim()}${markdownRef.current.slice(position)}`;
      updateMarkdown(next);
      setSpeechMessage('Transcript added locally. No audio was uploaded.');
    };
    recognition.onerror = (event) => {
      setSpeechMessage(
        event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'Microphone permission was denied. Dictation is off; you can continue typing.'
          : 'Dictation stopped unexpectedly. No audio was uploaded.'
      );
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
      setSpeechMessage('Listening in your browser… audio is not uploaded by StudyBuddy.');
    } catch {
      setSpeechMessage('Dictation could not start. You can continue typing.');
    }
  };

  const markdownBytes = journalMarkdownBytes(markdown);
  const markdownTooLarge = markdownBytes > JOURNAL_MAX_MARKDOWN_BYTES;
  const attachments = extractJournalAttachmentIds(markdown);
  const recentEntries = [...(rangeQuery.data || [])]
    .filter((entry) => entry.markdown.trim())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 40);

  return (
    <section className="mx-auto w-full max-w-7xl pb-10">
      <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-ink">
            <CalendarDays className="h-3.5 w-3.5" /> Daily journal
          </div>
          <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-ink sm:text-[34px]">{formatDate(selectedDate)}</h1>
          <div className="mt-2 flex items-center gap-2 text-xs" role="status" aria-live="polite">
            <span
              className={`h-2 w-2 rounded-full ${
                saveState === 'Saved'
                  ? 'bg-success'
                  : saveState === 'Conflict' || saveState === 'Error'
                    ? 'bg-destructive'
                    : saveState === 'Offline'
                      ? 'bg-amber-500'
                      : 'animate-pulse bg-brand'
              }`}
            />
            <span className="font-medium text-ink">{saveState}</span>
            {saveMessage && <span className="text-muted-ink">· {saveMessage}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void navigateTo(addJournalDays(selectedDate, -1))} aria-label="Previous day" className="press grid h-10 w-10 place-items-center rounded-xl border border-hairline bg-surface text-ink">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <label className="relative">
            <span className="sr-only">Journal date</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => void navigateTo(event.target.value)}
              className="h-10 rounded-xl border border-hairline bg-surface px-3 text-sm text-ink outline-none focus:border-border-accent-strong"
            />
          </label>
          <button type="button" onClick={() => void navigateTo(today)} className="press h-10 rounded-xl border border-hairline bg-surface px-3 text-xs font-medium text-ink">Today</button>
          <button type="button" onClick={() => void navigateTo(addJournalDays(selectedDate, 1))} aria-label="Next day" className="press grid h-10 w-10 place-items-center rounded-xl border border-hairline bg-surface text-ink">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => void flushRef.current()} disabled={saveState === 'Saved' || saveState === 'Conflict' || markdownTooLarge} className="press flex h-10 items-center gap-2 rounded-xl bg-brand px-3 text-xs font-medium text-on-accent disabled:cursor-not-allowed disabled:opacity-40">
            <Save className="h-4 w-4" /> Save now
          </button>
        </div>
      </header>

      {conflict && (
        <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-4" role="alert">
          <h2 className="text-sm font-semibold text-ink">Journal revision conflict</h2>
          <p className="mt-1 text-xs leading-5 text-muted-ink">The server is at revision {conflict.revision}. Your recovered or edited draft is still retained in this tab.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={keepDraft} className="press rounded-xl bg-brand px-3 py-2 text-xs font-medium text-on-accent">Keep my draft and save</button>
            <button type="button" onClick={useServerVersion} className="press rounded-xl border border-hairline bg-surface px-3 py-2 text-xs font-medium text-ink">Use server version</button>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="order-2 space-y-4 xl:order-1">
          <div className="rounded-2xl border border-hairline bg-surface p-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Entries in {selectedDate.slice(0, 4)}</h2>
              <span className="text-xs text-muted-ink">{recentEntries.length}</span>
            </div>
            {rangeQuery.isError ? (
              <button type="button" onClick={() => void rangeQuery.refetch()} className="flex items-center gap-2 text-xs text-brand"><RefreshCw className="h-3.5 w-3.5" /> {rangeQuery.error instanceof ContentNetworkError ? 'Offline — retry list' : 'Could not load entries — retry'}</button>
            ) : recentEntries.length ? (
              <ul className="max-h-64 space-y-1 overflow-y-auto xl:max-h-[360px]">
                {recentEntries.map((entry) => (
                  <li key={entry.date}>
                    <button
                      type="button"
                      onClick={() => void navigateTo(entry.date)}
                      aria-current={entry.date === selectedDate ? 'date' : undefined}
                      className={`press flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs ${entry.date === selectedDate ? 'bg-accent-light text-brand' : 'text-muted-ink hover:bg-page hover:text-ink'}`}
                    >
                      <span>{entry.date}</span><span className="h-1.5 w-1.5 rounded-full bg-current" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs leading-5 text-muted-ink">No saved entries in this bounded year view.</p>
            )}
          </div>

          <div className="rounded-2xl border border-hairline bg-surface p-3">
            <h2 className="text-sm font-semibold text-ink">Create a task</h2>
            <p className="mt-1 text-xs leading-5 text-muted-ink">Creates an existing Todo and inserts a checklist line.</p>
            <input
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void addTask(); } }}
              maxLength={300}
              placeholder="Task title"
              className="mt-3 h-10 w-full rounded-xl border border-hairline bg-page px-3 text-sm text-ink outline-none focus:border-border-accent-strong"
            />
            <button type="button" onClick={() => void addTask()} disabled={!taskTitle.trim() || createTodo.isPending} className="press mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand text-xs font-medium text-on-accent disabled:opacity-40">
              <Plus className="h-4 w-4" /> Create and insert
            </button>
          </div>

          {attachments.length > 0 && (
            <div className="rounded-2xl border border-hairline bg-surface p-3">
              <h2 className="text-sm font-semibold text-ink">Private images</h2>
              <ul className="mt-3 space-y-2">
                {attachments.map((attachmentId) => (
                  <li key={attachmentId} className="flex items-center justify-between gap-2 rounded-lg bg-page p-2">
                    <span className="truncate font-mono text-[10px] text-muted-ink">{attachmentId}</span>
                    <button type="button" onClick={() => void deleteImage(attachmentId)} disabled={deleteAttachmentMutation.isPending} aria-label={`Delete image ${attachmentId}`} className="press grid h-8 w-8 shrink-0 place-items-center rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-40">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <div className="order-1 min-w-0 xl:order-2">
          {entryQuery.isLoading && initializedDateRef.current !== selectedDate ? (
            <div className="grid min-h-[520px] place-items-center rounded-2xl border border-hairline bg-surface text-sm text-muted-ink">Loading journal entry…</div>
          ) : entryQuery.isError ? (
            <div className="grid min-h-[520px] place-items-center rounded-2xl border border-hairline bg-surface text-center">
              <div><p className="text-sm text-ink">{entryQuery.error instanceof ContentNetworkError ? 'Offline — this journal entry could not be fetched.' : 'This journal entry could not be loaded from the server.'}</p><p className="mt-1 text-xs text-muted-ink">Any draft already kept in this tab is unchanged.</p><button type="button" onClick={() => void entryQuery.refetch()} className="mt-3 text-xs text-brand hover:underline">Try again</button></div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
              <div className="flex flex-wrap items-center gap-1 border-b border-hairline p-2" role="toolbar" aria-label="Markdown formatting">
                {toolbarItems.map(({ transform, label, icon: Icon }) => (
                  <button key={transform} type="button" onClick={() => applyToolbar(transform)} title={label} aria-label={label} className="press grid h-9 w-9 place-items-center rounded-lg text-muted-ink hover:bg-page hover:text-ink"><Icon className="h-4 w-4" /></button>
                ))}
                <span className="mx-1 h-5 w-px bg-hairline" />
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif" onChange={uploadImage} className="sr-only" />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadMutation.isPending} aria-label="Upload private image" title="Upload private image (1 MiB maximum)" className="press grid h-9 w-9 place-items-center rounded-lg text-muted-ink hover:bg-page hover:text-ink disabled:opacity-40"><ImagePlus className="h-4 w-4" /></button>
                <button type="button" onClick={toggleDictation} aria-pressed={isListening} aria-label={isListening ? 'Stop dictation' : 'Start dictation'} title="Browser dictation; no audio upload" className={`press grid h-9 w-9 place-items-center rounded-lg ${isListening ? 'bg-destructive/10 text-destructive' : 'text-muted-ink hover:bg-page hover:text-ink'}`}>{isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button>
                {speechMessage && <span className="ml-2 text-[11px] text-muted-ink" role="status">{speechMessage}</span>}
              </div>

              <div className="grid min-h-[560px] lg:grid-cols-2">
                <div className="flex min-h-[420px] flex-col border-b border-hairline lg:border-b-0 lg:border-r">
                  <div className="border-b border-hairline px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-ink">Markdown source</div>
                  <textarea
                    ref={textareaRef}
                    value={markdown}
                    onChange={(event) => updateMarkdown(event.target.value)}
                    aria-invalid={markdownTooLarge}
                    aria-describedby="journal-byte-count"
                    spellCheck
                    aria-label="Journal Markdown source"
                    placeholder="What did you learn today?\n\n- Key idea\n- Question to revisit\n- Next step"
                    className="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-6 text-ink outline-none placeholder:text-muted-ink/70"
                  />
                  <div id="journal-byte-count" className={`border-t border-hairline px-4 py-2 text-right text-[10px] ${markdownTooLarge ? 'font-semibold text-destructive' : 'text-muted-ink'}`}>{markdownBytes.toLocaleString()} / {JOURNAL_MAX_MARKDOWN_BYTES.toLocaleString()} bytes</div>
                </div>
                <div className="min-h-[420px] overflow-auto">
                  <div className="sticky top-0 z-10 border-b border-hairline bg-surface px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-ink">Safe preview</div>
                  <div className="journal-preview break-words p-4 text-sm leading-7 text-ink">
                    {markdown.trim() ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        skipHtml
                        urlTransform={(url, key) => sanitizeMarkdownUrl(url, key === 'src' ? 'image' : 'link')}
                        components={{
                          a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" className="text-brand underline underline-offset-2">{children}</a>,
                          img: ({ alt, ...props }) => <img {...props} alt={alt || 'Journal attachment'} className="my-4 max-h-96 rounded-xl border border-hairline object-contain" loading="lazy" />,
                          h1: ({ children }) => <h1 className="mb-3 mt-5 text-2xl font-semibold">{children}</h1>,
                          h2: ({ children }) => <h2 className="mb-2 mt-5 text-xl font-semibold">{children}</h2>,
                          h3: ({ children }) => <h3 className="mb-2 mt-4 text-lg font-semibold">{children}</h3>,
                          p: ({ children }) => <p className="my-3">{children}</p>,
                          ul: ({ children }) => <ul className="my-3 list-disc pl-6">{children}</ul>,
                          ol: ({ children }) => <ol className="my-3 list-decimal pl-6">{children}</ol>,
                          blockquote: ({ children }) => <blockquote className="my-3 border-l-2 border-brand pl-4 text-muted-ink">{children}</blockquote>,
                          code: ({ children }) => <code className="rounded bg-accent-light px-1.5 py-0.5 font-mono text-[0.9em] text-ink">{children}</code>,
                        }}
                      >
                        {markdown}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-muted-ink">Your safe Markdown preview appears here. Raw HTML is ignored.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
