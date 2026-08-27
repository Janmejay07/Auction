'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import type { Participant, AuctionRoom } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Trophy, Award, Users, ArrowRight, Shield } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

interface CompletedSummaryProps {
  room: AuctionRoom;
  participants: Participant[];
  reason?: string | null;
}

export function CompletedSummary({ room, participants, reason }: CompletedSummaryProps) {
  useEffect(() => {
    // Launch celebratory confetti
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }
  }, []);

  const getReasonMessage = () => {
    if (reason === 'ALL_SQUADS_FULL') {
      return 'All manager squads have reached full capacity (11/11 players).';
    }
    if (reason === 'NOT_ENOUGH_PLAYERS') {
      return 'The auction ended because there are fewer than 2 active participants.';
    }
    if (reason === 'NO_PLAYERS_REMAINING') {
      return 'All players in the draft pool have been processed.';
    }
    return 'The auction has ended. Review the final squads and purse spending below.';
  };

  const sortedParticipants = [...participants].sort((a, b) => b.squadCount - a.squadCount || b.purse - a.purse);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Trophy Hero Banner */}
      <Card variant="pitch" className="text-center p-8 sm:p-12 relative overflow-hidden">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 shadow-2xl shadow-amber-500/30 mb-6 flex items-center justify-center">
          <div className="w-full h-full bg-arena-950 rounded-[22px] flex items-center justify-center">
            <Trophy className="w-10 h-10 text-yellow-400" />
          </div>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-2">
          AUCTION COMPLETED
        </h1>

        <div className="inline-block px-4 py-1.5 rounded-full bg-arena-950/80 border border-arena-700/80 text-xs font-semibold text-emerald-300 mb-4">
          {getReasonMessage()}
        </div>

        <div className="flex flex-wrap justify-center gap-3 mt-4">
          <Link href={`/rooms/${room.roomCode}/squad`}>
            <Button variant="gold" size="lg" className="shadow-lg shadow-amber-500/20 font-black">
              <Shield className="w-4 h-4 mr-2" />
              View My Final Squad
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Link href="/">
            <Button variant="secondary" size="lg">
              Return to Rooms Hub
            </Button>
          </Link>
        </div>
      </Card>

      {/* Final Standings / Roster */}
      <Card variant="glass" className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-arena-800">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-slate-100">Final Squad Leaderboard</h3>
          </div>
          <Link href={`/rooms/${room.roomCode}/squad`}>
            <Button variant="ghost" size="sm" className="text-xs text-amber-400 hover:text-amber-300">
              Explore All Squads →
            </Button>
          </Link>
        </div>

        <div className="space-y-3">
          {sortedParticipants.map((p, index) => (
            <div
              key={p._id}
              className="p-4 rounded-2xl bg-arena-900/80 border border-arena-800 flex flex-wrap items-center justify-between gap-4 transition-colors hover:border-arena-700"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                    index === 0
                      ? 'bg-yellow-400 text-arena-950 shadow-md shadow-yellow-400/30'
                      : index === 1
                      ? 'bg-slate-300 text-arena-950'
                      : index === 2
                      ? 'bg-amber-700 text-white'
                      : 'bg-arena-800 text-slate-400'
                  }`}
                >
                  #{index + 1}
                </div>
                <div className="truncate">
                  <h4 className="text-sm font-bold text-slate-100 truncate">{p.teamName}</h4>
                  <p className="text-xs text-slate-500">
                    Spent {formatCurrency(p.spent || (room.settings.purseTotal - p.purse))}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 sm:gap-6 text-right shrink-0">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Players Signed</span>
                  <span className="text-sm font-bold text-slate-200">{p.squadCount}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Purse Left</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">
                    {formatCurrency(p.purse)}
                  </span>
                </div>
                <Link href={`/rooms/${room.roomCode}/squad/${p._id}`}>
                  <Button variant="secondary" size="sm" className="text-xs">
                    View Squad
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
