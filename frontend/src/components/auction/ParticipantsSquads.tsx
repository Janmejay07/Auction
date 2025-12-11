'use client';

import React, { useEffect, useState } from 'react';
import type { Participant, RoomSettings, SquadPlayer, Player } from '@/types';
import { formatCurrency, getPositionBadge } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Users, Trophy, Wallet, Shield, ChevronRight, User, ExternalLink } from 'lucide-react';
import Link from 'next/navigation';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface ParticipantsSquadsProps {
  participants: Participant[];
  currentUserId?: string;
  settings?: RoomSettings;
  roomCode?: string;
}

export function ParticipantsSquads({
  participants,
  currentUserId,
  settings,
  roomCode,
}: ParticipantsSquadsProps) {
  const router = useRouter();
  const maxSquad = settings?.squadLimit || 11;

  const [squadsMap, setSquadsMap] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (!roomCode) return;
    const fetchSquads = async () => {
      try {
        const res = await api.get(`/rooms/${roomCode}/squads`);
        if (res.data?.success && res.data.data?.participants) {
          const map: Record<string, any[]> = {};
          for (const p of res.data.data.participants) {
            map[p._id] = p.squad || [];
          }
          setSquadsMap(map);
        }
      } catch (err) {
        // Silently fail or rely on props
      }
    };
    fetchSquads();
    const interval = setInterval(fetchSquads, 5000);
    return () => clearInterval(interval);
  }, [roomCode, participants]);

  return (
    <Card variant="default" className="w-full space-y-3">
      <div className="flex items-center justify-between pb-3 border-b border-arena-800">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-200">Managers & Squads</h3>
        </div>
        <span className="text-xs text-slate-400 font-semibold">
          {participants.length} Active Teams
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {participants.map((p) => {
          const isMe = currentUserId && p.userId === currentUserId;
          const pursePercent = settings?.purseTotal
            ? Math.round((p.purse / settings.purseTotal) * 100)
            : 100;
          const managerSquad = p.squad || squadsMap[p._id] || [];

          return (
            <div
              key={p._id}
              onClick={() => {
                if (roomCode) {
                  router.push(`/rooms/${roomCode}/squad/${p._id}`);
                }
              }}
              className={`p-4 rounded-2xl border transition-all cursor-pointer group hover:scale-[1.01] hover:border-emerald-500/70 hover:shadow-xl ${
                isMe
                  ? 'bg-gradient-to-b from-pitch-900/40 via-arena-900 to-arena-950 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                  : 'bg-arena-900/70 hover:bg-arena-900 border-arena-800'
              }`}
            >
              {/* Top row */}
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-arena-800 border border-arena-700 flex items-center justify-center font-black text-xs text-emerald-400 shrink-0 group-hover:border-emerald-500/50 transition-colors">
                    {(p.teamName || 'T').charAt(0).toUpperCase()}
                  </div>
                  <div className="truncate">
                    <span className="text-sm font-bold text-slate-100 truncate block group-hover:text-emerald-300 transition-colors">
                      {p.teamName || 'Team'}
                    </span>
                    {p.isCreator && (
                      <span className="text-[9px] font-extrabold text-amber-400 uppercase tracking-wider block">
                        Host
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {isMe && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      YOU
                    </span>
                  )}
                  <div className="w-6 h-6 rounded-lg bg-arena-800/80 flex items-center justify-center text-slate-400 group-hover:text-emerald-400 group-hover:bg-emerald-500/10 transition-all">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-1.5 text-xs pt-1 pb-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Wallet className="w-3.5 h-3.5 text-slate-500" />
                    Purse:
                  </span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {formatCurrency(p.purse)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Shield className="w-3.5 h-3.5 text-slate-500" />
                    Squad Slots:
                  </span>
                  <span className="font-semibold text-slate-200">
                    {p.squadCount} / {maxSquad}
                  </span>
                </div>

                {/* Purse gauge */}
                <div className="w-full h-1.5 bg-arena-950 rounded-full overflow-hidden border border-arena-800">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, pursePercent))}%` }}
                  />
                </div>
              </div>

              {/* Purchased Players Underneath */}
              <div className="pt-2.5 border-t border-arena-800/80">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Squad ({managerSquad.length})
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-400 group-hover:underline flex items-center gap-0.5">
                    View XI Pitch <ExternalLink className="w-2.5 h-2.5" />
                  </span>
                </div>

                {managerSquad.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic py-1">
                    No players purchased yet.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {managerSquad.map((sp: any, idx: number) => {
                      const playerObj: Player = sp.playerId?.name ? sp.playerId : sp.player || {};
                      const playerName = playerObj.name || 'Unknown Player';
                      const posBadge = playerObj.position ? getPositionBadge(playerObj.position) : null;
                      const price = sp.purchasePrice || sp.boughtFor || 0;

                      return (
                        <div
                          key={sp._id || idx}
                          className="flex items-center justify-between px-2 py-1 rounded-lg bg-arena-950/60 border border-arena-800 text-[11px]"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {posBadge && (
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${posBadge.bg}`}>
                                {posBadge.abbr}
                              </span>
                            )}
                            <span className="font-medium text-slate-200 truncate">
                              {playerName}
                            </span>
                            {sp.status === 'STARTING_XI' && (
                              <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/30">
                                XI
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-slate-400 shrink-0 text-[10px]">
                            {formatCurrency(price)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
