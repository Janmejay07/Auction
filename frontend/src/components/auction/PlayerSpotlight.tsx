'use client';

import React from 'react';
import type { Player, Participant } from '@/types';
import { formatCurrency, getPositionBadge } from '@/lib/utils';
import { Shield, Sparkles, User, Globe, Flag } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

interface PlayerSpotlightProps {
  player: Player | null;
  currentHighestBid: number | null;
  highestParticipant: Participant | null;
  basePrice: number | null;
  sequence?: number | null;
}

export function PlayerSpotlight({
  player,
  currentHighestBid,
  highestParticipant,
  basePrice,
  sequence,
}: PlayerSpotlightProps) {
  if (!player) {
    return (
      <div className="w-full min-h-[380px] flex flex-col items-center justify-center p-8 rounded-3xl bg-arena-900/60 border border-arena-800 text-center border-dashed">
        <div className="w-16 h-16 rounded-2xl bg-arena-800/80 flex items-center justify-center mb-4 text-slate-500">
          <User className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-300">No Player on the Pitch</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Waiting for the auctioneer engine to bring up the next player in queue.
        </p>
      </div>
    );
  }

  const playerName = player.name || (player as any).playerName || 'Player';
  const playerPosition = player.position || 'GK';
  const pos = getPositionBadge(playerPosition);
  const effectiveBase = basePrice ?? player.basePrice ?? 0;
  const currentPrice = currentHighestBid ?? effectiveBase;
  const playerClub = player.club || 'Unknown Club';
  const playerRating = player.rating ?? 75;

  return (
    <div className="relative w-full rounded-3xl overflow-hidden bg-gradient-to-b from-arena-850 to-arena-950 border border-arena-700/70 shadow-2xl p-6 sm:p-8">
      {/* Background stadium glow accent */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-pitch-700/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Meta Bar */}
      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2">
          {sequence !== undefined && sequence !== null && (
            <span className="px-3 py-1 rounded-xl bg-arena-800/80 border border-arena-700 text-xs font-mono font-bold text-emerald-400">
              #{sequence}
            </span>
          )}
          <span className={`px-3 py-1 rounded-xl border text-xs font-bold ${pos.bg}`}>
            {pos.label} ({pos.abbr})
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-extrabold tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>OVR {playerRating}</span>
        </div>
      </div>

      {/* Player Main Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Visual / Avatar Placeholder / Card */}
        <div className="md:col-span-4 flex flex-col items-center">
          <div className="relative w-36 h-48 sm:w-44 sm:h-56 rounded-2xl bg-gradient-to-b from-arena-700/90 via-arena-800 to-arena-900 border-2 border-emerald-500/40 p-1 shadow-2xl flex flex-col justify-between overflow-hidden group">
            {/* Top Card Bar */}
            <div className="flex items-center justify-between p-2">
              <div className="flex flex-col items-center">
                <span className="text-xl font-black text-white leading-none">{playerRating}</span>
                <span className="text-[10px] font-bold text-emerald-400">{playerPosition}</span>
              </div>
              <Shield className="w-5 h-5 text-slate-400 opacity-60" />
            </div>

            {/* Avatar Center / Photo */}
            <div className="flex flex-col items-center justify-center my-auto relative w-full h-28 sm:h-36">
              {player.image || player.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={player.image || player.imageUrl}
                  alt={playerName}
                  className="w-full h-full object-contain drop-shadow-2xl hover:scale-105 transition-transform"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-arena-950/80 border border-arena-700 flex items-center justify-center text-slate-300 font-extrabold text-2xl shadow-inner">
                  {playerName.charAt(0)}
                </div>
              )}
            </div>

            {/* Bottom Card Bar */}
            <div className="p-2 bg-arena-950/90 rounded-xl text-center border border-arena-800 flex items-center justify-center gap-1.5">
              {player.clubLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={player.clubLogo} alt={playerClub} className="w-4 h-4 object-contain" />
              )}
              <div className="text-[11px] font-bold text-slate-200 truncate">{playerClub}</div>
            </div>
          </div>
        </div>

        {/* Player Details & Pricing */}
        <div className="md:col-span-8 space-y-5">
          <div>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {playerName}
            </h2>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs sm:text-sm text-slate-400">
              <span className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-slate-500" />
                <strong className="text-slate-200">{playerClub}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Flag className="w-3.5 h-3.5 text-slate-500" />
                <strong className="text-slate-200">{player.nationality || 'Unknown'}</strong>
              </span>
              {player.age && (
                <>
                  <span>•</span>
                  <span>{player.age} Years</span>
                </>
              )}
            </div>
          </div>

          {/* Pricing Banners */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-arena-900/90 border border-arena-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Base Starting Price
              </span>
              <span className="text-lg sm:text-xl font-bold text-slate-300 font-mono">
                {formatCurrency(effectiveBase)}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/60 to-arena-900 border border-emerald-500/40 shadow-lg">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1 flex items-center justify-between">
                <span>Current Bid</span>
                {currentHighestBid ? (
                  <Badge variant="success" size="sm">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" size="sm">
                    Starting
                  </Badge>
                )}
              </span>
              <span className="text-xl sm:text-2xl font-black text-emerald-300 font-mono">
                {formatCurrency(currentPrice)}
              </span>
            </div>
          </div>

          {/* Highest Bidder Spotlight */}
          <div className="p-3.5 rounded-2xl bg-arena-900/80 border border-arena-800/80 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Current Highest Bidder:</span>
            {highestParticipant ? (
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-bold text-emerald-400">
                  {highestParticipant.teamName}
                </span>
              </div>
            ) : (
              <span className="text-xs font-medium text-slate-500 italic">No bids placed yet</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
