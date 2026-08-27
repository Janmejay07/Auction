'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import type { Player, SquadPlayer } from '@/types';
import { formatCurrency, getPositionBadge } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  ArrowLeft,
  Shield,
  Wallet,
  Users,
  Trophy,
  User,
  ArrowUpDown,
  ArrowRight,
  Sparkles,
  Check,
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';

interface SlotDefinition {
  id: string;
  name: string;
  category: 'FWD' | 'MID' | 'DEF' | 'GK';
}

interface FormationLayout {
  name: string;
  lines: SlotDefinition[][]; // From top (Attack) to bottom (Defense + GK)
}

const FORMATIONS: Record<string, FormationLayout> = {
  '4-3-3': {
    name: '4-3-3',
    lines: [
      [
        { id: 'lw', name: 'LW', category: 'FWD' },
        { id: 'st', name: 'ST', category: 'FWD' },
        { id: 'rw', name: 'RW', category: 'FWD' },
      ],
      [
        { id: 'lcm', name: 'LCM', category: 'MID' },
        { id: 'cm', name: 'CM', category: 'MID' },
        { id: 'rcm', name: 'RCM', category: 'MID' },
      ],
      [
        { id: 'lb', name: 'LB', category: 'DEF' },
        { id: 'lcb', name: 'CB', category: 'DEF' },
        { id: 'rcb', name: 'CB', category: 'DEF' },
        { id: 'rb', name: 'RB', category: 'DEF' },
      ],
      [{ id: 'gk', name: 'GK', category: 'GK' }],
    ],
  },
  '4-4-2': {
    name: '4-4-2',
    lines: [
      [
        { id: 'st1', name: 'ST', category: 'FWD' },
        { id: 'st2', name: 'ST', category: 'FWD' },
      ],
      [
        { id: 'lm', name: 'LM', category: 'MID' },
        { id: 'lcm', name: 'CM', category: 'MID' },
        { id: 'rcm', name: 'CM', category: 'MID' },
        { id: 'rm', name: 'RM', category: 'MID' },
      ],
      [
        { id: 'lb', name: 'LB', category: 'DEF' },
        { id: 'lcb', name: 'CB', category: 'DEF' },
        { id: 'rcb', name: 'CB', category: 'DEF' },
        { id: 'rb', name: 'RB', category: 'DEF' },
      ],
      [{ id: 'gk', name: 'GK', category: 'GK' }],
    ],
  },
  '4-2-3-1': {
    name: '4-2-3-1',
    lines: [
      [{ id: 'st', name: 'ST', category: 'FWD' }],
      [
        { id: 'lam', name: 'LAM', category: 'MID' },
        { id: 'cam', name: 'CAM', category: 'MID' },
        { id: 'ram', name: 'RAM', category: 'MID' },
      ],
      [
        { id: 'ldm', name: 'CDM', category: 'MID' },
        { id: 'rdm', name: 'CDM', category: 'MID' },
      ],
      [
        { id: 'lb', name: 'LB', category: 'DEF' },
        { id: 'lcb', name: 'CB', category: 'DEF' },
        { id: 'rcb', name: 'CB', category: 'DEF' },
        { id: 'rb', name: 'RB', category: 'DEF' },
      ],
      [{ id: 'gk', name: 'GK', category: 'GK' }],
    ],
  },
  '3-5-2': {
    name: '3-5-2',
    lines: [
      [
        { id: 'st1', name: 'ST', category: 'FWD' },
        { id: 'st2', name: 'ST', category: 'FWD' },
      ],
      [
        { id: 'lwb', name: 'LWB', category: 'MID' },
        { id: 'lcm', name: 'CM', category: 'MID' },
        { id: 'cm', name: 'CAM', category: 'MID' },
        { id: 'rcm', name: 'CM', category: 'MID' },
        { id: 'rwb', name: 'RWB', category: 'MID' },
      ],
      [
        { id: 'lcb', name: 'CB', category: 'DEF' },
        { id: 'cb', name: 'CB', category: 'DEF' },
        { id: 'rcb', name: 'CB', category: 'DEF' },
      ],
      [{ id: 'gk', name: 'GK', category: 'GK' }],
    ],
  },
  '3-4-3': {
    name: '3-4-3',
    lines: [
      [
        { id: 'lw', name: 'LW', category: 'FWD' },
        { id: 'st', name: 'ST', category: 'FWD' },
        { id: 'rw', name: 'RW', category: 'FWD' },
      ],
      [
        { id: 'lm', name: 'LM', category: 'MID' },
        { id: 'lcm', name: 'CM', category: 'MID' },
        { id: 'rcm', name: 'CM', category: 'MID' },
        { id: 'rm', name: 'RM', category: 'MID' },
      ],
      [
        { id: 'lcb', name: 'CB', category: 'DEF' },
        { id: 'cb', name: 'CB', category: 'DEF' },
        { id: 'rcb', name: 'CB', category: 'DEF' },
      ],
      [{ id: 'gk', name: 'GK', category: 'GK' }],
    ],
  },
  '4-3-1-2': {
    name: '4-3-1-2',
    lines: [
      [
        { id: 'st1', name: 'ST', category: 'FWD' },
        { id: 'st2', name: 'ST', category: 'FWD' },
      ],
      [{ id: 'cam', name: 'CAM', category: 'MID' }],
      [
        { id: 'lcm', name: 'CM', category: 'MID' },
        { id: 'cm', name: 'CM', category: 'MID' },
        { id: 'rcm', name: 'CM', category: 'MID' },
      ],
      [
        { id: 'lb', name: 'LB', category: 'DEF' },
        { id: 'lcb', name: 'CB', category: 'DEF' },
        { id: 'rcb', name: 'CB', category: 'DEF' },
        { id: 'rb', name: 'RB', category: 'DEF' },
      ],
      [{ id: 'gk', name: 'GK', category: 'GK' }],
    ],
  },
};

