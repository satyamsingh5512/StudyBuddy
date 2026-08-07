'use client';

import { useEffect } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window { studyBuddyInstallPrompt?: BeforeInstallPromptEvent }
  interface WindowEventMap { beforeinstallprompt: BeforeInstallPromptEvent }
}

export default function PwaManager() {
  useEffect(() => {
    const capture = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      window.studyBuddyInstallPrompt = event;
      window.dispatchEvent(new Event('studybuddy-install-available'));
    };
    window.addEventListener('beforeinstallprompt', capture);
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // PWA support is optional; the web app remains usable when registration fails.
      });
    }
    return () => window.removeEventListener('beforeinstallprompt', capture);
  }, []);
  return null;
}
