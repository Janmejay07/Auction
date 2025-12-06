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
  Check,
  AlertCircle,
  RefreshCw,
  Plus,
  ArrowRight,
  ArrowUpDown,
  SlidersHorizontal,
  X,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

interface SlotDefinition {
  id: string;
  name: string;
  category: 'FWD' | 'MID' | 'DEF' | 'GK';
}

interface FormationLayout {
  name: string;
  lines: SlotDefinition[][];
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
        { id: 'lm', name: 'LM', category: 'MID' },
        { id: 'cm1', name: 'CM', category: 'MID' },
        { id: 'cam', name: 'CAM', category: 'MID' },
        { id: 'cm2', name: 'CM', category: 'MID' },
        { id: 'rm', name: 'RM', category: 'MID' },
      ],
      [
        { id: 'cb1', name: 'CB', category: 'DEF' },
        { id: 'cb2', name: 'CB', category: 'DEF' },
        { id: 'cb3', name: 'CB', category: 'DEF' },
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
        { id: 'cm1', name: 'CM', category: 'MID' },
        { id: 'cm2', name: 'CM', category: 'MID' },
        { id: 'rm', name: 'RM', category: 'MID' },
      ],
      [
        { id: 'cb1', name: 'CB', category: 'DEF' },
        { id: 'cb2', name: 'CB', category: 'DEF' },
        { id: 'cb3', name: 'CB', category: 'DEF' },
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
};

const POSITION_COMPATIBILITY: Record<string, string[]> = {
  GK: ['GK'],
  DEF: ['DEF', 'LB', 'CB', 'RB', 'LWB', 'RWB'],
  MID: ['MID', 'CM', 'CDM', 'CAM', 'LM', 'RM'],
  FWD: ['FWD', 'ST', 'CF', 'LW', 'RW'],
};

