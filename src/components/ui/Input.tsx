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
        className={clsx(
          "flex h-12 w-full rounded-lg border bg-slate-950/50 px-4 py-2 text-sm ring-offset-slate-950 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:border-amber-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
          error ? "border-red-500 focus-visible:ring-red-500/50" : "border-slate-700",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
