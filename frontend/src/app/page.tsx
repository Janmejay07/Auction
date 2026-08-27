'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CreateRoomModal } from '@/components/room/CreateRoomModal';
import { JoinRoomModal } from '@/components/room/JoinRoomModal';
import Link from 'next/link';
import {
  Trophy,
  PlusCircle,
  LogIn,
  Users,
  Timer,
  Zap,
  Shield,
  Sparkles,
  ArrowRight,
  Flame,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
      {/* Hero Section */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-pitch-900/60 via-arena-900 to-arena-950 border border-pitch-700/40 p-8 sm:p-14 shadow-2xl">
        {/* Glow backdrop circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="flex items-center gap-2">
            <Badge variant="gold" size="md">
              <Sparkles className="w-3.5 h-3.5" />
              Live Auction Engine
            </Badge>
            <Badge variant="success" size="md">
              Socket.IO Real-Time
            </Badge>
          </div>

          <h1 className="text-3xl sm:text-6xl font-black text-white tracking-tight leading-[1.1]">
            Build Your Ultimate Football Dream Team
          </h1>

          <p className="text-slate-300 text-sm sm:text-lg leading-relaxed">
            Compete live against managers in real-time drafts. Place dynamic bids, manage your purse,
            and outwit opponents under the ticking hammer countdown.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            {user ? (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setIsCreateOpen(true)}
                  className="shadow-xl shadow-emerald-500/20"
                >
                  <PlusCircle className="w-5 h-5 mr-2" />
                  Create Auction Room
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => setIsJoinOpen(true)}
                  className="bg-arena-800/80"
                >
                  <LogIn className="w-5 h-5 mr-2 text-emerald-400" />
                  Join with Code
                </Button>
              </>
            ) : (
              <>
                <Link href="/register">
                  <Button variant="primary" size="lg">
                    <span>Get Started Free</span>
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="secondary" size="lg">
                    Sign In
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card variant="glass" className="p-6 space-y-3 relative overflow-hidden group">
          <div className="w-12 h-12 rounded-2xl bg-pitch-900/80 border border-pitch-700/60 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
            <Timer className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Authoritative Hammer Timer</h3>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            The timer starts <strong>only after the first valid bid</strong> and resets to full duration on every higher bid. No fixed time-outs.
          </p>
        </Card>

        <Card variant="glass" className="p-6 space-y-3 relative overflow-hidden group">
          <div className="w-12 h-12 rounded-2xl bg-amber-950/80 border border-amber-700/60 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
            <Zap className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Instant Realtime Bids</h3>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Sub-millisecond bid serialization with duplicate prevention, instant purse verification, and live presence across all managers.
          </p>
        </Card>

        <Card variant="glass" className="p-6 space-y-3 relative overflow-hidden group">
          <div className="w-12 h-12 rounded-2xl bg-arena-800/80 border border-arena-700 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
            <Shield className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Atomic Transaction Ledger</h3>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            MongoDB ACID transactions guarantee your team budget, squad capacity, and player purchase records remain 100% consistent.
          </p>
        </Card>
      </div>

      {/* Quick Launch & Player Catalogue Banner */}
      <div className="rounded-2xl bg-arena-900/60 border border-arena-800 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-arena-800 flex items-center justify-center text-slate-300">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Explore Player Database</h3>
            <p className="text-xs text-slate-400">
              Browse world-class strikers, playmakers, defenders, and goalkeepers available for draft pools.
            </p>
          </div>
        </div>

        <Link href="/players">
          <Button variant="outline" size="md">
            <span>View Player Catalogue</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>

      {/* Modals */}
      <CreateRoomModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <JoinRoomModal isOpen={isJoinOpen} onClose={() => setIsJoinOpen(false)} />
    </div>
  );
}
