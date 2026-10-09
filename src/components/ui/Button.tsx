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
  /*
   * The filled variants now sit on a solid offset shadow and depress into it
   * when tapped, instead of shrinking slightly. A glow says "this is lit"; a
   * shadow with an edge says "this is a thing you can push", which is what a
   * primary action wants to say.
   */
  const baseStyles =
    'relative inline-flex items-center justify-center gap-2 rounded-xl font-heading font-semibold tracking-wide ' +
    'transition-all duration-200 ease-out-expo ' +
    'disabled:opacity-45 disabled:cursor-not-allowed disabled:saturate-50 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-base';

  const variants = {
    // Follows the active mode's accent colour.
    accent:
      'bg-accent text-base hover:brightness-110 solid-shadow-filled press',
    primary:
      'bg-primary text-base hover:brightness-110 solid-shadow-filled press',
    danger:
      'bg-danger text-white hover:brightness-110 solid-shadow-danger press',
    secondary:
      'bg-surface text-ink border border-edge hover:bg-surface/70 hover:border-edge/70 solid-shadow-sm press',
    ghost:
      'bg-transparent text-ink-muted hover:bg-ink/5 hover:text-ink active:scale-[0.97]',
    outline:
      'bg-transparent border border-edge text-ink-muted hover:border-accent/60 hover:text-ink hover:bg-accent/5 active:scale-[0.97]',
  };

  const sizes = {
    sm: 'h-9 px-3.5 text-xs',
    md: 'h-11 px-5 text-sm',
    lg: 'h-14 px-8 text-base',
    icon: 'h-11 w-11',
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
