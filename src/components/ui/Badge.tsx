import React from 'react';
import { clsx } from 'clsx';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline' | 'accent';
}

export const Badge = ({
  className,
  variant = 'default',
  children,
  ...props
}: BadgeProps) => {
  const baseStyles =
    'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ' +
    'border uppercase tracking-[0.14em] whitespace-nowrap';

  const variants = {
    default: 'bg-surface/70 text-ink-muted border-edge/60',
    // Follows the active mode's accent colour.
    accent: 'bg-accent/12 text-accent border-accent/35',
    success: 'bg-success/12 text-success border-success/35',
    warning: 'bg-warning/12 text-warning border-warning/35',
    danger: 'bg-danger/12 text-danger border-danger/35',
    info: 'bg-info/12 text-info border-info/35',
    outline: 'bg-transparent text-ink-muted border-edge/70',
  };

  return (
    <span className={clsx(baseStyles, variants[variant], className)} {...props}>
      {children}
    </span>
  );
};
