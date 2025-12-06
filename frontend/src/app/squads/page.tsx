'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Shield,
  Trophy,
  Users,
  Wallet,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

interface AuctionSquadSummary {
  roomId: string;
  roomCode: string;
  roomName: string;
  roomStatus: string;
  teamName: string;
  participantId: string;
  formation: string;
  squadSize: number;
  maxSquadSize: number;
  totalSpent: number;
  purseRemaining: number;
  createdAt: string;
}

export default function MySquadsHistoryPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [squads, setSquads] = useState<AuctionSquadSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/squads/my-history');
      setSquads(res.data?.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login?redirect=/squads');
      return;
    }
    if (user) {
      fetchHistory();
    }
  }, [user, isAuthLoading, router]);

  if (isLoading || isAuthLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-sm font-semibold text-slate-400">Loading your squad history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-3xl bg-arena-900/80 border border-arena-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-arena-950 rounded-[14px] flex items-center justify-center">
              <Shield className="w-7 h-7 text-emerald-400" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              MY AUCTION SQUADS
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Each auction preserves your independent squad permanently as historical data.
            </p>
          </div>
        </div>

        <Link href="/">
          <Button variant="primary" size="md">
            <PlusCircle className="w-4 h-4 mr-2" />
            Join New Auction
          </Button>
        </Link>
      </div>

      {/* Squad Cards Grid */}
      {squads.length === 0 ? (
        <Card variant="pitch" className="text-center py-16 px-6 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-arena-950/80 border border-arena-800 flex items-center justify-center mx-auto text-emerald-400">
            <Shield className="w-8 h-8 opacity-60" />
          </div>
          <h3 className="text-lg font-bold text-white">No Auction Squads Yet</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            You haven't participated in any live auctions yet. Join an auction room to build your
            dream team and manage your tactical squad.
          </p>
          <Link href="/" className="inline-block pt-2">
            <Button variant="gold">
              Explore Available Rooms
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {squads.map((s) => {
            const isCompleted = s.roomStatus === 'COMPLETED';
            const isLive = s.roomStatus === 'LIVE' || s.roomStatus === 'STARTING';

            return (
              <Card
                key={s.roomId}
                variant="glass"
                className="flex flex-col justify-between p-6 space-y-5 hover:border-emerald-500/50 transition-all group"
              >
                <div className="space-y-4">
                  {/* Top Bar: Room Code + Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="gold" size="sm">
                        {s.roomCode}
                      </Badge>
                      <span className="text-xs text-slate-500 font-mono">
                        {s.roomName || 'Auction Room'}
                      </span>
                    </div>
                    <Badge
                      variant={isCompleted ? 'success' : isLive ? 'warning' : 'outline'}
                      size="sm"
                    >
                      {s.roomStatus}
                    </Badge>
                  </div>

                  {/* Team Name & Formation */}
                  <div>
                    <h3 className="text-lg font-extrabold text-white group-hover:text-emerald-300 transition-colors">
                      {s.teamName}
                    </h3>
                    <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>Formation: <strong className="text-emerald-400">{s.formation}</strong></span>
                    </p>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-arena-950/80 border border-arena-800/80 text-center">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">
                        Squad
                      </span>
                      <span className="text-xs font-black text-slate-200 font-mono">
                        {s.squadSize} / {s.maxSquadSize}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">
                        Spent
                      </span>
                      <span className="text-xs font-black text-amber-400 font-mono">
                        {formatCurrency(s.totalSpent)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">
                        Purse Left
                      </span>
                      <span className="text-xs font-black text-emerald-400 font-mono">
                        {formatCurrency(s.purseRemaining)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-3 border-t border-arena-800/80 flex items-center justify-between gap-3">
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                  <Link href={`/rooms/${s.roomCode}/squad`}>
                    <Button variant="primary" size="sm" className="text-xs">
                      View Squad
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
