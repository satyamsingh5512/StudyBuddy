'use client';

/**
 * TEMPORARY dev-only preview of dashboard glass primitives — all tiers x
 * states x both themes, so states can be checked visually before wiring
 * into real pages.
 *
 * Dev-gated: renders a 404-style message in production. Safe to delete
 * once Phase 3 migration is verified; not linked from any nav.
 */

import { useState } from 'react';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardContent,
  GlassButton,
  GlassModal,
  AmbientBackground,
} from '@/components/dashboard/glass';
import { setTheme, type Theme } from '@/lib/theme';

export default function GlassPreviewPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [theme, setLocalTheme] = useState<Theme>('light');

  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="p-10 text-center text-muted-foreground">
        Not found.
      </div>
    );
  }

  const switchTheme = (t: Theme) => {
    setLocalTheme(t);
    setTheme(t, { persist: false });
  };

  return (
    <div className="relative min-h-screen p-8 space-y-8">
      <AmbientBackground />

      <div className="flex items-center gap-3">
        <GlassButton onClick={() => switchTheme('light')} variant={theme === 'light' ? 'primary' : 'default'}>
          Light
        </GlassButton>
        <GlassButton onClick={() => switchTheme('dark')} variant={theme === 'dark' ? 'primary' : 'default'}>
          Dark
        </GlassButton>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tiers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <GlassCard tier="ambient" className="p-6">
            <p className="text-sm font-medium">Ambient tier</p>
            <p className="text-xs text-muted-foreground">blur 60px, saturate 170%</p>
          </GlassCard>
          <GlassCard tier="card" className="p-6">
            <p className="text-sm font-medium">Card tier (default)</p>
            <p className="text-xs text-muted-foreground">blur 22px, saturate 170%</p>
          </GlassCard>
          <GlassCard tier="elevated" className="p-6">
            <p className="text-sm font-medium">Elevated tier</p>
            <p className="text-xs text-muted-foreground">blur 32px, saturate 180%, stronger shadow</p>
          </GlassCard>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">GlassCard — interactive states</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="p-4">
            <p className="text-xs">Default</p>
          </GlassCard>
          <GlassCard interactive className="p-4">
            <p className="text-xs">Hover me (desktop)</p>
          </GlassCard>
          <GlassCard interactive jellyTap className="p-4">
            <p className="text-xs">Tap me (jelly)</p>
          </GlassCard>
          <GlassCard className="p-4 opacity-50 pointer-events-none">
            <p className="text-xs">Disabled</p>
          </GlassCard>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">GlassCard — full composition</h2>
        <GlassCard interactive className="max-w-md">
          <GlassCardHeader>
            <GlassCardTitle>Today&apos;s Progress</GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <p className="text-sm text-muted-foreground">
              Example composed card using GlassCard + GlassCardHeader + GlassCardTitle + GlassCardContent.
            </p>
          </GlassCardContent>
        </GlassCard>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">GlassButton</h2>
        <div className="flex flex-wrap gap-3">
          <GlassButton>Default</GlassButton>
          <GlassButton variant="primary">Primary</GlassButton>
          <GlassButton variant="ghost">Ghost</GlassButton>
          <GlassButton disabled>Disabled</GlassButton>
          <GlassButton jellyTap>Jelly tap</GlassButton>
          <GlassButton size="icon" aria-label="icon button">
            +
          </GlassButton>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">GlassModal</h2>
        <GlassButton onClick={() => setModalOpen(true)}>Open modal</GlassButton>
        <GlassModal open={modalOpen} onOpenChange={setModalOpen} ariaLabel="Preview modal">
          <div className="p-6 space-y-4">
            <h3 className="text-sm font-semibold">Elevated modal surface</h3>
            <p className="text-xs text-muted-foreground">
              Mount/unmount animates via AnimatePresence — try closing with the button, backdrop click, or Escape via focus.
            </p>
            <div className="flex justify-end gap-2">
              <GlassButton variant="ghost" onClick={() => setModalOpen(false)}>
                Close
              </GlassButton>
            </div>
          </div>
        </GlassModal>
      </section>
    </div>
  );
}
