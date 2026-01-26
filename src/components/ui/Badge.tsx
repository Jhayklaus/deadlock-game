import React from 'react';
import { clsx } from 'clsx';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
}

export const Badge = ({ 
  className, 
  variant = 'default', 
  children, 
  ...props 
}: BadgeProps) => {
  const baseStyles = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border uppercase tracking-widest";
  
  const variants = {
    default: "bg-slate-800 text-slate-300 border-slate-700",
    success: "bg-green-900/30 text-green-400 border-green-800",
    warning: "bg-amber-900/30 text-amber-400 border-amber-800",
    danger: "bg-red-900/30 text-red-400 border-red-800",
    info: "bg-blue-900/30 text-blue-400 border-blue-800",
    outline: "bg-transparent text-slate-400 border-slate-600"
  };

  return (
    <span 
      className={clsx(baseStyles, variants[variant], className)} 
      {...props}
    >
      {children}
    </span>
  );
};
