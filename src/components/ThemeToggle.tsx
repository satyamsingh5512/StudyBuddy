import { useEffect, useState, useCallback } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';
import { getTheme, toggleTheme } from '@/lib/theme';
import { soundManager } from '@/lib/sounds';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    setTheme(getTheme());
  }, []);

  const handleToggle = useCallback(() => {
    // Prevent rapid clicks
    if (isToggling) return;

    setIsToggling(true);

    // Get new theme first
    const newTheme = toggleTheme();

    // Update state immediately for responsive UI
    setTheme(newTheme);

    // Play sound asynchronously to avoid blocking UI
    setTimeout(() => {
      soundManager.playToggle(newTheme === 'dark');
    }, 0);

    // Reset toggling state after animation completes
    setTimeout(() => {
      setIsToggling(false);
    }, 300);
  }, [isToggling]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      className="relative"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 -rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
