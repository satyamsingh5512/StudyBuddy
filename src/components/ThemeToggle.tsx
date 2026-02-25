import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';
import { getTheme, toggleTheme } from '@/lib/theme';
import { soundManager } from '@/lib/sounds';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    setTheme(getTheme());
  }, []);

  const handleToggle = () => {
    // Toggle theme instantly
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
      className="relative transition-transform hover:scale-110 active:scale-95"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label="Toggle theme"
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all duration-200 dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all duration-200 dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
