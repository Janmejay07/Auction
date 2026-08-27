'use client';

import React from 'react';
import type { AuctionPoolState, PoolPlayerItem, Player } from '@/types';
import { Card } from '@/components/ui/Card';
import { formatCurrency, getPositionBadge } from '@/lib/utils';
import { Layers, User, Radio, CheckCircle, XCircle, Clock } from 'lucide-react';

interface LivePoolTrackerProps {
  poolState?: AuctionPoolState | null;
  currentLivePlayerId?: string | null;
}

export function LivePoolTracker({ poolState, currentLivePlayerId }: LivePoolTrackerProps) {
  if (!poolState) return null;

  const poolPlayers = poolState.poolPlayers || [];
  const soldCount = poolPlayers.filter((p) => p.status === 'SOLD').length;
  const unsoldCount = poolPlayers.filter((p) => p.status === 'UNSOLD').length;
  const pendingCount = poolPlayers.filter((p) => p.status === 'PENDING').length;

  return (
    <Card variant="default" className="w-full space-y-3.5 bg-arena-900/80 border-arena-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-arena-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">
                CURRENT POOL TRACKER
              </span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs font-mono font-bold text-slate-300">
                ROUND {poolState.round} · {poolState.groupLabel || poolState.clubGroup}
              </span>
            </div>
            <h3 className="text-sm font-extrabold text-white">
              {poolState.positionLabel || poolState.position} Pool
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
            {soldCount} Sold
          </span>
          {unsoldCount > 0 && (
            <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-slate-400 font-bold">
              {unsoldCount} Unsold
            </span>
          )}
          <span className="px-2.5 py-1 rounded-xl bg-arena-950 border border-arena-800 text-slate-400 font-bold">
            {pendingCount} Pending
          </span>
        </div>
      </div>

      {/* Players List Table */}
      {poolPlayers.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-xs font-semibold">
          No players in current pool.
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {poolPlayers.map((item, idx) => {
            const playerObj: Player = item.playerId || {};
            const isLive = item.status === 'LIVE' || (currentLivePlayerId && playerObj._id === currentLivePlayerId);
            const isSold = item.status === 'SOLD';
            const isUnsold = item.status === 'UNSOLD';
            const posBadge = playerObj.position ? getPositionBadge(playerObj.position) : null;

            return (
              <div
                key={item._id || idx}
                className={`p-2.5 sm:p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isLive
                    ? 'bg-gradient-to-r from-pitch-900/60 to-arena-900 border-emerald-500 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-500/50'
                    : isSold
                    ? 'bg-arena-950/60 border-amber-500/20'
                    : isUnsold
                    ? 'bg-arena-950/40 border-arena-800/80 opacity-75'
                    : 'bg-arena-950/70 border-arena-800/80 hover:border-arena-700'
                }`}
              >
                {/* Left: Avatar + Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-arena-800 border border-arena-700 overflow-hidden flex items-center justify-center shrink-0">
                    {playerObj.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={playerObj.image}
                        alt={playerObj.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-4 h-4 text-slate-400" />
                    )}
                  </div>

                  <div className="truncate">
                    <div className="flex items-center gap-1.5">
                      {posBadge && (
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${posBadge.bg}`}>
                          {posBadge.abbr}
                        </span>
                      )}
                      <span className={`font-bold text-xs truncate ${isLive ? 'text-emerald-300 font-extrabold' : 'text-slate-200'}`}>
                        {playerObj.name || 'Player'}
                      </span>
                      {playerObj.rating && (
                        <span className="text-[10px] font-mono text-yellow-400/90 font-semibold">
                          ★{playerObj.rating}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span className="truncate">{playerObj.club}</span>
                      <span>•</span>
                      <span className="font-mono text-slate-400">
                        Base: {formatCurrency(item.basePrice || playerObj.basePrice)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Dynamic Status */}
                <div className="shrink-0">
                  {isLive ? (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500 text-arena-950 font-black text-[10px] tracking-wider uppercase shadow-md shadow-emerald-500/30 animate-pulse">
                      <Radio className="w-3 h-3" />
                      LIVE
                    </span>
                  ) : isSold ? (
                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-[10px]">
                        <CheckCircle className="w-2.5 h-2.5" />
                        SOLD
                      </span>
                      {item.soldPrice ? (
                        <span className="block font-mono text-[10px] font-bold text-emerald-400">
                          {formatCurrency(item.soldPrice)}
                        </span>
                      ) : null}
                    </div>
                  ) : isUnsold ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold text-[10px]">
                      <XCircle className="w-2.5 h-2.5" />
                      UNSOLD
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-arena-900 border border-arena-800 text-slate-400 font-medium text-[10px]">
                      <Clock className="w-2.5 h-2.5 text-slate-500" />
                      PENDING
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
