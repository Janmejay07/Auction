'use client';

import React, { useEffect, useState } from 'react';
import { Timer, Zap } from 'lucide-react';

interface AuctionTimerProps {
  timerEndsAt: string | null;
  totalDurationSeconds?: number;
  isLive: boolean;
  hasBids: boolean;
}

export function AuctionTimer({
  timerEndsAt,
  totalDurationSeconds = 15,
  isLive,
  hasBids,
}: AuctionTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [progress, setProgress] = useState<number>(100);

  useEffect(() => {
    if (!timerEndsAt || !isLive) {
      setSecondsLeft(null);
      setProgress(100);
      return;
    }

    const calculateTime = () => {
      const endTime = new Date(timerEndsAt).getTime();
      const now = Date.now();
      const diffMs = endTime - now;
      const sec = Math.max(0, Math.ceil(diffMs / 1000));
      setSecondsLeft(sec);

      const percent = Math.min(100, Math.max(0, (diffMs / (totalDurationSeconds * 1000)) * 100));
      setProgress(percent);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 100);

    return () => clearInterval(interval);
  }, [timerEndsAt, totalDurationSeconds, isLive]);

  if (!isLive) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-arena-900/60 border border-arena-800 text-slate-500 text-xs font-semibold">
        <Timer className="w-4 h-4" />
        <span>AUCTION NOT ACTIVE</span>
      </div>
    );
  }

  if (secondsLeft === null) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-pitch-900/40 border border-pitch-700/50 text-emerald-400 text-xs font-bold animate-pulse">
        <Zap className="w-4 h-4 text-emerald-400" />
        <span>WAITING FOR TIMER</span>
      </div>
    );
  }

  // Color schemes based on urgency
  const isUrgent = secondsLeft <= 3;
  const isWarning = secondsLeft <= 6 && !isUrgent;

  const colorStyles = isUrgent
    ? {
        text: 'text-rose-400',
        bg: 'bg-rose-500/10 border-rose-500/30',
        bar: 'bg-gradient-to-r from-rose-600 to-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.6)]',
      }
    : isWarning
    ? {
        text: 'text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/30',
        bar: 'bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]',
      }
    : {
        text: 'text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/30',
        bar: 'bg-gradient-to-r from-pitch-500 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]',
      };

  return (
    <div className={`w-full flex flex-col gap-2 p-3.5 rounded-2xl border ${colorStyles.bg} transition-all duration-200`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className={`w-4 h-4 ${colorStyles.text} ${isUrgent ? 'animate-bounce' : ''}`} />
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
            Hammer Countdown
          </span>
        </div>
        <div className={`text-2xl font-black font-mono tracking-tight ${colorStyles.text}`}>
          {secondsLeft}s
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full h-2 bg-arena-950/80 rounded-full overflow-hidden p-0.5 border border-arena-800/80">
        <div
          className={`h-full rounded-full transition-all duration-100 ease-linear ${colorStyles.bar}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
