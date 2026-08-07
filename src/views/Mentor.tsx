import { FormEvent, useEffect, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { Bot, BookOpen, LockKeyhole, Send, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { userAtom } from '@/store/atoms';
import {
  requestMentorResponse,
  setMentorJournalPreference,
} from '@/lib/contentQueries';
import {
  appendMentorExchange,
  buildMentorRequest,
  MENTOR_MAX_MESSAGE_RUNES,
} from '@/lib/contentUtils';
import type { MentorContextMetadata, MentorMessage } from '@/types/content';

const SUGGESTIONS = [
  'What should I focus on today?',
  'Help me recover from a missed study day',
  'Review my recent study consistency',
  'Suggest a realistic next study session',
];

const id = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function Mentor() {
  const [user, setUser] = useAtom(userAtom);
  const storedConsent = Boolean(user?.preferences?.mentorJournalContext);
  const [requestConsent, setRequestConsent] = useState(storedConsent);
  const [messages, setMessages] = useState<MentorMessage[]>([]);
  const [message, setMessage] = useState('');
  const [metadata, setMetadata] = useState<MentorContextMetadata | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isSavingConsent, setIsSavingConsent] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  // Effects must not return a value: React treats any non-function return as a
  // cleanup callback and throws when it later tries to invoke it.
  useEffect(() => {
    setRequestConsent(storedConsent);
  }, [storedConsent]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages]);

  const saveDefaultConsent = async (enabled: boolean) => {
    if (isSavingConsent || isSending) return;
    setIsSavingConsent(true);
    setError('');
    try {
      await setMentorJournalPreference(enabled);
      setUser((current) =>
        current
          ? { ...current, preferences: { ...current.preferences, mentorJournalContext: enabled } }
          : current
      );
      setRequestConsent(enabled);
    } catch {
      setError('Your journal sharing preference could not be saved. Please try again.');
    } finally {
      setIsSavingConsent(false);
    }
  };

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = Array.from(message.trim()).slice(0, MENTOR_MAX_MESSAGE_RUNES).join('');
    if (!trimmed || isSending) return;

    const userMessage: MentorMessage = { id: id(), role: 'user', content: trimmed };
    const request = buildMentorRequest(messages, trimmed, requestConsent);
    setMessages((current) => appendMentorExchange(current, [userMessage]));
    setMessage('');
    setError('');
    setIsSending(true);
    try {
      const result = await requestMentorResponse(request);
      const assistantMessage: MentorMessage = {
        id: id(),
        role: 'assistant',
        content: result.response || 'I could not form a response. Please try another question.',
      };
      setMessages((current) => appendMentorExchange(current, [assistantMessage]));
      setMetadata(result.metadata);
    } catch {
      setError('Mentor is temporarily unavailable. Your message was not stored; you can try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-4 pb-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-ink">
            <Sparkles className="h-3.5 w-3.5" /> Contextual guidance
          </div>
          <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-ink sm:text-[34px]">Mentor</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-ink">
            Read-only study guidance based on your StudyBuddy activity. Mentor cannot create,
            edit, complete, or delete anything in your account.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-hairline bg-surface px-3 py-2 text-xs text-muted-ink">
          <LockKeyhole className="h-4 w-4 text-brand" /> Ephemeral thread · last 12 messages sent
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-hairline bg-surface">
          <div
            role="log"
            aria-live="polite"
            aria-label="Mentor conversation"
            className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6"
          >
            {messages.length === 0 ? (
              <div className="grid min-h-[300px] place-items-center text-center">
                <div className="max-w-md">
                  <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-accent-light text-brand">
                    <Bot className="h-6 w-6" />
                  </div>
                  <h2 className="text-lg font-semibold text-ink">Plan the next useful step</h2>
                  <p className="mt-2 text-sm text-muted-ink">
                    Ask for analysis or recommendations. Suggestions are advisory and never modify
                    your tasks, goals, journal, or schedule.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((item) => (
                <article
                  key={item.id}
                  className={`flex gap-3 ${item.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-surface-muted text-muted-ink">
                    {item.role === 'user' ? <UserRound className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                      item.role === 'user'
                        ? 'bg-brand text-on-accent'
                        : 'border border-hairline bg-page text-ink'
                    }`}
                  >
                    {item.content}
                  </div>
                </article>
              ))
            )}
            {isSending && (
              <div className="flex items-center gap-3 text-sm text-muted-ink" role="status">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-surface-muted">
                  <Bot className="h-4 w-4" />
                </div>
                Mentor is reviewing the available context…
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-hairline p-3 sm:p-4">
            {error && (
              <p className="mb-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1" aria-label="Suggested questions">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setMessage(suggestion)}
                  disabled={isSending}
                  className="press shrink-0 rounded-full border border-hairline px-3 py-2 text-xs text-muted-ink hover:border-border-accent hover:text-brand disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <form onSubmit={send} className="flex items-end gap-2">
              <label className="sr-only" htmlFor="mentor-message">Ask Mentor</label>
              <textarea
                id="mentor-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                maxLength={MENTOR_MAX_MESSAGE_RUNES}
                rows={2}
                placeholder="Ask for study guidance…"
                className="min-h-12 flex-1 resize-none rounded-xl border border-hairline bg-page px-3 py-3 text-sm text-ink outline-none focus:border-border-accent-strong focus:ring-2 focus:ring-brand/10"
              />
              <button
                type="submit"
                disabled={!message.trim() || isSending}
                aria-label="Send message"
                className="press grid h-12 w-12 place-items-center rounded-xl bg-brand text-on-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-hairline bg-surface p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand" />
              <h2 className="text-sm font-semibold text-ink">Journal consent</h2>
            </div>
            <label className="flex cursor-pointer items-start justify-between gap-3 text-sm text-ink">
              <span>
                Default to journal context
                <span className="mt-1 block text-xs font-normal leading-5 text-muted-ink">
                  Saves to your profile. Up to 7 recent entries may be read.
                </span>
              </span>
              <input
                type="checkbox"
                checked={storedConsent}
                disabled={isSavingConsent || isSending}
                onChange={(event) => void saveDefaultConsent(event.target.checked)}
                className="mt-1 h-4 w-4 accent-[var(--accent-raw)]"
              />
            </label>
            <div className="my-4 border-t border-hairline" />
            <label className="flex cursor-pointer items-start justify-between gap-3 text-sm text-ink">
              <span>
                Use journal for this response
                <span className="mt-1 block text-xs font-normal leading-5 text-muted-ink">
                  Explicit one-request override; your saved default is not changed.
                </span>
              </span>
              <input
                type="checkbox"
                checked={requestConsent}
                disabled={isSending}
                onChange={(event) => setRequestConsent(event.target.checked)}
                className="mt-1 h-4 w-4 accent-[var(--accent-raw)]"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-hairline bg-surface p-4">
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-brand" />
              <h2 className="text-sm font-semibold text-ink">Last context used</h2>
            </div>
            {metadata ? (
              <>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(metadata.counts).map(([name, count]) => (
                    <div key={name} className="rounded-lg bg-page p-2">
                      <dt className="capitalize text-muted-ink">{name.replace('showUps', 'show ups')}</dt>
                      <dd className="mt-1 font-semibold text-ink">{count}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs text-muted-ink">
                  {(metadata.contextBytes / 1024).toFixed(1)} KB bounded context · Journal{' '}
                  {metadata.journalIncluded ? 'included' : 'not included'}
                </p>
              </>
            ) : (
              <p className="text-xs leading-5 text-muted-ink">
                Counts appear after a response. Context can include bounded goals, show-ups, tasks,
                sessions, and reports.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
