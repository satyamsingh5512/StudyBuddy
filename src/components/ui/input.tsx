import * as React from 'react';
import { cn } from '@/lib/utils';
import { soundManager } from '@/lib/sounds';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  disableSound?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onFocus, disableSound = false, disabled, placeholder, value, onChange, defaultValue, name, id }, ref) => {
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // Play input focus sound
      if (!disableSound && !disabled) {
        soundManager.playInputFocus();
      }
      // Call original handler if provided
      onFocus?.(e);
    };

    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        onFocus={handleFocus}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        defaultValue={defaultValue}
        name={name}
        id={id}
        ref={ref}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
