import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';
import { getTheme, subscribeToThemeChange, toggleTheme, type Theme } from '@/lib/theme';
import { soundManager } from '@/lib/sounds';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    return getTheme();
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(getTheme());
    setMounted(true);

    const unsubscribe = subscribeToThemeChange((nextTheme) => {
      setTheme(nextTheme);
    });

    return unsubscribe;
  }, []);

  const handleToggle = () => {
    const newTheme = toggleTheme();
    setTheme(newTheme);

    // Play sound without blocking
    requestAnimationFrame(() => {
      soundManager.playToggle(newTheme === 'dark');
    });
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      className="relative border border-border/60 bg-background/70 text-foreground backdrop-blur-sm transition-all duration-200 hover:scale-[1.03] hover:bg-secondary/80 active:scale-95"
      title={mounted ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode` : 'Toggle theme'}
      aria-label={mounted ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode` : 'Toggle theme'}
      aria-pressed={theme === 'dark'}
    >
      <Sun className="h-[1.1rem] w-[1.1rem] rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.1rem] w-[1.1rem] rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
