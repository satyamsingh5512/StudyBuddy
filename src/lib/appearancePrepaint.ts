import { ACCENT_IDS } from '@/types/content';

const FONT_IDS = ['sans', 'mono', 'serif'] as const;

/** Executed inline by the root layout so saved appearance is applied before first paint. */
export const APPEARANCE_PREPAINT_SCRIPT = `
(function () {
  const root = document.documentElement;
  let theme = 'light';

  try {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark' || storedTheme === 'light') {
      theme = storedTheme;
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      theme = 'dark';
    }
  } catch (error) {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      theme = 'dark';
    }
  }

  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  try {
    const appearance = JSON.parse(localStorage.getItem('studybuddy_appearance') || '{}');
    const fonts = ${JSON.stringify(FONT_IDS)};
    const accents = ${JSON.stringify(ACCENT_IDS)};
    root.dataset.font = fonts.includes(appearance.font) ? appearance.font : 'sans';
    root.dataset.accent = accents.includes(appearance.accent) ? appearance.accent : 'blue';
  } catch (error) {
    root.dataset.font = 'sans';
    root.dataset.accent = 'blue';
  }
})();
`;