export default function FinalSquadPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = String(params?.roomCode || '').toUpperCase();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { socket } = useSocket();

  const [isLoading, setIsLoading] = useState(true);
  const [managerData, setManagerData] = useState<any | null>(null);
  const [allManagers, setAllManagers] = useState<any[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [roomDetails, setRoomDetails] = useState<any | null>(null);

  // Lineup interaction state
  const [activeSlotForSelection, setActiveSlotForSelection] = useState<SlotDefinition | null>(null);
  const [activeReserveForPlacement, setActiveReserveForPlacement] = useState<SquadPlayer | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchSquadData = useCallback(async () => {
    if (!roomCode) return;
    try {
      setIsLoading(true);

      const [roomRes, allSquadsRes] = await Promise.all([
        api.get(`/rooms/${roomCode}`),
        api.get(`/rooms/${roomCode}/squads`).catch(() => ({ data: { data: { participants: [] } } })),
      ]);

      const roomObj = roomRes.data?.data?.room || roomRes.data?.data;
      setRoomDetails(roomObj);

      const participantsList = allSquadsRes.data?.data?.participants || [];
      setAllManagers(participantsList);

      let squadRes;
      if (selectedManagerId) {
        squadRes = await api.get(`/rooms/${roomCode}/managers/${selectedManagerId}/squad`);
      } else {
        squadRes = await api.get(`/rooms/${roomCode}/my-squad`);
      }

      const sData = squadRes.data?.data;
      setManagerData(sData);
      if (!selectedManagerId && sData?.participant?._id) {
        setSelectedManagerId(sData.participant._id);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [roomCode, selectedManagerId]);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push(`/login?redirect=/rooms/${roomCode}/squad`);
      return;
    }
    if (user && roomCode) {
      fetchSquadData();
    }
  }, [user, isAuthLoading, roomCode, router, fetchSquadData]);

  // Socket listener for real-time squad changes
  useEffect(() => {
    if (!socket) return;
    const onSquadUpdated = (data: { participantId: string; squadState: any }) => {
      if (selectedManagerId === data.participantId || (!selectedManagerId && data.squadState?.participant?._id === selectedManagerId)) {
        setManagerData(data.squadState);
      }
    };
    socket.on('squad:updated', onSquadUpdated);
    return () => {
      socket.off('squad:updated', onSquadUpdated);
    };
  }, [socket, selectedManagerId]);

  const handleSelectManager = (mId: string) => {
    setSelectedManagerId(mId);
    setActiveSlotForSelection(null);
    setActiveReserveForPlacement(null);
  };

  const currentFormation = managerData?.formation || '4-3-3';
  const formationLayout = FORMATIONS[currentFormation] || FORMATIONS['4-3-3'];
  const startingXI: SquadPlayer[] = managerData?.startingXI || [];
  const reserves: SquadPlayer[] = managerData?.reserves || [];
  const participantId = managerData?.participant?._id;
  const isMySquad = Boolean(user && managerData?.participant?.userId === user.id);

  // All flat slots in current formation
  const allSlots = useMemo(() => {
    return formationLayout.lines.flatMap((line) => line);
  }, [formationLayout]);

  // Map startingXI to pitch slots
  const mappedSlots = useMemo(() => {
    const map: Record<string, SquadPlayer> = {};
    const unplaced: SquadPlayer[] = [];

    startingXI.forEach((sp) => {
      if (sp.pitchPosition) {
        map[sp.pitchPosition.toLowerCase()] = sp;
      } else {
        unplaced.push(sp);
      }
    });

    // Auto-map unplaced players into empty matching slots
    let unplacedIdx = 0;
    allSlots.forEach((slot) => {
      if (!map[slot.id.toLowerCase()] && unplacedIdx < unplaced.length) {
        map[slot.id.toLowerCase()] = unplaced[unplacedIdx];
        unplacedIdx++;
      }
    });

    return map;
  }, [startingXI, allSlots]);

  // Position compatibility checker
  const isPlayerEligibleForSlot = (playerPos: string | undefined, slotCategory: 'FWD' | 'MID' | 'DEF' | 'GK') => {
    if (!playerPos) return false;
    if (slotCategory === 'GK') return playerPos === 'GK';
    if (playerPos === 'GK') return false;

    const validPositions = POSITION_COMPATIBILITY[slotCategory] || [];
    return validPositions.includes(playerPos) || (slotCategory as string) === playerPos;
  };

  // Move player to a specific slot on pitch
  const handleAssignPlayerToSlot = async (squadPlayerId: string, slotId: string) => {
    if (!participantId || !isMySquad || isUpdating) return;
    try {
      setIsUpdating(true);
      const res = await api.patch(
        `/rooms/${roomCode}/managers/${participantId}/players/${squadPlayerId}/status`,
        {
          status: 'STARTING_XI',
          pitchPosition: slotId.toLowerCase(),
        },
      );
      if (res.data?.data?.squadState) {
        setManagerData(res.data.data.squadState);
      }
      setActiveSlotForSelection(null);
      setActiveReserveForPlacement(null);
      toast.success(`Player placed into ${slotId.toUpperCase()}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsUpdating(false);
    }
  };

  // Move a starting XI player back to reserves
  const handleMoveToReserve = async (squadPlayerId: string) => {
    if (!participantId || !isMySquad || isUpdating) return;
    try {
      setIsUpdating(true);
      const res = await api.patch(
        `/rooms/${roomCode}/managers/${participantId}/players/${squadPlayerId}/status`,
        {
          status: 'RESERVE',
          pitchPosition: null,
        },
      );
      if (res.data?.data?.squadState) {
        setManagerData(res.data.data.squadState);
      }
      toast.success('Player moved to reserves');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsUpdating(false);
    }
  };

  // Change Formation
  const handleChangeFormation = async (newFormation: string) => {
    if (!participantId || !isMySquad || isUpdating || newFormation === currentFormation) return;
    try {
      setIsUpdating(true);
      const res = await api.patch(
        `/rooms/${roomCode}/managers/${participantId}/formation`,
        {
          formation: newFormation,
        },
      );
      if (res.data?.data) {
        setManagerData(res.data.data);
      }
      toast.success(`Formation updated to ${newFormation}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading || isAuthLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-sm font-semibold text-slate-400">Loading auction squad...</p>
        </div>
      </div>
    );
  }

  if (!managerData) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">Squad Not Found</h2>
          <p className="text-xs text-slate-400">Could not retrieve squad details for {roomCode}.</p>
          <Button onClick={() => router.push(`/rooms/${roomCode}`)} variant="primary">
            Return to Room
          </Button>
        </div>
      </div>
    );
  }

  // Filter reserve players compatible with the currently clicked pitch slot
  const eligibleReservePlayers = activeSlotForSelection
    ? reserves.filter((sp) => {
        const p: Player | undefined = typeof sp.playerId === 'object' ? sp.playerId : undefined;
        return isPlayerEligibleForSlot(p?.position, activeSlotForSelection.category);
      })
    : [];

  // Filter slots compatible with the currently clicked reserve player
  const eligibleSlotsForReserve = activeReserveForPlacement
    ? allSlots.filter((slot) => {
        const p: Player | undefined =
          typeof activeReserveForPlacement.playerId === 'object'
            ? activeReserveForPlacement.playerId
            : undefined;
        return isPlayerEligibleForSlot(p?.position, slot.category);
      })
    : [];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fade-in">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-arena-900/80 border border-arena-800">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/rooms/${roomCode}`)}
            className="text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Room
          </Button>
          <div className="h-4 w-px bg-arena-800" />
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="text-sm font-extrabold text-white uppercase tracking-wider">
              Starting XI & Squad Manager
            </span>
          </div>
          <Badge variant="gold" size="sm">
            {roomCode}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {roomDetails?.status === 'COMPLETED' ? (
            <Badge variant="success" size="md">
              <Check className="w-3.5 h-3.5 mr-1" />
              AUCTION COMPLETED
            </Badge>
          ) : (
            <Badge variant="warning" size="md">
              LIVE AUCTION
            </Badge>
          )}
        </div>
      </div>

      {/* Manager Selector Switcher */}
      {allManagers.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-2 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-emerald-400" />
            Managers:
          </span>
          {allManagers.map((m) => {
            const isSelected = m._id === selectedManagerId;
            const isMe = user && m.userId === user.id;
            return (
              <button
                key={m._id}
                onClick={() => handleSelectManager(m._id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border ${
                  isSelected
                    ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-md shadow-emerald-500/10'
                    : 'bg-arena-950/60 border-arena-800 text-slate-400 hover:text-slate-200 hover:border-arena-700'
                }`}
              >
                <span>{m.teamName}</span>
                {isMe && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/30 text-[10px] text-emerald-200 uppercase font-black">
                    YOU
                  </span>
                )}
                <span className="text-[10px] font-mono text-slate-500">
                  ({m.squad?.length || m.squadCount || 0}/11)
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Squad Hero Summary + Formation Selector */}
      <Card variant="pitch" className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-arena-950 border border-arena-700 flex items-center justify-center text-emerald-400 text-2xl font-black shadow-inner">
              {managerData.manager?.name?.charAt(0) || 'M'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white">{managerData.manager?.teamName}</h1>
                {isMySquad ? (
                  <Badge variant="success" size="sm">
                    YOUR SQUAD (EDITABLE)
                  </Badge>
                ) : (
                  <Badge variant="outline" size="sm">
                    READ ONLY
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span>Room Code: <strong className="text-slate-200">{roomCode}</strong></span>
                <span>•</span>
                <span>Saved Formation: <strong className="text-emerald-400">{currentFormation}</strong></span>
              </p>
            </div>
          </div>

          {/* Formation Picker (Only for own squad) */}
          {isMySquad && (
            <div className="flex items-center gap-2 bg-arena-950/80 p-2.5 rounded-2xl border border-arena-800">
              <SlidersHorizontal className="w-4 h-4 text-emerald-400 ml-1" />
              <span className="text-xs font-bold text-slate-400 uppercase">Formation:</span>
              <div className="flex flex-wrap gap-1">
                {Object.keys(FORMATIONS).map((form) => (
                  <button
                    key={form}
                    onClick={() => handleChangeFormation(form)}
                    disabled={isUpdating}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                      currentFormation === form
                        ? 'bg-emerald-500 text-arena-950 shadow-md shadow-emerald-500/20'
                        : 'bg-arena-900 text-slate-400 hover:text-white hover:bg-arena-800'
                    }`}
                  >
                    {form}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 bg-arena-950/80 p-4 rounded-2xl border border-arena-800">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Starting XI</span>
              <span className="text-base font-black text-emerald-400 font-mono">
                {startingXI.length} / 11
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Reserves</span>
              <span className="text-base font-black text-amber-400 font-mono">
                {reserves.length} Players
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Spent</span>
              <span className="text-base font-black text-amber-400 font-mono">
                {formatCurrency(managerData.totalSpent || 0)}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Purse Left</span>
              <span className="text-base font-black text-emerald-400 font-mono">
                {formatCurrency(managerData.purseRemaining || 0)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Pitch and Reserves Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Football Pitch */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-bold text-slate-100">Tactical Starting XI Pitch</h3>
            </div>
            <div className="text-xs text-slate-400">
              Click any <strong className="text-emerald-400">+ Add</strong> slot or reserve player to assign
            </div>
          </div>

          {/* Tactical Pitch Canvas */}
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-pitch-900 via-pitch-800 to-pitch-950 border-2 border-pitch-600/60 p-6 sm:p-8 min-h-[580px] shadow-2xl flex flex-col justify-between">
            {/* Pitch Markings Overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-20">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 border-2 border-white rounded-b-xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 border-2 border-white rounded-full" />
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-24 border-2 border-white rounded-t-xl" />
            </div>

            {/* Formation Lines Container */}
            <div className="relative z-10 flex flex-col justify-between h-full space-y-8 my-auto">
              {formationLayout.lines.map((line, lineIdx) => (
                <div key={lineIdx} className="flex justify-around items-center gap-2">
                  {line.map((slot) => {
                    const assignedPlayer = mappedSlots[slot.id.toLowerCase()];
                    const rawPlayer: Player | undefined =
                      typeof assignedPlayer?.playerId === 'object'
                        ? assignedPlayer.playerId
                        : undefined;

                    return (
                      <div
                        key={slot.id}
                        className="flex flex-col items-center group transition-all duration-200"
                      >
                        {assignedPlayer && rawPlayer ? (
                          /* Occupied Slot */
                          <div className="flex flex-col items-center text-center relative">
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-arena-950/90 border-2 border-emerald-400 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center relative">
                              <div className="w-full h-full rounded-full bg-arena-900 flex items-center justify-center text-slate-100 font-extrabold text-sm sm:text-base">
                                {rawPlayer.name?.charAt(0) || 'P'}
                              </div>
                              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-pitch-900 border border-emerald-500 text-[9px] font-black text-emerald-300">
                                {slot.name}
                              </span>
                            </div>

                            <div className="mt-1.5 px-2 py-0.5 rounded-lg bg-arena-950/90 border border-arena-800 max-w-[100px] sm:max-w-[120px] text-center shadow">
                              <span className="text-[11px] font-black text-white truncate block">
                                {rawPlayer.name}
                              </span>
                              <div className="flex items-center justify-center gap-1 text-[9px] text-emerald-400 font-mono font-bold">
                                {formatCurrency(assignedPlayer.purchasePrice)}
                              </div>
                            </div>

                            {/* Move to Reserve / Replace Action */}
                            {isMySquad && (
                              <div className="flex items-center gap-1 mt-1">
                                <button
                                  onClick={() => handleMoveToReserve(assignedPlayer._id)}
                                  disabled={isUpdating}
                                  title="Move to Reserves"
                                  className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 text-[9px] font-bold border border-rose-500/40 transition-colors"
                                >
                                  Bench
                                </button>
                                <button
                                  onClick={() => setActiveSlotForSelection(slot)}
                                  disabled={isUpdating}
                                  title="Replace with another player"
                                  className="px-2 py-0.5 rounded bg-arena-800 hover:bg-arena-700 text-slate-300 text-[9px] font-bold border border-arena-700 transition-colors"
                                >
                                  Swap
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Empty Slot */
                          <div className="flex flex-col items-center">
                            {isMySquad ? (
                              <button
                                onClick={() => setActiveSlotForSelection(slot)}
                                disabled={isUpdating}
                                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-pitch-400/70 hover:border-emerald-400 hover:bg-emerald-500/20 bg-pitch-950/50 flex flex-col items-center justify-center text-emerald-300 transition-all group shadow-md"
                              >
                                <Plus className="w-4 h-4 group-hover:scale-125 transition-transform text-emerald-400" />
                                <span className="text-[9px] font-black uppercase text-emerald-200">
                                  {slot.name}
                                </span>
                              </button>
                            ) : (
                              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-pitch-600/40 bg-pitch-950/30 flex flex-col items-center justify-center text-pitch-400 opacity-60">
                                <span className="text-[10px] font-black uppercase">{slot.name}</span>
                              </div>
                            )}
                            <span className="text-[10px] text-pitch-300 mt-1 font-semibold">
                              {slot.name}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Reserves Bench */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-bold text-slate-100">Reserves Bench</h3>
            </div>
            <Badge variant="outline" size="sm">
              {reserves.length} Available
            </Badge>
          </div>

          <Card variant="glass" className="space-y-3 p-4 max-h-[620px] overflow-y-auto scrollbar-thin">
            {reserves.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                No reserve players.
                {startingXI.length > 0 && <p className="mt-1 text-slate-400">All purchased players are in Starting XI!</p>}
              </div>
            ) : (
              reserves.map((sp) => {
                const p: Player | undefined =
                  typeof sp.playerId === 'object' ? sp.playerId : undefined;
                const posBadge = getPositionBadge(p?.position || 'MID');

                return (
                  <div
                    key={sp._id}
                    className="p-3.5 rounded-2xl bg-arena-950/80 border border-arena-800 flex flex-col gap-2 hover:border-arena-700 transition-colors shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-arena-900 border border-arena-700 flex items-center justify-center font-bold text-slate-200 text-sm shrink-0">
                          {p?.name?.charAt(0) || 'P'}
                        </div>
                        <div className="truncate">
                          <h5 className="text-xs font-bold text-slate-100 truncate">
                            {p?.name || 'Player'}
                          </h5>
                          <p className="text-[10px] text-slate-400 truncate">
                            {p?.club || 'Club'} • OVR {p?.rating || p?.overallRating || 75}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold block mb-1 ${posBadge.bg} ${posBadge.color}`}>
                          {p?.position || 'MID'}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-amber-400">
                          {formatCurrency(sp.purchasePrice)}
                        </span>
                      </div>
                    </div>

                    {/* Action: Add to Starting XI */}
                    {isMySquad && (
                      <div className="pt-2 border-t border-arena-800/80 flex items-center justify-end gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={isUpdating}
                          onClick={() => setActiveReserveForPlacement(sp)}
                          className="text-xs py-1 h-7 font-bold"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Place on Pitch
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </Card>
        </div>
      </div>

      {/* Modal 1: Select Player for a Pitch Slot */}
      {activeSlotForSelection && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-arena-950 border border-arena-800 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-arena-800">
              <div>
                <h3 className="text-lg font-black text-white">
                  Select Player for <span className="text-emerald-400">{activeSlotForSelection.name}</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Required category: <strong className="text-slate-200">{activeSlotForSelection.category}</strong>
                </p>
              </div>
              <button
                onClick={() => setActiveSlotForSelection(null)}
                className="w-8 h-8 rounded-full bg-arena-900 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[360px] overflow-y-auto scrollbar-thin">
              {eligibleReservePlayers.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-amber-400/60" />
                  No compatible reserve players for position {activeSlotForSelection.name}.
                  <p className="text-[11px] text-slate-500 mt-1">
                    Acquire more {activeSlotForSelection.category} players or move an existing player to bench.
                  </p>
                </div>
              ) : (
                eligibleReservePlayers.map((sp) => {
                  const p: Player | undefined = typeof sp.playerId === 'object' ? sp.playerId : undefined;
                  const posBadge = getPositionBadge(p?.position || 'MID');

                  return (
                    <div
                      key={sp._id}
                      onClick={() => handleAssignPlayerToSlot(sp._id, activeSlotForSelection.id)}
                      className="p-3 rounded-2xl bg-arena-900/80 border border-arena-800 hover:border-emerald-500/60 flex items-center justify-between gap-3 cursor-pointer transition-all hover:scale-[1.01]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-arena-950 border border-arena-700 flex items-center justify-center font-bold text-slate-200 text-sm shrink-0">
                          {p?.name?.charAt(0) || 'P'}
                        </div>
                        <div className="truncate">
                          <h4 className="text-xs font-bold text-slate-100 truncate">{p?.name}</h4>
                          <p className="text-[10px] text-slate-400">
                            {p?.club} • OVR {p?.rating || p?.overallRating || 75}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${posBadge.bg} ${posBadge.color}`}>
                          {p?.position}
                        </span>
                        <Button variant="primary" size="sm" className="text-xs py-1 h-7">
                          Select
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="secondary" onClick={() => setActiveSlotForSelection(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Select Pitch Slot for a Reserve Player */}
      {activeReserveForPlacement && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-arena-950 border border-arena-800 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-arena-800">
              <div>
                <h3 className="text-lg font-black text-white">Choose Pitch Position</h3>
                <p className="text-xs text-slate-400">
                  Assigning:{' '}
                  <strong className="text-emerald-400">
                    {typeof activeReserveForPlacement.playerId === 'object'
                      ? (activeReserveForPlacement.playerId as Player).name
                      : 'Player'}
                  </strong>{' '}
                  ({typeof activeReserveForPlacement.playerId === 'object'
                    ? (activeReserveForPlacement.playerId as Player).position
                    : 'MID'})
                </p>
              </div>
              <button
                onClick={() => setActiveReserveForPlacement(null)}
                className="w-8 h-8 rounded-full bg-arena-900 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[360px] overflow-y-auto scrollbar-thin">
              {eligibleSlotsForReserve.map((slot) => {
                const currentOccupant = mappedSlots[slot.id.toLowerCase()];
                const occupantPlayer: Player | undefined =
                  typeof currentOccupant?.playerId === 'object' ? currentOccupant.playerId : undefined;

                return (
                  <button
                    key={slot.id}
                    onClick={() => handleAssignPlayerToSlot(activeReserveForPlacement._id, slot.id)}
                    className="p-3.5 rounded-2xl bg-arena-900/80 border border-arena-800 hover:border-emerald-500 text-left transition-all hover:scale-[1.02] flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-emerald-400">{slot.name}</span>
                      <span className="text-[10px] uppercase font-bold text-slate-500">
                        {slot.category}
                      </span>
                    </div>

                    <div className="text-[11px] truncate">
                      {occupantPlayer ? (
                        <span className="text-amber-400 text-[10px] block truncate">
                          Replaces {occupantPlayer.name}
                        </span>
                      ) : (
                        <span className="text-emerald-400 text-[10px] font-semibold block">
                          Empty Slot (Place Here)
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="secondary" onClick={() => setActiveReserveForPlacement(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
