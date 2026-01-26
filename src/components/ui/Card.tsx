import React from 'react';
import { clsx } from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'interactive' | 'outline';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = ({ 
  className, 
  variant = 'default', 
  padding = 'md',
  children, 
  ...props 
}: CardProps) => {
  const baseStyles = "rounded-xl overflow-hidden transition-all duration-300";
  
  const variants = {
    default: "bg-slate-900 border border-slate-800 shadow-xl",
    glass: "bg-slate-900/60 backdrop-blur-md border border-white/10 shadow-2xl",
    interactive: "bg-slate-900/80 border border-slate-700 hover:border-slate-500 hover:bg-slate-800 cursor-pointer hover:shadow-lg hover:-translate-y-1 active:scale-95",
    outline: "bg-transparent border-2 border-slate-800 border-dashed"
  };

  const paddings = {
    none: "",
    sm: "p-3",
    md: "p-5",
    lg: "p-8"
  };

  return (
    <div 
      className={clsx(baseStyles, variants[variant], paddings[padding], className)} 
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ className, children }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx("mb-4 border-b border-white/5 pb-4", className)}>
    {children}
  </div>
);

export const CardTitle = ({ className, children }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={clsx("text-lg font-bold font-creepster tracking-wide text-slate-100", className)}>
    {children}
  </h3>
);

export const CardContent = ({ className, children }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx("text-slate-300", className)}>
    {children}
  </div>
);
