export type Theme = 'light' | 'dark';

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  
  const stored = localStorage.getItem('theme') as Theme | null;
  if (stored) return stored;
  
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(theme: Theme) {
  localStorage.setItem('theme', theme);
  
  // Use requestAnimationFrame to batch DOM updates
  requestAnimationFrame(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });
}

export function toggleTheme(): Theme {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

// Initialize theme on load
export function initTheme() {
  const theme = getTheme();
  setTheme(theme);
}
