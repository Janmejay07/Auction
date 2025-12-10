'use client';

import React from 'react';
import type { Bid, Participant } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Activity, ArrowUpRight } from 'lucide-react';

interface LiveBidFeedProps {
  bids: Bid[];
  participants: Participant[];
}

export function LiveBidFeed({ bids, participants }: LiveBidFeedProps) {
  const getParticipant = (participantId: string) => {
    return participants.find((p) => p._id === participantId);
  };

  const sortedBids = [...bids].reverse();

  return (
    <Card variant="default" className="w-full flex flex-col h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-arena-800">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-200">Live Bid Activity</h3>
        </div>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-arena-800 text-slate-400">
          {bids.length} Bids
        </span>
      </div>

      {/* Feed List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-arena-700">
        {sortedBids.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <ArrowUpRight className="w-8 h-8 opacity-40 mb-2" />
            <p className="text-xs font-semibold">No bids recorded yet for this round</p>
          </div>
        ) : (
          sortedBids.map((bid, index) => {
            const participant = getParticipant(bid.participantId) || bid.participant;
            const isHighest = index === 0;

            return (
              <div
                key={bid._id || bid.clientBidId || index}
                className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                  isHighest
                    ? 'bg-gradient-to-r from-emerald-950/70 to-arena-900 border-emerald-500/40 shadow-sm'
                    : 'bg-arena-900/60 border-arena-800/80 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                      isHighest
                        ? 'bg-emerald-500 text-arena-950 shadow-md shadow-emerald-500/30'
                        : 'bg-arena-800 text-slate-300'
                    }`}
                  >
                    #{bid.sequence}
                  </div>
                  <div className="truncate">
                    <div
                      className={`text-xs font-bold truncate ${
                        isHighest ? 'text-slate-100' : 'text-slate-300'
                      }`}
                    >
                      {participant?.teamName || 'Anonymous Bidder'}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {new Date(bid.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`text-sm font-bold font-mono ${
                      isHighest ? 'text-emerald-400' : 'text-slate-300'
                    }`}
                  >
                    {formatCurrency(bid.amount)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
