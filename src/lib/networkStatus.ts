import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

const isBrowser = typeof window !== 'undefined';

/** Browser connectivity UI only. Durable mutation replay lives in offline/outbox. */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(isBrowser ? navigator.onLine : true);
  const [wasOffline, setWasOffline] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isBrowser) return undefined;

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        toast({
          title: '🌐 Connection restored',
          description: 'You are back online. Data will sync automatically.',
          duration: 3000,
        });
        setWasOffline(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      toast({
        title: '📡 Connection lost',
        description: 'You are offline. Changes will be saved when connection is restored.',
        variant: 'destructive',
        duration: 5000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline, toast]);

  return { isOnline, wasOffline };
}
