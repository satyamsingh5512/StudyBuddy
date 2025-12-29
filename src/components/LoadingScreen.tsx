import { useEffect, useState } from 'react';
import Logo from './Logo';

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Logo className="w-16 h-16 text-foreground" animated />
        <div className="flex items-center gap-2">
          <div className="h-1 w-1 rounded-full bg-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="h-1 w-1 rounded-full bg-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="h-1 w-1 rounded-full bg-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <p className="text-sm text-muted-foreground">
          {message}
          <span className="inline-block w-4">{dots}</span>
        </p>
      </div>
    </div>
  );
}