export default function ManagerSquadPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = String(params?.roomCode || '').toUpperCase();
  const managerId = String(params?.managerId || '');

  const { user } = useAuth();
  const { socket } = useSocket();

  const [isLoading, setIsLoading] = useState(true);
  const [participant, setParticipant] = useState<any>(null);
  const [formation, setFormation] = useState<string>('4-3-3');
  const [startingXI, setStartingXI] = useState<any[]>([]);
  const [reserves, setReserves] = useState<any[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedSwapStartingId, setSelectedSwapStartingId] = useState<string | null>(null);

  const isMe = user && participant && String(participant.userId) === String(user.id);

  // Fetch squad details
  const fetchSquad = useCallback(async () => {
    if (!roomCode || !managerId) return;
    try {
      setIsLoading(true);
      const res = await api.get(`/rooms/${roomCode}/managers/${managerId}/squad`);
      if (res.data?.success && res.data.data) {
        const d = res.data.data;
        setParticipant(d.participant);
        setFormation(d.formation || '4-3-3');
        setStartingXI(d.startingXI || []);
        setReserves(d.reserves || []);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [roomCode, managerId]);

  useEffect(() => {
    fetchSquad();
  }, [fetchSquad]);

  // Real-time socket sync
  useEffect(() => {
    if (!socket || !roomCode) return;

    const onSquadUpdated = (data: any) => {
      if (data.participantId === managerId && data.squadState) {
        setParticipant(data.squadState.participant);
        setFormation(data.squadState.formation || '4-3-3');
        setStartingXI(data.squadState.startingXI || []);
        setReserves(data.squadState.reserves || []);
      }
    };

    const onPlayerSold = () => {
      fetchSquad();
    };

    socket.on('squad:updated', onSquadUpdated);
    socket.on('player:sold', onPlayerSold);

    return () => {
      socket.off('squad:updated', onSquadUpdated);
      socket.off('player:sold', onPlayerSold);
    };
  }, [socket, roomCode, managerId, fetchSquad]);

  // Change Formation
  const handleFormationChange = async (newFormation: string) => {
    if (!isMe) return;
    try {
      setIsUpdating(true);
      setFormation(newFormation);
      const res = await api.patch(`/rooms/${roomCode}/managers/${managerId}/formation`, {
        formation: newFormation,
      });
      if (res.data?.success) {
        toast.success(`Formation updated to ${newFormation}`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
      fetchSquad();
    } finally {
      setIsUpdating(false);
    }
  };

  // Move player to STARTING_XI or RESERVE
  const handleStatusChange = async (squadPlayerId: string, status: 'STARTING_XI' | 'RESERVE') => {
    if (!isMe) return;
    if (status === 'STARTING_XI' && startingXI.length >= 11) {
      toast.error('Starting XI is full (11/11). Move a player to reserves first.');
      return;
    }
    try {
      setIsUpdating(true);
      const res = await api.patch(
        `/rooms/${roomCode}/managers/${managerId}/players/${squadPlayerId}/status`,
        { status },
      );
      if (res.data?.success) {
        toast.success(status === 'STARTING_XI' ? 'Moved to Starting XI' : 'Moved to Reserves');
        fetchSquad();
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsUpdating(false);
    }
  };

  // Direct Swap between Starting XI and Reserve
  const handleSwap = async (startingPlayerId: string, reservePlayerId: string) => {
    if (!isMe) return;
    try {
      setIsUpdating(true);
      const res = await api.post(`/rooms/${roomCode}/managers/${managerId}/swap`, {
        startingPlayerId,
        reservePlayerId,
      });
      if (res.data?.success) {
        toast.success('Players swapped successfully!');
        setSelectedSwapStartingId(null);
        fetchSquad();
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const currentLayout = FORMATIONS[formation] || FORMATIONS['4-3-3'];

  // Map starting XI players into slots by position category or sequentially
  const slotAssignments = useMemo(() => {
    const assignments = new Map<string, any>();
    const unassignedXI = [...startingXI];

    // 1. Assign GK
    const gkSlot = currentLayout.lines.flat().find((s) => s.category === 'GK');
    if (gkSlot) {
      const gkIndex = unassignedXI.findIndex((sp) => (sp.playerId?.position || sp.player?.position) === 'GK');
      if (gkIndex !== -1) {
        assignments.set(gkSlot.id, unassignedXI[gkIndex]);
        unassignedXI.splice(gkIndex, 1);
      }
    }

    // 2. Assign matching positions
    for (const line of currentLayout.lines) {
      for (const slot of line) {
        if (assignments.has(slot.id)) continue;
        const matchingIndex = unassignedXI.findIndex((sp) => {
          const pos = sp.playerId?.position || sp.player?.position;
          return pos === slot.category;
        });
        if (matchingIndex !== -1) {
          assignments.set(slot.id, unassignedXI[matchingIndex]);
          unassignedXI.splice(matchingIndex, 1);
        }
      }
    }

    // 3. Fill remaining slots with any leftover starting XI
    for (const line of currentLayout.lines) {
      for (const slot of line) {
        if (assignments.has(slot.id)) continue;
        if (unassignedXI.length > 0) {
          assignments.set(slot.id, unassignedXI.shift());
        }
      }
    }

    return assignments;
  }, [startingXI, currentLayout]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6 flex flex-col items-center justify-center min-h-[500px]">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 text-sm font-semibold">Loading manager squad & pitch tactics...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Navigation & Manager Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-arena-900/90 border border-arena-800 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/rooms/${roomCode}`)}
            className="flex items-center gap-2 text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Arena</span>
          </Button>

          <div className="h-8 w-px bg-arena-800 hidden sm:block" />

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-arena-800 border border-arena-700 flex items-center justify-center font-black text-lg text-emerald-400 shadow-md">
              {participant?.teamName?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white">{participant?.teamName}</h1>
                {isMe ? (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    YOUR SQUAD
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    VIEW ONLY
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                <span className="flex items-center gap-1 font-mono text-emerald-400 font-bold">
                  <Wallet className="w-3.5 h-3.5 text-slate-500" />
                  {formatCurrency(participant?.purseRemaining)} Remaining
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-slate-300">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  {startingXI.length + reserves.length} Total Players
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Formation Selector & Squad Count */}
        <div className="flex items-center gap-3 self-end sm:self-center">
          <div className="flex items-center gap-2 bg-arena-950/80 border border-arena-800 rounded-2xl px-3 py-1.5">
            <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Formation:
            </span>
            {isMe ? (
              <select
                value={formation}
                onChange={(e) => handleFormationChange(e.target.value)}
                disabled={isUpdating}
                className="bg-arena-900 border border-arena-700 text-emerald-400 text-xs font-bold font-mono rounded-xl px-2.5 py-1 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {Object.keys(FORMATIONS).map((f) => (
                  <option key={f} value={f} className="bg-arena-900 text-slate-100">
                    {f}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-mono font-bold text-emerald-400 text-xs px-2 py-1 bg-arena-900 rounded-lg">
                {formation}
              </span>
            )}
          </div>

          <div className="px-3.5 py-2 rounded-2xl bg-arena-950 border border-arena-800 text-xs font-mono font-bold">
            <span className="text-slate-400">XI: </span>
            <span className={startingXI.length === 11 ? 'text-emerald-400' : 'text-amber-400'}>
              {startingXI.length}/11
            </span>
          </div>
        </div>
      </div>

      {/* Main Pitch & Reserves Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Center Column: Visual Football Pitch */}
        <div className="lg:col-span-8 flex flex-col space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-extrabold text-slate-200 uppercase tracking-wider">
                Starting XI ({startingXI.length}/11)
              </h2>
            </div>
            {selectedSwapStartingId && (
              <span className="text-xs font-bold text-amber-400 animate-pulse">
                Click a reserve player to complete swap
              </span>
            )}
          </div>

          {/* Stadium Pitch Canvas */}
          <div className="relative w-full rounded-3xl overflow-hidden bg-gradient-to-b from-[#0f3d22] via-[#0d331c] to-[#092414] border-2 border-emerald-600/40 shadow-2xl p-4 sm:p-6 min-h-[580px] flex flex-col justify-between select-none">
            {/* Realistic pitch markings & grass stripes */}
            <div className="absolute inset-0 bg-[radial-gradient(#155724_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />
            <div className="absolute inset-x-6 top-0 bottom-0 border-x border-white/20 pointer-events-none" />
            
            {/* Center Circle & Halfway Line */}
            <div className="absolute top-1/2 left-6 right-6 h-px bg-white/30 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-white/30 pointer-events-none flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white/40" />
            </div>

            {/* Top Penalty Box */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 border-b border-x border-white/30 rounded-b-xl pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-10 border-b border-x border-white/30 rounded-b-lg pointer-events-none" />

            {/* Bottom Penalty Box (GK Area) */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-24 border-t border-x border-white/30 rounded-t-xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-10 border-t border-x border-white/30 rounded-t-lg pointer-events-none" />

            {/* Formation Lines (Forwards -> Midfield -> Defense -> GK) */}
            {currentLayout.lines.map((line, lineIdx) => (
              <div
                key={lineIdx}
                className="relative z-10 flex items-center justify-around w-full py-2"
              >
                {line.map((slot) => {
                  const assigned = slotAssignments.get(slot.id);
                  const playerObj: Player | null = assigned
                    ? assigned.playerId?.name
                      ? assigned.playerId
                      : assigned.player
                    : null;
                  const posBadge = playerObj?.position ? getPositionBadge(playerObj.position) : null;
                  const isSelectedForSwap = assigned && selectedSwapStartingId === assigned._id;

                  if (assigned && playerObj) {
                    return (
                      <div
                        key={slot.id}
                        className={`flex flex-col items-center transition-transform transform duration-200 ${
                          isSelectedForSwap ? 'scale-105' : 'hover:scale-105'
                        }`}
                      >
                        {/* Player On-Pitch Card */}
                        <div
                          className={`relative w-24 sm:w-28 rounded-2xl p-2.5 text-center border backdrop-blur-md shadow-lg transition-all ${
                            isSelectedForSwap
                              ? 'bg-amber-500/30 border-amber-400 ring-2 ring-amber-400'
                              : 'bg-arena-950/85 border-emerald-500/40 hover:border-emerald-400'
                          }`}
                        >
                          {/* Rating & Slot Badge */}
                          <div className="flex items-center justify-between text-[9px] font-bold mb-1">
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                              {slot.name}
                            </span>
                            {playerObj.rating && (
                              <span className="px-1 py-0.2 rounded bg-yellow-500/20 text-yellow-300 font-mono">
                                ★ {playerObj.rating}
                              </span>
                            )}
                          </div>

                          {/* Avatar */}
                          <div className="w-9 h-9 rounded-xl mx-auto bg-arena-800 border border-arena-700 overflow-hidden flex items-center justify-center mb-1 text-slate-300 shadow-inner">
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

                          <div className="font-extrabold text-[11px] text-white truncate max-w-[90px] mx-auto">
                            {playerObj.name}
                          </div>
                          <div className="text-[9px] text-slate-400 truncate">
                            {playerObj.club || formatCurrency(assigned.purchasePrice)}
                          </div>

                          {/* Action Button for Owner */}
                          {isMe && (
                            <div className="mt-1.5 flex items-center justify-center gap-1 pt-1 border-t border-arena-800">
                              <button
                                type="button"
                                onClick={() => handleStatusChange(assigned._id, 'RESERVE')}
                                disabled={isUpdating}
                                className="text-[9px] font-bold text-rose-400 hover:text-rose-300 transition-colors py-0.5 px-1 rounded hover:bg-rose-500/10"
                                title="Move to Reserve"
                              >
                                To Bench
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedSwapStartingId(
                                    isSelectedForSwap ? null : assigned._id,
                                  )
                                }
                                className={`text-[9px] font-bold px-1 rounded transition-colors ${
                                  isSelectedForSwap
                                    ? 'bg-amber-400 text-arena-950 font-black'
                                    : 'text-amber-400 hover:bg-amber-400/10'
                                }`}
                                title="Swap with Reserve"
                              >
                                Swap
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Empty Slot Marker
                  return (
                    <div
                      key={slot.id}
                      className="flex flex-col items-center group cursor-pointer"
                    >
                      <div className="w-20 sm:w-24 h-20 rounded-2xl border-2 border-dashed border-white/25 bg-arena-950/40 flex flex-col items-center justify-center p-2 text-center group-hover:border-emerald-400/60 group-hover:bg-emerald-500/10 transition-all">
                        <span className="text-xs font-black font-mono text-white/60 group-hover:text-emerald-300">
                          {slot.name}
                        </span>
                        <span className="text-[8px] font-bold text-white/40 uppercase mt-0.5">
                          {slot.category}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Reserves Bench */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-extrabold text-slate-200 uppercase tracking-wider">
                Reserves Bench ({reserves.length})
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-semibold font-mono">
              Available
            </span>
          </div>

          <Card variant="default" className="space-y-3 p-4 bg-arena-900/90 border-arena-800">
            {reserves.length === 0 ? (
              <div className="text-center py-8 px-4 text-slate-500 space-y-2">
                <Users className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs font-semibold">No reserve players on the bench.</p>
                <p className="text-[11px] text-slate-600">
                  Purchased auction players appear here and can be moved to the Starting XI.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
                {reserves.map((sp: any) => {
                  const playerObj: Player | null = sp.playerId?.name
                    ? sp.playerId
                    : sp.player || null;
                  const posBadge = playerObj?.position ? getPositionBadge(playerObj.position) : null;
                  const isXiFull = startingXI.length >= 11;

                  return (
                    <div
                      key={sp._id}
                      className="p-3 rounded-2xl bg-arena-950/80 border border-arena-800 hover:border-arena-700 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-arena-850 border border-arena-700 flex items-center justify-center font-bold text-xs text-slate-300 shrink-0 overflow-hidden">
                          {playerObj?.image ? (
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
                            <span className="font-bold text-xs text-slate-100 truncate block">
                              {playerObj?.name || 'Player'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            <span className="font-mono text-emerald-400">
                              {formatCurrency(sp.purchasePrice)}
                            </span>
                            {playerObj?.club && <span>• {playerObj.club}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      {isMe && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {selectedSwapStartingId ? (
                            <Button
                              variant="gold"
                              size="sm"
                              disabled={isUpdating}
                              onClick={() => handleSwap(selectedSwapStartingId, sp._id)}
                              className="text-[10px] px-2.5 py-1 font-bold"
                            >
                              Swap Here
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={isUpdating || isXiFull}
                              onClick={() => handleStatusChange(sp._id, 'STARTING_XI')}
                              className="text-[10px] px-2.5 py-1 font-bold whitespace-nowrap"
                            >
                              {isXiFull ? 'XI Full' : 'Move to XI'}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
