import { useEffect, useState } from 'react';
import Logo from './Logo';

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-3xl animate-float animation-delay-200" />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-float animation-delay-400" />
      </div>
      
      {/* Content */}
      <div className="relative flex flex-col items-center gap-8 p-8">
        {/* Logo with Glow */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-3xl blur-2xl opacity-50 animate-pulse-glow" />
          <div className="relative bg-gradient-to-br from-violet-600 to-fuchsia-600 p-6 rounded-3xl shadow-2xl">
            <Logo className="w-16 h-16 text-white" animated />
          </div>
        </div>
        
        {/* Brand Name */}
        <div className="text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
            StudyBuddy
          </h1>
          <p className="text-muted-foreground mt-2">{message}</p>
        </div>
        
        {/* Progress Bar */}
        <div className="w-64 h-1.5 bg-muted/30 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Loading Dots */}
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
