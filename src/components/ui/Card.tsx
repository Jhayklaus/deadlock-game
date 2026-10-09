import React from 'react';
import { clsx } from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'interactive' | 'outline' | 'accent';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = ({
  className,
  variant = 'default',
  padding = 'md',
  children,
  ...props
}: CardProps) => {
  const baseStyles = 'rounded-2xl transition-all duration-300 ease-out-expo';

  const variants = {
    default: 'bg-elevated/80 border border-edge/60 shadow-lg edge-light',
    glass: 'bg-elevated/50 backdrop-blur-xl border border-ink/10 shadow-xl edge-light',
    interactive:
      'bg-elevated/70 border border-edge/60 hover:border-accent/50 hover:bg-surface/60 ' +
      'cursor-pointer hover:-translate-y-0.5 hover:shadow-accent active:scale-[0.99] edge-light',
    outline: 'bg-transparent border border-dashed border-edge/70',
    accent: 'bg-accent/[0.07] border border-accent/30 shadow-accent-sm',
  };

  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-7',
  };

  /**
   * A card you can click is a control, and has to behave like one.
   *
   * These were plain divs with an onClick: no role, no tab stop, no keyboard
   * handler. Vote targets, night targets and the mode cards are all built from
   * them, so the primary interaction of every mode could not be reached with a
   * keyboard and was announced to a screen reader as a block of text. Anything
   * the caller sets explicitly still wins.
   */
  const clickable = typeof props.onClick === 'function';
  const a11y = clickable
    ? {
        role: props.role ?? 'button',
        tabIndex: props.tabIndex ?? 0,
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
          props.onKeyDown?.(e);
          if (e.defaultPrevented) return;
          // Space scrolls the page by default; a button must not.
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            props.onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
          }
        },
      }
    : {};

  return (
    <div
      className={clsx(
        baseStyles,
        variants[variant],
        paddings[padding],
        clickable && 'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
        className
      )}
      {...props}
      {...a11y}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ className, children }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx('mb-4 border-b border-edge/40 pb-4', className)}>{children}</div>
);

export const CardTitle = ({ className, children }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={clsx('text-base font-heading font-semibold tracking-tight text-ink', className)}>
    {children}
  </h3>
);

export const CardContent = ({ className, children }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx('text-ink-muted text-sm leading-relaxed', className)}>{children}</div>
);
