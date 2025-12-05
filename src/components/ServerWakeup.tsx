import { useEffect, useState } from 'react';
import { wakeupServer } from '@/lib/serverWakeup';
import Logo from './Logo';

export default function ServerWakeup() {
  const [isChecking, setIsChecking] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let progressInterval: NodeJS.Timeout;

    const checkServer = async () => {
      // Simulate progress bar
      progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 500);

      await wakeupServer();
      
      clearInterval(progressInterval);
      setProgress(100);

      // Small delay to show completion
      setTimeout(() => {
        setIsChecking(false);
      }, 500);
    };

    checkServer();

    return () => {
      if (progressInterval) clearInterval(progressInterval);
    };
  }, []);

  if (!isChecking) return null;

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 max-w-sm mx-4">
        <Logo className="w-16 h-16 text-foreground animate-pulse" animated />
        
        <div className="w-full space-y-3">
          <div className="text-center space-y-1">
            <h3 className="text-lg font-semibold">Waking up the server...</h3>
            <p className="text-sm text-muted-foreground">
              This may take a moment on first load
            </p>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <p className="text-xs text-center text-muted-foreground">
            {progress < 30 && 'Connecting to server...'}
            {progress >= 30 && progress < 60 && 'Starting services...'}
            {progress >= 60 && progress < 90 && 'Almost ready...'}
            {progress >= 90 && 'Ready!'}
          </p>
        </div>
      </div>
    </div>
  );
}
