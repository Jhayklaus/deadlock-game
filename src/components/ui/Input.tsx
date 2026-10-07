import React from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={error || undefined}
        className={clsx(
          'flex h-12 w-full rounded-xl border bg-base/60 px-4 py-2 text-sm text-ink',
          'placeholder:text-ink-muted/70 transition-all duration-200 ease-out-expo',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error
            ? 'border-danger/70 focus-visible:ring-danger/40 focus-visible:border-danger'
            : 'border-edge/70 hover:border-edge focus-visible:border-accent',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
