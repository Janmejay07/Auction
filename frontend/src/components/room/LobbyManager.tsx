'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api, getErrorMessage } from '@/lib/api';
import type { AuctionRoom, Participant, Player, RoomPlayer } from '@/types';
import { formatCurrency, getPositionBadge } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import staticPlayersData from '@/data/players.json';
import {
  Copy,
  Check,
  Users,
  Play,
  Plus,
  Trash2,
  Shield,
  Clock,
  Sparkles,
  LogOut,
  AlertTriangle,
  Search,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/context/SocketContext';
import { LeaveConfirmationModal } from './LeaveConfirmationModal';

interface LobbyManagerProps {
  room: AuctionRoom;
  participants: Participant[];
  currentUserId?: string;
  onAuctionStarted: () => void;
  onRefresh: () => void;
}

export function LobbyManager({
  room,
  participants,
  currentUserId,
  onAuctionStarted,
  onRefresh,
}: LobbyManagerProps) {
  const router = useRouter();
  const { leaveRoom: socketLeaveRoom, setReady: socketSetReady } = useSocket();
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isTogglingReady, setIsTogglingReady] = useState(false);

  // Filter active participants
  const activeParticipants = useMemo(
    () => participants.filter((p) => p.status === 'ACTIVE'),
    [participants]
  );

  const myParticipant = useMemo(
    () => activeParticipants.find((p) => p.userId === currentUserId),
    [activeParticipants, currentUserId]
  );

  const isCreator =
    currentUserId === room.creatorUserId ||
    Boolean(activeParticipants.find((p) => p.userId === currentUserId && p.isCreator));

  const readyCount = useMemo(
    () => activeParticipants.filter((p) => Boolean(p.isReady || p.isCreator)).length,
    [activeParticipants]
  );

  // Player pool management state
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayer[]>([]);
  const [isAddPlayerModalOpen, setIsAddPlayerModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [clubFilter, setClubFilter] = useState('ALL');
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(room.roomCode);
    setCopied(true);
    toast.success('Room code copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const clubs = useMemo(() => {
    const set = new Set<string>();
    (staticPlayersData as Player[]).forEach((p) => {
      if (p.club) set.add(p.club);
    });
    return Array.from(set).sort();
  }, []);

  const filteredCatalogue = useMemo(() => {
    return (staticPlayersData as Player[]).filter((player) => {
      const matchesSearch =
        player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (player.fullName && player.fullName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        player.club.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPos = positionFilter === 'ALL' || player.position === positionFilter;
      const matchesClub = clubFilter === 'ALL' || player.club === clubFilter;
      return matchesSearch && matchesPos && matchesClub;
    });
  }, [searchTerm, positionFilter, clubFilter]);

  const handleStartAuction = async () => {
    if (activeParticipants.length < 2) {
      toast.error('At least 2 active participants are required to start the auction');
      return;
    }

    try {
      setIsStarting(true);
      await api.post(`/rooms/${room.roomCode}/start`);
      await api.post(`/rooms/${room.roomCode}/auction/start`);
      toast.success('Auction has officially started!');
      onAuctionStarted();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsStarting(false);
    }
  };

  const handleToggleReady = async () => {
    if (!myParticipant) return;
    try {
      setIsTogglingReady(true);
      const nextState = !myParticipant.isReady;
      await api.post(`/rooms/${room.roomCode}/ready`, { isReady: nextState });
      await socketSetReady(room.roomCode, nextState);
      toast.success(nextState ? "You're marked as READY!" : 'Ready status cancelled');
      onRefresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsTogglingReady(false);
    }
  };

  const handleConfirmLeave = async () => {
    try {
      setIsLeaving(true);
      await api.post(`/rooms/${room.roomCode}/leave`);
      await socketLeaveRoom(room.roomCode);
      toast.info('You have left the auction room');
      setIsLeaveModalOpen(false);
      router.push('/');
    } catch (error) {
      toast.error(getErrorMessage(error));
      setIsLeaving(false);
    }
  };

  const handleAddPlayer = async (player: Player) => {
    try {
      setIsAddingPlayer(true);
      // If player doesn't have an _id, use its externalId or fallback
      const playerId = player._id || String(player.externalId || player.name);

      await api.post(`/rooms/${room.roomCode}/players`, {
        playerId: playerId,
        auctionOrder: roomPlayers.length + 1,
        basePrice: player.basePrice || 1000000,
      });

      toast.success(`${player.name} added to draft pool!`);
      onRefresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsAddingPlayer(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <Card variant="pitch" className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="warning" size="sm">
                Waiting Lobby
              </Badge>
              <span className="text-xs text-slate-400">
                Created on {new Date(room.createdAt).toLocaleDateString()}
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Auction Room Lobby
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Assemble your managers and player draft pool before going live.
            </p>
          </div>

          {/* Room Code Badge / Copy */}
          <div className="flex items-center gap-2 bg-arena-950/80 border border-arena-700/80 p-2.5 rounded-2xl">
            <div className="px-3 text-left">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Room Code</span>
              <span className="text-xl font-black tracking-widest text-emerald-400 font-mono">
                {room.roomCode}
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={copyRoomCode}
              className="h-10 px-3"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Grid: Participants & Room Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Participants Section */}
        <div className="lg:col-span-7 space-y-4">
          <Card variant="glass" className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-arena-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-slate-100">Joined Managers</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                  {readyCount} / {activeParticipants.length} Ready
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-arena-800 text-slate-300">
                  {activeParticipants.length} / 10 Active
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              {activeParticipants.map((p, index) => {
                const isMe = currentUserId && p.userId === currentUserId;
                const isUserReady = Boolean(p.isReady || p.isCreator);

                return (
                  <div
                    key={p._id}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                      isMe
                        ? 'bg-gradient-to-r from-pitch-900/40 to-arena-900 border-emerald-500/50'
                        : 'bg-arena-900/70 border-arena-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-arena-800 border border-arena-700 flex items-center justify-center font-bold text-xs text-slate-200">
                        {index + 1}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-100 truncate">
                            {p.teamName}
                          </span>
                          {p.isCreator && (
                            <Badge variant="gold" size="sm">
                              Creator / Host
                            </Badge>
                          )}
                          {isMe && (
                            <Badge variant="success" size="sm">
                              You
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Purse: {formatCurrency(p.purse)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isUserReady ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span>READY</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 text-xs font-semibold">
                          <div className="w-2 h-2 rounded-full bg-slate-500" />
                          <span>NOT READY</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {activeParticipants.length < 2 && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Waiting for at least <strong>2 managers</strong> to join before the auction can begin.
                  Share the code <strong>{room.roomCode}</strong> with your friends.
                </span>
              </div>
            )}
          </Card>
        </div>

        {/* Room Settings & Host Actions */}
        <div className="lg:col-span-5 space-y-4">
          <Card variant="glass" className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-arena-800">
              <Shield className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-bold text-slate-100">Auction Rules</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-arena-900/80 border border-arena-800">
                <span className="text-slate-400">Initial Team Purse:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {formatCurrency(room.settings?.purseTotal)}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-arena-900/80 border border-arena-800">
                <span className="text-slate-400">Min Bid Increment:</span>
                <span className="font-bold text-slate-200 font-mono">
                  {formatCurrency(room.settings?.bidIncrement)}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-arena-900/80 border border-arena-800">
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Hammer Countdown:
                </span>
                <span className="font-bold text-slate-200">
                  {room.settings?.bidTimerSeconds || 15}s (resets on new bid)
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-arena-900/80 border border-arena-800">
                <span className="text-slate-400">Squad Size Limits:</span>
                <span className="font-bold text-slate-200">
                  5 – {room.settings?.squadLimit || 11} Players
                </span>
              </div>
            </div>

            {/* Host / Participant Action buttons */}
            <div className="pt-3 border-t border-arena-800 space-y-3">
              {isCreator ? (
                <>
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full text-base"
                    onClick={handleStartAuction}
                    isLoading={isStarting}
                    disabled={activeParticipants.length < 2}
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Auction Now
                  </Button>
                  <p className="text-[11px] text-center text-slate-500">
                    Once started, the draft pool will be locked and live bidding begins.
                  </p>
                </>
              ) : (
                <div className="space-y-3">
                  {myParticipant && (
                    <Button
                      variant={myParticipant.isReady ? 'secondary' : 'primary'}
                      size="lg"
                      className="w-full text-sm font-bold shadow-lg"
                      onClick={handleToggleReady}
                      isLoading={isTogglingReady}
                    >
                      {myParticipant.isReady ? (
                        <>
                          <Check className="w-4 h-4 mr-2 text-emerald-400" />
                          You are READY (Click to Cancel)
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2 text-amber-300" />
                          Click to READY UP
                        </>
                      )}
                    </Button>
                  )}

                  <div className="p-3.5 rounded-2xl bg-arena-950/80 border border-arena-800 text-center space-y-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mx-auto" />
                    <p className="text-xs font-bold text-slate-300">
                      Waiting for the Room Host to launch the auction...
                    </p>
                  </div>
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsLeaveModalOpen(true)}
                isLoading={isLeaving}
                className="w-full text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
              >
                <LogOut className="w-4 h-4 mr-1.5" />
                Leave Room
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <LeaveConfirmationModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        onConfirm={handleConfirmLeave}
        isLoading={isLeaving}
      />
    </div>
  );
}
