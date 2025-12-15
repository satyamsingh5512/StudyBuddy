import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
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

// Enhanced API fetch with offline support
export async function apiFetchWithRetry(
  url: string, 
  options: RequestInit = {},
  maxRetries = 3
): Promise<Response> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        credentials: 'include',
      });
      
      if (response.ok) {
        return response;
      }
      
      // If server error, retry
      if (response.status >= 500 && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      
      // Network error, retry with exponential backoff
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
        continue;
      }
    }
  }
  
  throw lastError!;
}

// Queue for offline operations
class OfflineQueue {
  private queue: Array<{
    id: string;
    url: string;
    options: RequestInit;
    timestamp: number;
  }> = [];

  add(url: string, options: RequestInit) {
    const id = `${Date.now()}-${Math.random()}`;
    this.queue.push({
      id,
      url,
      options,
      timestamp: Date.now(),
    });
    this.saveToStorage();
    return id;
  }

  async processQueue() {
    if (!navigator.onLine || this.queue.length === 0) return;

    const operations = [...this.queue];
    this.queue = [];
    this.saveToStorage();

    for (const operation of operations) {
      try {
        await apiFetchWithRetry(operation.url, operation.options);
      } catch (error) {
        console.error('Failed to process queued operation:', error);
        // Re-add to queue if it's not too old (24 hours)
        if (Date.now() - operation.timestamp < 24 * 60 * 60 * 1000) {
          this.queue.push(operation);
        }
      }
    }
    
    this.saveToStorage();
  }

  private saveToStorage() {
    try {
      localStorage.setItem('offlineQueue', JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem('offlineQueue');
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
      this.queue = [];
    }
  }

  constructor() {
    this.loadFromStorage();
    
    // Process queue when coming back online
    window.addEventListener('online', () => {
      setTimeout(() => this.processQueue(), 1000);
    });
  }
}

export const offlineQueue = new OfflineQueue();