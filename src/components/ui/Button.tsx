import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'accent';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button = ({
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  children,
  disabled,
  ...props
}: ButtonProps) => {
  const baseStyles =
    'relative inline-flex items-center justify-center gap-2 rounded-xl font-heading font-semibold tracking-wide ' +
    'transition-all duration-200 ease-out-expo ' +
    'disabled:opacity-45 disabled:cursor-not-allowed disabled:saturate-50 ' +
    'active:scale-[0.97] focus-visible:outline-none';

  const variants = {
    // Follows the active mode's accent colour.
    accent:
      'bg-accent text-base hover:brightness-110 shadow-accent-sm hover:shadow-accent',
    primary:
      'bg-primary text-slate-950 hover:brightness-110 shadow-[0_2px_12px_-2px_rgba(245,158,11,0.4)] hover:shadow-[0_6px_24px_-4px_rgba(245,158,11,0.5)]',
    secondary:
      'bg-surface text-ink border border-edge hover:bg-surface/70 hover:border-edge/70',
    danger:
      'bg-danger text-white hover:brightness-110 shadow-[0_2px_12px_-2px_rgba(239,68,68,0.4)] hover:shadow-[0_6px_24px_-4px_rgba(239,68,68,0.5)]',
    ghost:
      'bg-transparent text-ink-muted hover:bg-ink/5 hover:text-ink',
    outline:
      'bg-transparent border border-edge text-ink-muted hover:border-accent/60 hover:text-ink hover:bg-accent/5',
  };

  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-5 text-sm',
    lg: 'h-12 px-8 text-base',
    icon: 'h-10 w-10',
  };

  return (
    <button
      className={clsx(
        baseStyles,
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
};
