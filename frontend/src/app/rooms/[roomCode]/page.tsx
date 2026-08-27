'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import type {
  AuctionRoom,
  Participant,
  Auction,
  Player,
  Bid,
  RoomSyncData,
  AuctionPoolState,
} from '@/types';
import { LobbyManager } from '@/components/room/LobbyManager';
import { PlayerSpotlight } from '@/components/auction/PlayerSpotlight';
import { AuctionTimer } from '@/components/auction/AuctionTimer';
import { BiddingConsole } from '@/components/auction/BiddingConsole';
import { LiveBidFeed } from '@/components/auction/LiveBidFeed';
import { ParticipantsSquads } from '@/components/auction/ParticipantsSquads';
import { CompletedSummary } from '@/components/auction/CompletedSummary';
import { AuctionResultModal, type AuctionResultData } from '@/components/auction/AuctionResultModal';
import { RoundProgressIndicator } from '@/components/auction/RoundProgressIndicator';
import { LivePoolTracker } from '@/components/auction/LivePoolTracker';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { Radio, RefreshCw, AlertCircle, LogOut } from 'lucide-react';
import { LeaveConfirmationModal } from '@/components/room/LeaveConfirmationModal';

function normalizeParticipant(raw: any): Participant {
  return {
    ...raw,
    purse: raw.purseRemaining ?? raw.purse ?? 0,
    spent: raw.totalSpent ?? raw.spent ?? 0,
    isCreator: Boolean(raw.isCreator),
    isReady: Boolean(raw.isReady),
  };
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = String(params?.roomCode || '').toUpperCase();

  const { user, isLoading: isAuthLoading } = useAuth();
  const { socket, isConnected, joinRoom, leaveRoom: socketLeaveRoom, syncRoom } = useSocket();

  const [isLoading, setIsLoading] = useState(true);
  const [room, setRoom] = useState<AuctionRoom | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentAuction, setCurrentAuction] = useState<Auction | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [currentHighestBid, setCurrentHighestBid] = useState<number | null>(null);
  const [highestParticipant, setHighestParticipant] = useState<Participant | null>(null);
  const [timerEndsAt, setTimerEndsAt] = useState<string | null>(null);
  const [recentBids, setRecentBids] = useState<Bid[]>([]);
  const [auctionSequence, setAuctionSequence] = useState<number | null>(null);
  const [resultModalData, setResultModalData] = useState<AuctionResultData | null>(null);
  const [poolState, setPoolState] = useState<AuctionPoolState | null>(null);
  const [completionReason, setCompletionReason] = useState<string | null>(null);

  // Leave confirmation state
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Handle browser Back button interception
  useEffect(() => {
    if (!roomCode || isAuthLoading || !user) return;
    // Push dummy history entry so back triggers popstate
    window.history.pushState({ inRoom: true }, '', window.location.href);

    const handlePopState = () => {
      // Re-push history entry to keep user in room until confirmed
      window.history.pushState({ inRoom: true }, '', window.location.href);
      setIsLeaveModalOpen(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [roomCode, isAuthLoading, user]);

  const handleConfirmLeave = async () => {
    try {
      setIsLeaving(true);
      await api.post(`/rooms/${roomCode}/leave`);
      await socketLeaveRoom(roomCode);
      toast.info('You have left the auction room');
      setIsLeaveModalOpen(false);
      router.push('/');
    } catch (error) {
      toast.error(getErrorMessage(error));
      setIsLeaving(false);
    }
  };

  // Fetch initial room data from REST API
  const fetchRoomData = useCallback(async () => {
    if (!roomCode) return;
    try {
      const [roomRes, partRes] = await Promise.all([
        api.get(`/rooms/${roomCode}`),
        api.get(`/rooms/${roomCode}/participants`),
      ]);

      const roomData = roomRes.data?.data?.room || roomRes.data?.data;
      const partData = partRes.data?.data?.participants || partRes.data?.data || [];

      setRoom(roomData);
      setParticipants(partData.map(normalizeParticipant));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [roomCode]);

  // Request room sync from Socket.IO
  const performSocketSync = useCallback(async () => {
    if (!roomCode) return;
    const res = await syncRoom(roomCode);
    if (res.ok && res.data) {
      const sync = res.data as RoomSyncData;
      setRoom(sync.room);
      setParticipants(sync.participants.map(normalizeParticipant));
      setCurrentAuction(sync.currentAuction);
      setCurrentPlayer(sync.currentPlayer);
      setCurrentHighestBid(sync.currentHighestBid);
      setHighestParticipant(sync.highestParticipant);
      setTimerEndsAt(sync.timerEndsAt);
      setRecentBids(sync.recentBids || []);
      setAuctionSequence(sync.auctionSequence);
      if (sync.poolState) {
        setPoolState(sync.poolState);
      }

      if (sync.room?.status === 'LIVE' && (sync.currentAuction?.status === 'SOLD' || sync.currentAuction?.status === 'UNSOLD')) {
        const isSold = sync.currentAuction.status === 'SOLD';
        setResultModalData({
          type: isSold ? 'SOLD' : 'UNSOLD',
          player: sync.currentPlayer,
          winner: sync.highestParticipant,
          winnerName: sync.highestParticipant?.teamName,
          winningAmount: sync.currentAuction.winningAmount || sync.currentAuction.currentHighestBid || 0,
          displayDurationSeconds: 3,
        });
      }
    }
  }, [roomCode, syncRoom]);

  // Initial load effect
  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push(`/login?redirect=/rooms/${roomCode}`);
      return;
    }
    if (user && roomCode) {
      fetchRoomData();
    }
  }, [user, isAuthLoading, roomCode, router, fetchRoomData]);

  // Socket.IO joining & real-time event listeners
  useEffect(() => {
    if (!socket || !roomCode || !user || !isConnected) return;

    joinRoom(roomCode).then((res) => {
      if (res.ok) {
        performSocketSync();
      }
    });

    const onParticipantJoined = (data: { participant: Participant }) => {
      const participant = normalizeParticipant(data.participant);
      setParticipants((prev) => {
        const exists = prev.some((p) => p._id === participant._id);
        if (exists) return prev.map((p) => (p._id === participant._id ? participant : p));
        return [...prev, participant];
      });
      toast.info(`${participant.teamName} joined the room!`);
    };

    const onParticipantReady = (data: {
      participantId: string;
      userId: string;
      isReady: boolean;
      participant?: Participant;
    }) => {
      setParticipants((prev) =>
        prev.map((p) => {
          if (p._id === data.participantId || p.userId === data.userId) {
            return { ...p, isReady: data.isReady };
          }
          return p;
        })
      );
    };

    const onParticipantLeft = (data: {
      participantId: string;
      userId: string;
      teamName?: string;
    }) => {
      if (user && data.userId === user.id) {
        toast.info('You have left the room');
        router.push('/');
        return;
      }
      setParticipants((prev) =>
        prev
          .map((p) => {
            if (p._id === data.participantId || p.userId === data.userId) {
              return { ...p, status: 'INACTIVE' as const, isReady: false };
            }
            return p;
          })
          .filter((p) => p.status === 'ACTIVE')
      );
      toast.info(`${data.teamName || 'A manager'} left the room.`);
      void performSocketSync();
    };

    const onParticipantOnline = (data: { participant?: Participant; userId?: string }) => {
      if (data.participant) {
        const norm = normalizeParticipant(data.participant);
        setParticipants((prev) => {
          const exists = prev.some((p) => p._id === norm._id);
          if (exists) return prev.map((p) => (p._id === norm._id ? { ...norm, isOnline: true } : p));
          return [...prev, { ...norm, isOnline: true }];
        });
      } else if (data.userId) {
        setParticipants((prev) =>
          prev.map((p) => (p.userId === data.userId ? { ...p, isOnline: true } : p))
        );
      }
    };

    const onParticipantOffline = (data: { userId?: string }) => {
      if (data.userId) {
        setParticipants((prev) =>
          prev.map((p) => (p.userId === data.userId ? { ...p, isOnline: false } : p))
        );
      }
    };

    const onRoomCancelled = () => {
      toast.error('The room was cancelled because the host left.');
      router.push('/');
    };

    const onAuctionStarting = () => {
      toast.success('Auction starting! Preparing first player...');
      void performSocketSync();
    };

    const onAuctionStarted = () => {
      void performSocketSync();
    };

    const onPlayerLive = (data: {
      auction: Auction;
      player?: Player;
      sequence?: number;
      poolState?: AuctionPoolState;
    }) => {
      setResultModalData(null);
      if (!data.player) {
        void performSocketSync();
        return;
      }
      setCurrentAuction(data.auction);
      setCurrentPlayer(data.player);
      setCurrentHighestBid(data.auction.currentHighestBid ?? null);
      setHighestParticipant(null);
      setTimerEndsAt(data.auction.timerEndsAt || null);
      setRecentBids([]);
      setAuctionSequence(data.sequence ?? null);
      if (data.poolState) {
        setPoolState(data.poolState);
      }
      setRoom((prev) => (prev ? { ...prev, status: 'LIVE' } : prev));
      toast.info(`Now Live on Pitch: ${data.player?.name || 'Player'}`);
    };

    const onBidAccepted = (data: {
      auction: Auction;
      bid: Bid;
      participant?: Participant;
    }) => {
      setCurrentAuction(data.auction);
      setCurrentHighestBid(data.bid.amount);
      if (data.participant) {
        setHighestParticipant(normalizeParticipant(data.participant));
      }
      setTimerEndsAt(data.auction.timerEndsAt);
      setRecentBids((prev) => [...prev, data.bid]);
      toast.success(`New highest bid: ₹${(data.bid.amount / 100000).toFixed(1)} Lakh`);
    };

    const onPlayerSold = (data: {
      player: Player;
      winner?: Participant;
      winnerParticipantName?: string;
      winningAmount?: number;
      winningBid?: number;
      displayDurationSeconds?: number;
    }) => {
      const winnerName = data.winnerParticipantName || data.winner?.teamName || 'Winner';
      const amount = data.winningAmount || data.winningBid || 0;
      setResultModalData({
        type: 'SOLD',
        player: data.player,
        winner: data.winner,
        winnerName,
        winningAmount: amount,
        displayDurationSeconds: data.displayDurationSeconds || 3,
      });
      toast.success(`SOLD! ${data.player?.name || 'Player'} transferred to ${winnerName}!`);
      void performSocketSync();
    };

    const onPlayerUnsold = (data: {
      player: Player;
      displayDurationSeconds?: number;
    }) => {
      setResultModalData({
        type: 'UNSOLD',
        player: data.player,
        displayDurationSeconds: data.displayDurationSeconds || 3,
      });
      toast.warning(`UNSOLD: ${data.player?.name || 'Player'} passes through.`);
      void performSocketSync();
    };

    const onAuctionCompleted = (data: { room: AuctionRoom; reason?: string }) => {
      setResultModalData(null);
      setRoom(data.room);
      if (data.reason) setCompletionReason(data.reason);
      toast.success('The Auction has officially ended!');
      performSocketSync();
    };

    socket.on('participant:joined', onParticipantJoined);
    socket.on('participant:ready', onParticipantReady);
    socket.on('participant:left', onParticipantLeft);
    socket.on('participant:online', onParticipantOnline);
    socket.on('participant:offline', onParticipantOffline);
    socket.on('room:cancelled', onRoomCancelled);
    socket.on('auction:starting', onAuctionStarting);
    socket.on('auction:started', onAuctionStarted);
    socket.on('player:live', onPlayerLive);
    socket.on('bid:accepted', onBidAccepted);
    socket.on('player:sold', onPlayerSold);
    socket.on('player:unsold', onPlayerUnsold);
    socket.on('auction:completed', onAuctionCompleted);

    return () => {
      socket.off('participant:joined', onParticipantJoined);
      socket.off('participant:ready', onParticipantReady);
      socket.off('participant:left', onParticipantLeft);
      socket.off('participant:online', onParticipantOnline);
      socket.off('participant:offline', onParticipantOffline);
      socket.off('room:cancelled', onRoomCancelled);
      socket.off('auction:starting', onAuctionStarting);
      socket.off('auction:started', onAuctionStarted);
      socket.off('player:live', onPlayerLive);
      socket.off('bid:accepted', onBidAccepted);
      socket.off('player:sold', onPlayerSold);
      socket.off('player:unsold', onPlayerUnsold);
      socket.off('auction:completed', onAuctionCompleted);
    };
  }, [socket, roomCode, user, isConnected, joinRoom, performSocketSync]);

  if (isLoading || isAuthLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-sm font-semibold text-slate-400">Loading auction stadium...</p>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">Room Not Found</h2>
          <p className="text-xs text-slate-400">Could not retrieve room details for {roomCode}.</p>
          <Button onClick={() => router.push('/')} variant="primary">
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  const myParticipant = participants.find((p) => p.userId === user?.id) || null;

  // LOBBY STATE
  if (room.status === 'WAITING') {
    return (
      <div className="p-4 sm:p-8">
        <LobbyManager
          room={room}
          participants={participants}
          currentUserId={user?.id}
          onAuctionStarted={() => {
            fetchRoomData();
            performSocketSync();
          }}
          onRefresh={fetchRoomData}
        />
      </div>
    );
  }

  // COMPLETED STATE
  if (room.status === 'COMPLETED') {
    return (
      <div className="p-4 sm:p-8">
        <CompletedSummary
          room={room}
          participants={participants}
          reason={completionReason || (room as any)?.completionReason}
        />
      </div>
    );
  }

  // LIVE AUCTION ARENA STATE
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-arena-900/80 border border-arena-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
            <Badge variant="danger" size="md">
              LIVE AUCTION
            </Badge>
          </div>
          <span className="text-xs font-mono font-bold text-slate-300">
            Room: <strong className="text-emerald-400">{room.roomCode}</strong>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={performSocketSync}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Sync State
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsLeaveModalOpen(true)}
            className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Leave Room
          </Button>
        </div>
      </div>

      {/* Round & Position Progress Tracker */}
      <RoundProgressIndicator poolState={poolState} />

      {/* Main Arena Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Spotlight Player + Timer + Bidding Console + Live Pool Tracker */}
        <div className="lg:col-span-8 space-y-6">
          <PlayerSpotlight
            player={currentPlayer}
            currentHighestBid={currentHighestBid}
            highestParticipant={highestParticipant}
            basePrice={currentAuction?.startingPrice ?? (currentAuction as any)?.basePrice ?? currentPlayer?.basePrice ?? null}
            sequence={auctionSequence}
          />

          <AuctionTimer
            timerEndsAt={timerEndsAt}
            totalDurationSeconds={room.settings?.bidTimerSeconds || 15}
            isLive={Boolean(currentAuction && currentAuction.status === 'LIVE')}
            hasBids={Boolean(currentHighestBid !== null || recentBids.length > 0)}
          />

          <BiddingConsole
            roomCode={room.roomCode}
            room={room}
            myParticipant={myParticipant}
            currentAuction={currentAuction}
            currentHighestBid={currentHighestBid}
            highestParticipantId={currentAuction?.currentHighestParticipantId || null}
            isResultPhase={Boolean(resultModalData)}
          />

          {/* Current Pool Tracker: Round + Club Group + Position Players */}
          <LivePoolTracker
            poolState={poolState}
            currentLivePlayerId={currentPlayer?._id}
          />
        </div>

        {/* Right Column: Live Activity Feed */}
        <div className="lg:col-span-4 space-y-6">
          <LiveBidFeed bids={recentBids} participants={participants} />
        </div>
      </div>

      {/* Bottom Section: All Managers / Squad Standings */}
      <div className="pt-2">
        <ParticipantsSquads
          participants={participants}
          currentUserId={user?.id}
          settings={room.settings}
          roomCode={room.roomCode}
        />
      </div>

      {/* 3-Second Result Modal Popup */}
      <AuctionResultModal data={resultModalData} />

      {/* Leave Room Confirmation Dialog */}
      <LeaveConfirmationModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        onConfirm={handleConfirmLeave}
        isLoading={isLeaving}
      />
    </div>
  );
}
