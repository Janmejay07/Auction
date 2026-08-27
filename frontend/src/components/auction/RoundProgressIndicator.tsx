'use client';

import React from 'react';
import type { AuctionPoolState } from '@/types';
import { Trophy, CheckCircle2, CircleDot, Circle } from 'lucide-react';

interface RoundProgressIndicatorProps {
  poolState?: AuctionPoolState | null;
}

const POSITIONS = [
  { key: 'GK', label: 'Goalkeepers' },
  { key: 'DEF', label: 'Defenders' },
  { key: 'MID', label: 'Midfielders' },
  { key: 'FWD', label: 'Forwards' },
];

export function RoundProgressIndicator({ poolState }: RoundProgressIndicatorProps) {
  if (!poolState) return null;

  const currentRound = poolState.round || 1;
  const currentPosition = poolState.position || 'GK';
  const completedPositions = poolState.completedPositions || [];

  return (
    <div className="w-full bg-gradient-to-r from-arena-950 via-arena-900 to-arena-950 border border-arena-800/90 rounded-3xl p-4 sm:p-5 shadow-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Round Badge & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-sm shadow-inner">
            R{currentRound}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">
                ROUND {currentRound} OF {poolState.totalRounds || 3}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <span>{poolState.groupLabel || poolState.roundName}</span>
            </h3>
          </div>
        </div>

        {/* Position Step Sequence */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          {POSITIONS.map((pos) => {
            const isCompleted = completedPositions.includes(pos.key);
            const isCurrent = currentPosition === pos.key && !isCompleted;
            const isUpcoming = !isCompleted && !isCurrent;

            return (
              <div
                key={pos.key}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border text-xs font-bold transition-all ${
                  isCurrent
                    ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/40'
                    : isCompleted
                    ? 'bg-arena-900/60 border-arena-800 text-slate-400'
                    : 'bg-arena-950/40 border-arena-850 text-slate-500'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : isCurrent ? (
                  <CircleDot className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-spin" style={{ animationDuration: '4s' }} />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                )}
                <span>{pos.label}</span>
                {isCurrent && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-400 text-arena-950 font-black uppercase tracking-wider ml-0.5">
                    LIVE
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
