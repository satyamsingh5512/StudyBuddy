'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, BookOpen, Bot, Download, ListTodo, Mic, ShieldCheck, Target } from 'lucide-react';
import { installInstructions } from '@/lib/pwa';

const features = [
  { icon: ListTodo, title: 'Plan and focus', copy: 'Create tasks, build schedules, and use the study timer without leaving your dashboard.' },
  { icon: Target, title: 'Goals and Show Up', copy: 'Break goals into sub-goals, record complete or partial progress, and review momentum.' },
  { icon: Bot, title: 'Mentor and journal', copy: 'Ask for study guidance and optionally include your journal context. You control that preference.' },
  { icon: BookOpen, title: 'Reports and achievements', copy: 'Review study analytics, daily reports, streaks, and earned milestones.' },
];

export default function Help() {
  const [promptAvailable, setPromptAvailable] = useState(false);
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    const refresh = () => setPromptAvailable(Boolean(window.studyBuddyInstallPrompt));
    setStandalone(window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    refresh();
    window.addEventListener('studybuddy-install-available', refresh);
    return () => window.removeEventListener('studybuddy-install-available', refresh);
  }, []);
  const instructions = useMemo(() => installInstructions({ userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent, standalone, installPromptAvailable: promptAvailable }), [promptAvailable, standalone]);
  const install = async () => {
    const event = window.studyBuddyInstallPrompt;
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    window.studyBuddyInstallPrompt = undefined;
    setPromptAvailable(false);
  };
  return <section className="mx-auto w-full max-w-5xl pb-16"><header className="mb-8"><p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Product guide</p><h1 className="mt-2 text-3xl font-semibold">Help with StudyBuddy</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Learn what each workspace does, install the PWA when your browser supports it, and understand browser limitations.</p></header>
    <div className="grid gap-4 md:grid-cols-2">{features.map(({ icon: Icon, title, copy }) => <article key={title} className="rounded-2xl border border-hairline bg-surface p-5"><Icon className="h-5 w-5 text-primary" /><h2 className="mt-4 text-base font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{copy}</p></article>)}</div>
    <section className="mt-6 rounded-2xl border border-hairline bg-surface p-6"><div className="flex items-start gap-3"><Download className="mt-0.5 h-5 w-5 text-primary" /><div><h2 className="text-lg font-semibold">{instructions.title}</h2><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">{instructions.steps.map((step) => <li key={step}>{step}</li>)}</ol>{instructions.canPrompt && <button type="button" onClick={() => void install()} className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Install StudyBuddy</button>}</div></div></section>
    <section className="mt-6 grid gap-4 md:grid-cols-3"><article className="rounded-2xl border border-hairline p-5"><Bell className="h-5 w-5 text-primary" /><h2 className="mt-3 text-sm font-semibold">Notifications</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Show-up and schedule reminders are foreground browser helpers. They work only while StudyBuddy is open; there is no closed-app or background-delivery guarantee. Permission is requested only when you choose it in Settings.</p></article><article className="rounded-2xl border border-hairline p-5"><Mic className="h-5 w-5 text-primary" /><h2 className="mt-3 text-sm font-semibold">Dictation</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Journal dictation depends on browser speech-recognition support and may use the browser or operating-system speech service. Typing always remains available.</p></article><article className="rounded-2xl border border-hairline p-5"><ShieldCheck className="h-5 w-5 text-primary" /><h2 className="mt-3 text-sm font-semibold">Privacy and offline use</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">The service worker caches only public static assets. API responses, account data, and navigation HTML are never cached. An internet connection is required for authenticated data and AI features.</p></article></section>
  </section>;
}
