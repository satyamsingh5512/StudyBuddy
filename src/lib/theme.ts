export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme';
const THEME_CHANGE_EVENT = 'studybuddy-theme-change';

let transitionTimeoutId: number | null = null;

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;

  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme } }));
}

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';

  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Ignore storage failures and fall back to system preference.
  }

  return getSystemTheme();
}

interface SetThemeOptions {
  persist?: boolean;
  withTransition?: boolean;
}

export function setTheme(theme: Theme, options: SetThemeOptions = {}) {
  const { persist = true, withTransition = false } = options;

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage failures and still apply the theme in memory.
    }
  }

  applyTheme(theme);
}

export function toggleTheme(): Theme {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next, true);
  return next;
}

// Initialize theme on load
export function initTheme() {
  setTheme(getTheme(), false);
}

export function subscribeToThemeChange(callback: (theme: Theme) => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const onCustomThemeChange = (event: Event) => {
    const customEvent = event as CustomEvent<{ theme?: Theme }>;
    const nextTheme = customEvent.detail?.theme;
    if (nextTheme === 'light' || nextTheme === 'dark') {
      callback(nextTheme);
      return;
    }
    callback(getTheme());
  };

  const onStorageChange = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) {
      callback(getTheme());
    }
  };

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onMediaChange = () => {
    try {
      if (!localStorage.getItem(THEME_STORAGE_KEY)) {
        callback(getTheme());
      }
    } catch {
      callback(getTheme());
    }
  };

  window.addEventListener(THEME_CHANGE_EVENT, onCustomThemeChange as EventListener);
  window.addEventListener('storage', onStorageChange);
  media.addEventListener('change', onMediaChange);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onCustomThemeChange as EventListener);
    window.removeEventListener('storage', onStorageChange);
    media.removeEventListener('change', onMediaChange);
  };
}
