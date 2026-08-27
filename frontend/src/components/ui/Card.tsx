import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glass' | 'pitch' | 'neon';
}

export function Card({ className, variant = 'default', children, ...props }: CardProps) {
  const variants = {
    default: 'bg-arena-900/90 border border-arena-800/80 backdrop-blur-md',
    elevated: 'bg-arena-850 border border-arena-700/80 shadow-xl shadow-black/40',
    glass: 'bg-arena-900/50 backdrop-blur-xl border border-arena-700/40 shadow-2xl',
    pitch: 'bg-gradient-to-b from-pitch-900/80 to-arena-950/95 border border-pitch-700/40',
    neon: 'bg-arena-900/90 border border-emerald-500/30 shadow-[0_0_25px_rgba(16,185,129,0.1)]',
  };

  return (
    <div
      className={cn(
        'rounded-2xl p-5 text-slate-100 transition-all duration-200',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
