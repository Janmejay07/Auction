import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { PlayerPosition } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '₹0';
  if (amount >= 10000000) {
    const cr = amount / 10000000;
    return `₹${cr.toFixed(cr % 1 === 0 ? 0 : 2)} Cr`;
  }
  if (amount >= 100000) {
    const l = amount / 100000;
    return `₹${l.toFixed(l % 1 === 0 ? 0 : 1)} Lakh`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getPositionBadge(position: PlayerPosition) {
  switch (position) {
    case 'GK':
      return {
        label: 'Goalkeeper',
        abbr: 'GK',
        bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        color: 'text-amber-400',
      };
    case 'DEF':
      return {
        label: 'Defender',
        abbr: 'DEF',
        bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
        color: 'text-blue-400',
      };
    case 'MID':
      return {
        label: 'Midfielder',
        abbr: 'MID',
        bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        color: 'text-emerald-400',
      };
    case 'FWD':
      return {
        label: 'Forward',
        abbr: 'FWD',
        bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        color: 'text-rose-400',
      };
    default:
      return {
        label: position,
        abbr: position,
        bg: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
        color: 'text-slate-300',
      };
  }
}
