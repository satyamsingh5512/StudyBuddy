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
          // Apple taste: flat field, hairline border, 18px radius, accent ring
          // on focus. Search-style inputs can opt into `rounded-full` per spec.
          'flex h-11 w-full rounded-[18px] border border-hairline bg-surface px-5 py-3 text-[17px] tracking-[-0.022em] text-ink',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-ink',
          'transition-colors duration-150 ease-out-soft',
          'focus-visible:border-hairline-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-focus',
          'disabled:cursor-not-allowed disabled:opacity-50',
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
