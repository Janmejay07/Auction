'use client';

import React, { useState } from 'react';
import { useSocket } from '@/context/SocketContext';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import type { Participant, AuctionRoom, Auction } from '@/types';
import { Wallet, TrendingUp, AlertCircle, CheckCircle2, Eye, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface BiddingConsoleProps {
  roomCode: string;
  room: AuctionRoom;
  myParticipant: Participant | null;
  currentAuction: Auction | null;
  currentHighestBid: number | null;
  highestParticipantId: string | null;
  isResultPhase?: boolean;
}

export function BiddingConsole({
  roomCode,
  room,
  myParticipant,
  currentAuction,
  currentHighestBid,
  highestParticipantId,
  isResultPhase = false,
}: BiddingConsoleProps) {
  const { placeBid } = useSocket();
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const squadLimit = room.settings?.squadLimit || 11;
  const isSquadFull = Boolean(myParticipant && myParticipant.squadCount >= squadLimit);
  const isSpectator = !myParticipant || myParticipant.status !== 'ACTIVE';
  const isViewOnly = isSquadFull || isSpectator;

  const isLive = currentAuction?.status === 'LIVE' && !isResultPhase && !isViewOnly;
  const minIncrement = room.settings?.bidIncrement || 500000;
  const currentBid = currentHighestBid ?? currentAuction?.basePrice ?? 0;
  const nextMinBid = currentHighestBid ? currentHighestBid + minIncrement : currentAuction?.basePrice ?? minIncrement;

  const isMyHighestBid =
    Boolean(myParticipant && highestParticipantId && myParticipant._id === highestParticipantId);
  const myPurse = myParticipant?.purse ?? 0;

  const handleQuickBid = async (amount: number) => {
    if (isViewOnly) {
      toast.error(isSquadFull ? 'Your squad is full (11/11). You cannot bid on another player.' : 'You are in view-only mode.');
      return;
    }
    if (!myParticipant) {
      toast.error('You are not registered as an active participant in this room');
      return;
    }
    if (amount > myPurse) {
      toast.error(`Insufficient purse balance! You only have ${formatCurrency(myPurse)}`);
      return;
    }

    try {
      setIsSubmitting(true);
      const clientBidId = `bid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const res = await placeBid(roomCode, amount, clientBidId);

      if (res.ok) {
        toast.success(`Bid of ${formatCurrency(amount)} submitted!`);
        setCustomAmount('');
      } else {
        toast.error(res.error?.message || 'Bid was rejected by server');
      }
    } catch {
      toast.error('Failed to communicate with auction server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnly) return;
    const amount = Number(customAmount);
    if (!amount || isNaN(amount)) {
      toast.error('Please enter a valid numeric bid amount');
      return;
    }
    if (amount < nextMinBid) {
      toast.error(`Bid must be at least ${formatCurrency(nextMinBid)}`);
      return;
    }
    handleQuickBid(amount);
  };

  return (
    <Card variant="glass" className="w-full space-y-4">
      {/* Wallet / Purse Info Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-arena-950/70 border border-arena-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pitch-900/60 border border-pitch-700/60 flex items-center justify-center text-emerald-400">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Your Team Purse ({myParticipant?.teamName || 'Spectator'})
            </span>
            <span className="text-xl font-black text-emerald-400 font-mono">
              {formatCurrency(myPurse)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isMyHighestBid ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold animate-pulse">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>YOU ARE HIGHEST BIDDER</span>
            </div>
          ) : isSquadFull ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>SQUAD FULL ({myParticipant?.squadCount}/{squadLimit})</span>
            </div>
          ) : isSpectator ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold">
              <Eye className="w-4 h-4 text-slate-400" />
              <span>VIEW ONLY</span>
            </div>
          ) : (
            <div className="text-xs text-slate-400 font-medium">
              Min Next Bid: <strong className="text-slate-200">{formatCurrency(nextMinBid)}</strong>
            </div>
          )}
        </div>
      </div>

      {/* VIEW ONLY BANNER IF SQUAD IS FULL OR SPECTATOR */}
      {isViewOnly ? (
        <div className="p-6 rounded-2xl bg-arena-950/90 border border-amber-500/30 text-center space-y-2.5">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Eye className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-extrabold text-amber-300 uppercase tracking-wider">
            {isSquadFull ? 'Squad Full — View Only Mode' : 'Spectator — View Only Mode'}
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            {isSquadFull
              ? `Your squad has reached full capacity (${myParticipant?.squadCount}/${squadLimit} players). You cannot place additional bids, but you can continue watching the live auction and track all real-time sales.`
              : 'You are viewing this room in spectator mode. Bidding is reserved for active room managers.'}
          </p>
        </div>
      ) : (
        <>
          {/* Quick Bid Preset Buttons */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Quick Bid Actions
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <Button
                type="button"
                variant="primary"
                disabled={!isLive || isSubmitting || isMyHighestBid || nextMinBid > myPurse}
                onClick={() => handleQuickBid(nextMinBid)}
                className="flex flex-col items-center py-3"
              >
                <span className="text-xs opacity-80">Next Minimum</span>
                <span className="text-sm font-bold font-mono">{formatCurrency(nextMinBid)}</span>
              </Button>

              <Button
                type="button"
                variant="secondary"
                disabled={!isLive || isSubmitting || isMyHighestBid || currentBid + 1000000 > myPurse}
                onClick={() => handleQuickBid(currentBid + 1000000)}
                className="flex flex-col items-center py-3"
              >
                <span className="text-xs opacity-80">+10 Lakh</span>
                <span className="text-sm font-bold font-mono">{formatCurrency(currentBid + 1000000)}</span>
              </Button>

              <Button
                type="button"
                variant="secondary"
                disabled={!isLive || isSubmitting || isMyHighestBid || currentBid + 5000000 > myPurse}
                onClick={() => handleQuickBid(currentBid + 5000000)}
                className="flex flex-col items-center py-3"
              >
                <span className="text-xs opacity-80">+50 Lakh</span>
                <span className="text-sm font-bold font-mono">{formatCurrency(currentBid + 5000000)}</span>
              </Button>

              <Button
                type="button"
                variant="gold"
                disabled={!isLive || isSubmitting || isMyHighestBid || currentBid + 10000000 > myPurse}
                onClick={() => handleQuickBid(currentBid + 10000000)}
                className="flex flex-col items-center py-3"
              >
                <span className="text-xs opacity-80">+1 Crore</span>
                <span className="text-sm font-bold font-mono">{formatCurrency(currentBid + 10000000)}</span>
              </Button>
            </div>
          </div>

          {/* Custom Bid Input Form */}
          <form onSubmit={handleCustomSubmit} className="flex flex-col sm:flex-row items-end gap-3 pt-2">
            <div className="flex-1 w-full">
              <Input
                label="Custom Bid Amount (in ₹ INR)"
                type="number"
                placeholder={`Minimum ${formatCurrency(nextMinBid)}`}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                disabled={!isLive || isSubmitting || isMyHighestBid}
                min={nextMinBid}
                max={myPurse}
                leftIcon={<TrendingUp className="w-4 h-4" />}
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              disabled={!isLive || isSubmitting || isMyHighestBid || !customAmount || Number(customAmount) < nextMinBid || Number(customAmount) > myPurse}
              className="w-full sm:w-auto px-6 whitespace-nowrap"
            >
              Place Custom Bid
            </Button>
          </form>

          {!isLive && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Bidding is currently closed. Wait for the engine to open the next player.</span>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
