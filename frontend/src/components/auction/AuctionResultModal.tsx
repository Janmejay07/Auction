'use client';

import React, { useEffect, useState } from 'react';
import type { Player, Participant } from '@/types';
import { formatCurrency, getPositionBadge } from '@/lib/utils';
import { Trophy, Ban, CheckCircle2, User, Clock, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export interface AuctionResultData {
  type: 'SOLD' | 'UNSOLD';
  player: Player | null;
  winner?: Participant | null;
  winnerName?: string;
  winningAmount?: number;
  displayDurationSeconds?: number;
}

interface AuctionResultModalProps {
  data: AuctionResultData | null;
}

export function AuctionResultModal({ data }: AuctionResultModalProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(3);
  const [progress, setProgress] = useState<number>(100);

  const duration = data?.displayDurationSeconds || 3;

  useEffect(() => {
    if (!data) return;

    setSecondsRemaining(duration);
    setProgress(100);

    const startTime = Date.now();
    const endTime = startTime + duration * 1000;

    const interval = setInterval(() => {
      const now = Date.now();
      const remainingMs = Math.max(0, endTime - now);
      const remainingSec = Math.ceil(remainingMs / 1000);
      setSecondsRemaining(remainingSec);

      const percent = (remainingMs / (duration * 1000)) * 100;
      setProgress(Math.max(0, Math.min(100, percent)));

      if (remainingMs <= 0) {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [data, duration]);

  if (!data) return null;

  const isSold = data.type === 'SOLD';
  const player = data.player;
  const pos = player ? getPositionBadge(player.position) : null;
  const winnerName = data.winner?.teamName || data.winnerName || 'Winner';
  const amount = data.winningAmount || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-arena-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-lg overflow-hidden rounded-3xl border p-6 sm:p-8 text-center shadow-2xl transition-all duration-300 transform scale-100 ${
          isSold
            ? 'bg-gradient-to-b from-pitch-900/90 via-arena-900 to-arena-950 border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.25)]'
            : 'bg-gradient-to-b from-rose-950/80 via-arena-900 to-arena-950 border-rose-500/40 shadow-[0_0_50px_rgba(244,63,94,0.2)]'
        }`}
      >
        {/* Glow ambient circle */}
        <div
          className={`absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-40 ${
            isSold ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />

        {/* Header Result Badge */}
        <div className="relative z-10 flex flex-col items-center mb-5">
          {isSold ? (
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 shadow-lg animate-bounce">
              <Trophy className="w-6 h-6 text-yellow-400" />
              <span className="text-xl sm:text-2xl font-black tracking-widest uppercase">
                SOLD!
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-rose-500/20 border border-rose-500/50 text-rose-300 shadow-lg">
              <Ban className="w-6 h-6 text-rose-400" />
              <span className="text-xl sm:text-2xl font-black tracking-widest uppercase">
                UNSOLD
              </span>
            </div>
          )}
        </div>

        {/* Player Info Card */}
        <div className="relative z-10 bg-arena-950/80 border border-arena-800/90 rounded-2xl p-5 mb-5 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-arena-850 border border-arena-700/80 text-slate-300">
            {player?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={player.image}
                alt={player.name}
                className="w-full h-full object-cover rounded-2xl"
              />
            ) : (
              <User className="w-8 h-8 text-slate-400" />
            )}
          </div>

          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              {player?.name || 'Player'}
            </h2>
            {player && (
              <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
                {pos && (
                  <span className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-bold ${pos.bg}`}>
                    {pos.label} ({pos.abbr})
                  </span>
                )}
                {player.club && (
                  <span className="text-xs text-slate-400 font-medium">
                    {player.club}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Winning Details or Unsold Details */}
          {isSold ? (
            <div className="pt-3 border-t border-arena-800 space-y-2">
              <div className="flex items-center justify-between text-xs px-2">
                <span className="text-slate-400">Winning Bid:</span>
                <span className="text-lg font-black text-emerald-400 font-mono">
                  {formatCurrency(amount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs px-2">
                <span className="text-slate-400">New Manager:</span>
                <span className="font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  {winnerName}
                </span>
              </div>
            </div>
          ) : (
            <div className="pt-3 border-t border-arena-800 text-xs text-slate-400">
              No valid bids were placed for this player.
            </div>
          )}
        </div>

        {/* Server countdown footer */}
        <div className="relative z-10 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-semibold">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Preparing next player...
            </span>
            <span className="font-mono text-slate-200">
              {secondsRemaining}s
            </span>
          </div>

          {/* Progress bar track */}
          <div className="w-full h-2 bg-arena-950 rounded-full overflow-hidden border border-arena-800 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-75 ease-linear ${
                isSold
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                  : 'bg-gradient-to-r from-rose-500 to-amber-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
