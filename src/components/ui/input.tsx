import * as React from 'react';
import { cn } from '@/lib/utils';
import { soundManager } from '@/lib/sounds';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  disableSound?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onFocus, onKeyDown, disableSound = false, disabled, placeholder, value, onChange, defaultValue, name, id, ...props }, ref) => {
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
          'flex h-10 w-full rounded-xl border border-input bg-background/60 backdrop-blur-md px-3.5 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:border-ring/60 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200',
          className
        )}
        onFocus={handleFocus}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        defaultValue={defaultValue}
        name={name}
        id={id}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
