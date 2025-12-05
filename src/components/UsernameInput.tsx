import { useState, useEffect, useCallback } from 'react';
import { Input } from './ui/input';
import { Check, X, Loader2 } from 'lucide-react';
import { API_URL } from '@/config/api';

interface UsernameInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean) => void;
}

export default function UsernameInput({ value, onChange, onValidationChange }: UsernameInputProps) {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<'idle' | 'available' | 'taken' | 'invalid'>('idle');
  const [message, setMessage] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const checkUsername = useCallback(async (username: string) => {
    if (!username || username.length < 3) {
      setStatus('invalid');
      setMessage('Username must be at least 3 characters');
      setSuggestions([]);
      onValidationChange?.(false);
      return;
    }

    if (username.length > 20) {
      setStatus('invalid');
      setMessage('Username must be less than 20 characters');
      setSuggestions([]);
      onValidationChange?.(false);
      return;
    }

    const validPattern = /^[a-zA-Z0-9_]+$/;
    if (!validPattern.test(username)) {
      setStatus('invalid');
      setMessage('Only letters, numbers, and underscores allowed');
      setSuggestions([]);
      onValidationChange?.(false);
      return;
    }

    setChecking(true);
    try {
      const response = await fetch(`${API_URL}/username/check/${username}`);
      const data = await response.json();

      if (data.available) {
        setStatus('available');
        setMessage(data.message);
        setSuggestions([]);
        onValidationChange?.(true);
      } else {
        setStatus('taken');
        setMessage(data.message);
        setSuggestions(data.suggestions || []);
        onValidationChange?.(false);
      }
    } catch (error) {
      console.error('Error checking username:', error);
      setStatus('invalid');
      setMessage('Error checking username');
      setSuggestions([]);
      onValidationChange?.(false);
    } finally {
      setChecking(false);
    }
  }, [onValidationChange]);

  useEffect(() => {
    if (!value) {
      setStatus('idle');
      setMessage('');
      setSuggestions([]);
      onValidationChange?.(false);
      return;
    }

    // Debounce the check
    const timer = setTimeout(() => {
      checkUsername(value);
    }, 300);

    return () => clearTimeout(timer);
  }, [value, checkUsername, onValidationChange]);

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          placeholder="Choose a username"
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          className={`pr-10 transition-all duration-200 ${
            status === 'available'
              ? 'border-green-500 focus:ring-green-500'
              : status === 'taken' || status === 'invalid'
              ? 'border-red-500 focus:ring-red-500'
              : ''
          }`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {checking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {!checking && status === 'available' && (
            <Check className="h-4 w-4 text-green-500" />
          )}
          {!checking && (status === 'taken' || status === 'invalid') && (
            <X className="h-4 w-4 text-red-500" />
          )}
        </div>
      </div>

      {message && (
        <p
          className={`text-xs transition-all duration-200 ${
            status === 'available'
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          {message}
        </p>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Try these instead:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-3 py-1 text-xs rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-all duration-200 hover:scale-105"
              >
                @{suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
