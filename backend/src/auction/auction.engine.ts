import mongoose, { Types } from 'mongoose';
import { AuctionRepository } from './auction.repository';
import { AuctionTimerManager } from './auction.timer';
import { BidRepository } from '../bids/bid.repository';
import { ParticipantRepository } from '../participants/participant.repository';
import { RoomPlayerRepository } from '../roomPlayers/roomPlayer.repository';
import { RoomRepository } from '../rooms/room.repository';
import { AuctionLockManager } from '../locks/InMemoryLock';
import { AuctionEventRepository } from '../events/auctionEvent.repository';
import { SquadPlayerRepository } from '../squads/squadPlayer.repository';
import { TransactionRepository } from '../wallet/transaction.repository';
import { PlayerRepository } from '../players/player.repository';
import {
  AuctionNotFoundError,
  BidRejectedError,
  ConflictError,
  InvalidAuctionTransitionError,
  InvalidRoomStateError,
  NotFoundError,
} from '../common/errors';
import {
  AuctionStatus,
  RoomPlayerStatus,
  RoomStatus,
  AuctionEventType,
  TransactionType,
} from '../common/types/domain';
import type { IAuction, IAuctionRoom, IBid, IParticipant } from '../common/types/domain';

export interface AuctionEngineEvent {
  roomCode: string;
  event: string;
  payload: unknown;
}

export interface PlaceBidResult {
  auction: IAuction;
  bid: IBid;
  participant: IParticipant;
}

const auctionTransitions: Record<AuctionStatus, readonly AuctionStatus[]> = {
  CREATED: [AuctionStatus.LIVE, AuctionStatus.CANCELLED],
  LIVE: [AuctionStatus.FINALIZING, AuctionStatus.CANCELLED],
  FINALIZING: [AuctionStatus.SOLD, AuctionStatus.UNSOLD, AuctionStatus.CANCELLED],
  SOLD: [],
  UNSOLD: [],
  CANCELLED: [],
};

const roomTransitions: Record<RoomStatus, readonly RoomStatus[]> = {
  WAITING: [RoomStatus.STARTING, RoomStatus.CANCELLED],
  STARTING: [RoomStatus.LIVE, RoomStatus.CANCELLED],
  LIVE: [RoomStatus.COMPLETING, RoomStatus.CANCELLED],
  COMPLETING: [RoomStatus.COMPLETED],
  COMPLETED: [],
  CANCELLED: [],
};

export class AuctionEngine {
  readonly timerManager: AuctionTimerManager;
  private readonly lock = new AuctionLockManager();
  private readonly bidQueues = new Map<string, Promise<void>>();

  constructor(
    private readonly roomRepo = new RoomRepository(),
    private readonly roomPlayerRepo = new RoomPlayerRepository(),
    private readonly auctionRepo = new AuctionRepository(),
    private readonly participantRepo = new ParticipantRepository(),
    private readonly bidRepo = new BidRepository(),
    private onEvent?: (event: AuctionEngineEvent) => void,
    private readonly eventRepo = new AuctionEventRepository(),
    private readonly squadRepo = new SquadPlayerRepository(),
    private readonly transactionRepo = new TransactionRepository(),
    private readonly playerRepo = new PlayerRepository(),
    private readonly resultDisplayDurationMs: number = 3000,
  ) {
    this.timerManager = new AuctionTimerManager((auctionId) => this.expireAuction(auctionId));
  }

  setEventHandler(handler: (event: AuctionEngineEvent) => void): void {
    this.onEvent = handler;
  }

  broadcast(roomCode: string, event: string, payload: unknown): void {
    this.emit(roomCode, event, payload);
  }

  async transitionAuction(id: string, to: AuctionStatus): Promise<IAuction> {
    const current = await this.auctionRepo.findById(id);
    if (!current) throw new AuctionNotFoundError();
    if (!auctionTransitions[current.status].includes(to)) {
      throw new InvalidAuctionTransitionError(`${current.status} cannot transition to ${to}`);
    }
    const updated = await this.auctionRepo.transitionStatus(id, current.status, to);
    if (!updated) throw new ConflictError('Auction changed before transition', 'AUCTION_TRANSITION_CONFLICT');
    return updated;
  }

  async transitionRoom(id: string, to: RoomStatus): Promise<IAuctionRoom> {
    const current = await this.roomRepo.findById(id);
    if (!current) throw new NotFoundError('Room not found', 'ROOM_NOT_FOUND');
    if (!roomTransitions[current.status].includes(to)) {
      throw new InvalidRoomStateError(`${current.status} cannot transition to ${to}`);
    }
    const updated = await this.roomRepo.transitionStatus(id, current.status, to, to === RoomStatus.COMPLETED ? { completedAt: new Date() } : undefined);
    if (!updated) throw new ConflictError('Room changed before transition', 'ROOM_TRANSITION_CONFLICT');
    return updated;
  }

  /**
   * Evaluates completion conditions for a room:
   * 1. Insufficient active participants (< 2)
   * 2. All active participants have full squads (eligibleManagers === 0)
   * 3. No pending players remain in the player pool
   */
  async checkCompletionStatus(roomId: string, squadLimit?: number): Promise<{
    shouldComplete: boolean;
    reason?: 'NOT_ENOUGH_PLAYERS' | 'ALL_SQUADS_FULL' | 'NO_PLAYERS_REMAINING';
    activeParticipants: IParticipant[];
    eligibleManagers: IParticipant[];
  }> {
    const activeParticipants = await this.participantRepo.findActiveByRoom(roomId);
    if (activeParticipants.length < 2) {
      return {
        shouldComplete: true,
        reason: 'NOT_ENOUGH_PLAYERS',
        activeParticipants,
        eligibleManagers: [],
      };
    }

    const limit = squadLimit || 11;
    const eligibleManagers = activeParticipants.filter((p) => p.squadCount < limit);
    if (eligibleManagers.length === 0) {
      return {
        shouldComplete: true,
        reason: 'ALL_SQUADS_FULL',
        activeParticipants,
        eligibleManagers,
      };
    }

    const nextPending = await this.roomPlayerRepo.findNextPending(roomId);
    if (!nextPending) {
      return {
        shouldComplete: true,
        reason: 'NO_PLAYERS_REMAINING',
        activeParticipants,
        eligibleManagers,
      };
    }

    return {
      shouldComplete: false,
      activeParticipants,
      eligibleManagers,
    };
  }

  /**
   * Atomically and idempotently completes the auction for a room.
   */
  async completeAuction(roomId: string, reason: string): Promise<IAuctionRoom | null> {
    const lockKey = `room:${roomId}:complete`;
    if (!(await this.lock.acquire(lockKey))) {
      return this.roomRepo.findById(roomId);
    }
    try {
      const room = await this.roomRepo.findById(roomId);
      if (!room) return null;
      if (room.status === RoomStatus.COMPLETED || room.status === RoomStatus.CANCELLED) {
        return room;
      }

      const updated = await this.roomRepo.updateStatus(
        roomId,
        RoomStatus.COMPLETED,
        { completedAt: new Date() },
      );

      if (updated) {
        this.emit(room.roomCode, 'auction:completed', {
          roomId: room._id,
          room: updated,
          reason,
          status: 'COMPLETED',
        });
      }

      return updated;
    } finally {
      await this.lock.release(lockKey);
    }
  }

  async startAuction(roomId: string): Promise<IAuction> {
    const lockKey = `room:${roomId}:start`;
    if (!(await this.lock.acquire(lockKey))) throw new ConflictError('Auction start is already in progress', 'AUCTION_START_CONFLICT');
    try {
      const room = await this.roomRepo.findById(roomId);
      if (!room) throw new NotFoundError('Room not found', 'ROOM_NOT_FOUND');

      const completionCheck = await this.checkCompletionStatus(roomId, room.settings?.squadLimit);
      if (completionCheck.shouldComplete) {
        await this.completeAuction(roomId, completionCheck.reason!);
        throw new ConflictError(
          completionCheck.reason === 'NOT_ENOUGH_PLAYERS'
            ? 'At least 2 active participants are required to start the auction'
            : completionCheck.reason === 'ALL_SQUADS_FULL'
            ? 'All manager squads are full'
            : 'No pending players remain in the player pool',
          completionCheck.reason,
        );
      }

      const pending = await this.roomPlayerRepo.findNextPending(roomId);
      if (!pending) throw new ConflictError('No pending players remain', 'PLAYER_POOL_EMPTY');
      const isPopulatedPlayer = Boolean(pending.playerId && typeof pending.playerId === 'object' && (pending.playerId as any).name);
      const pendingPlayerIdStr = isPopulatedPlayer
        ? (pending.playerId as any)._id.toString()
        : pending.playerId.toString();
      const player = isPopulatedPlayer
        ? (pending.playerId as any)
        : await this.playerRepo.findById(pendingPlayerIdStr);
      this.emit(room.roomCode, 'auction:starting', { roomId: room._id, roomPlayer: pending });
      const timerEndsAt = new Date(Date.now() + (room.settings?.bidTimerSeconds || 15) * 1000);
      const auction = await this.auctionRepo.createAuction({
        roomId: new Types.ObjectId(roomId),
        roomPlayerId: pending._id,
        playerId: new Types.ObjectId(pendingPlayerIdStr),
        status: AuctionStatus.LIVE,
        startingPrice: pending.basePrice,
        currentHighestBid: pending.basePrice,
        currentHighestParticipantId: null,
        bidCount: 0,
        sequence: 0,
        version: 1,
        hasStartedBidding: false,
        timerEndsAt,
        startedAt: new Date(),
      });
      await this.roomPlayerRepo.updateStatus(pending._id.toString(), RoomPlayerStatus.LIVE);
      await this.roomRepo.transitionStatus(roomId, RoomStatus.STARTING, RoomStatus.LIVE, { startedAt: room.startedAt ?? new Date() });
      await this.roomRepo.setCurrentAuction(roomId, auction._id);
      this.timerManager.start(auction);
      const event = await this.eventRepo.createAuctionEvent({
        roomId: room._id,
        auctionId: auction._id,
        type: AuctionEventType.AUCTION_STARTED,
        sequence: await this.eventRepo.nextSequence(roomId),
        payload: { auction },
      });
      const poolState = await this.roomPlayerRepo.getActivePoolState(roomId);
      this.emit(room.roomCode, 'auction:started', { room, auction, eventSequence: event.sequence });
      this.emit(room.roomCode, 'player:live', {
        auction,
        roomPlayer: pending,
        player: player ?? undefined,
        sequence: auction.sequence,
        poolState,
      });
      return auction;
    } finally {
      await this.lock.release(lockKey);
    }
  }

  async placeBid(userId: string, roomCode: string, amount: number, clientBidId: string): Promise<PlaceBidResult> {
    const room = await this.roomRepo.findRoomByCode(roomCode);
    if (!room) throw new NotFoundError('Room not found', 'ROOM_NOT_FOUND');
    const participant = await this.participantRepo.findParticipant(room._id.toString(), userId);
    if (!participant || participant.status !== 'ACTIVE') throw new BidRejectedError('You are not an active participant in this room', 'NOT_PARTICIPANT');
    if (participant.squadCount >= (room.settings?.squadLimit || 11)) {
      throw new BidRejectedError('Your squad is full and you cannot bid on another player.', 'SQUAD_FULL');
    }
    if (!Number.isFinite(amount) || amount <= 0) throw new BidRejectedError('Bid amount must be greater than 0', 'INVALID_AMOUNT');
    if (!clientBidId.trim()) throw new BidRejectedError('clientBidId is required', 'INVALID_AMOUNT');
    const auction = await this.auctionRepo.findCurrentAuction(room._id.toString());
    if (!auction) throw new BidRejectedError('There is no live auction', 'AUCTION_NOT_LIVE');
    const existing = await this.bidRepo.findByClientBidId(room._id.toString(), clientBidId);
    if (existing) return { auction, bid: existing, participant };
    const lockKey = `room:${room._id}:auction:${auction._id}`;
    const releaseQueue = await this.acquireBidTurn(lockKey);
    try {
      if (!(await this.lock.acquire(lockKey))) throw new BidRejectedError('Another bid is being processed', 'BID_CONFLICT');
      try {
        const current = await this.auctionRepo.findById(auction._id.toString());
        if (!current || current.status !== AuctionStatus.LIVE) throw new BidRejectedError('Auction is no longer live', 'AUCTION_NOT_LIVE');
        const latestParticipant = await this.participantRepo.findById(participant._id.toString());
        if (!latestParticipant || latestParticipant.status !== 'ACTIVE') throw new BidRejectedError('You are not an active participant in this room', 'NOT_PARTICIPANT');
        if (latestParticipant.squadCount >= (room.settings?.squadLimit || 11)) {
          throw new BidRejectedError('Your squad is full and you cannot bid on another player.', 'SQUAD_FULL');
        }
        const duplicate = await this.bidRepo.findByClientBidId(room._id.toString(), clientBidId);
        if (duplicate) return { auction: current, bid: duplicate, participant: latestParticipant };
        if (current.timerEndsAt && current.timerEndsAt.getTime() <= Date.now()) throw new BidRejectedError('The bidding timer has expired', 'TIMER_EXPIRED');
        if (current.currentHighestParticipantId?.toString() === latestParticipant._id.toString()) {
          throw new BidRejectedError('Another participant must bid before you can bid again', 'SAME_HIGHEST_BIDDER');
        }
        const minimum = current.hasStartedBidding
          ? (current.currentHighestBid ?? current.startingPrice) + (room.settings?.bidIncrement || 100)
          : current.startingPrice;
        if (amount < minimum) throw new BidRejectedError(`Bid must be at least ${minimum}`, 'BID_TOO_LOW');
        if (latestParticipant.purseRemaining < amount) throw new BidRejectedError('Insufficient purse', 'INSUFFICIENT_PURSE');
        if (latestParticipant.squadCount >= (room.settings?.squadLimit || 11)) throw new BidRejectedError('Your squad is full and you cannot bid on another player.', 'SQUAD_FULL');

        const timerEndsAt = new Date(Date.now() + (room.settings?.bidTimerSeconds || 15) * 1000);
        const updated = await this.auctionRepo.applyBid(
          current._id.toString(),
          current.version,
          amount,
          latestParticipant._id,
          current.sequence + 1,
          timerEndsAt,
        );
        if (!updated) throw new BidRejectedError('Bid could not be accepted; retry', 'BID_CONFLICT');

        const bid = await this.bidRepo.createBid({
          roomId: room._id,
          auctionId: current._id,
          playerId: current.playerId,
          participantId: latestParticipant._id,
          userId: new Types.ObjectId(userId),
          amount,
          sequence: updated.sequence,
          clientBidId,
        });
        const event = await this.eventRepo.createAuctionEvent({
          roomId: room._id,
          auctionId: current._id,
          type: AuctionEventType.AUCTION_BID_PLACED,
          actorUserId: new Types.ObjectId(userId),
          participantId: latestParticipant._id,
          sequence: await this.eventRepo.nextSequence(room._id.toString()),
          payload: { amount, clientBidId: bid.clientBidId, bidId: bid._id },
        });

        this.timerManager.reset(updated);
        this.emit(room.roomCode, 'bid:accepted', {
          auction: updated,
          bid,
          participant: latestParticipant,
          eventSequence: event.sequence,
        });
        return { auction: updated, bid, participant: latestParticipant };
      } finally {
        await this.lock.release(lockKey);
      }
    } finally {
      releaseQueue();
    }
  }

  async expireAuction(auctionId: string): Promise<void> {
    const auction = await this.auctionRepo.findById(auctionId);
    if (!auction) return;
    const lockKey = `room:${auction.roomId}:auction:${auctionId}`;
    if (!(await this.lock.acquire(lockKey))) return;
    try {
      const current = await this.auctionRepo.findById(auctionId);
      if (!current || current.status !== AuctionStatus.LIVE || !current.timerEndsAt || current.timerEndsAt.getTime() > Date.now()) return;
      const room = await this.roomRepo.findById(current.roomId.toString());
      if (!room) return;
      this.timerManager.cancel(auctionId);

      const hasWinner = Boolean(current.currentHighestParticipantId && current.bidCount > 0);
      const finalStatus = hasWinner ? AuctionStatus.SOLD : AuctionStatus.UNSOLD;
      const player = await this.playerRepo.findById(current.playerId.toString());

      let completed: IAuction | null = null;
      let winner: IParticipant | null = null;
      let winningAmount: number | undefined;
      let eventSequence: number | undefined;

      const executeFinalization = async (session?: mongoose.ClientSession) => {
        const finalizing = await this.auctionRepo.transitionStatus(
          auctionId,
          AuctionStatus.LIVE,
          AuctionStatus.FINALIZING,
          undefined,
          session,
        );
        if (!finalizing) throw new ConflictError('Auction finalization lost a race', 'AUCTION_FINALIZATION_CONFLICT');

        winningAmount = current.currentHighestBid ?? current.startingPrice;
        if (hasWinner) {
          const winnerId = current.currentHighestParticipantId!.toString();
          const before = await this.participantRepo.findById(winnerId, session);
          if (!before || before.purseRemaining < winningAmount) {
            throw new ConflictError('Winning participant can no longer afford this player', 'INSUFFICIENT_PURCHASE_FUNDS');
          }
          winner = await this.participantRepo.purchasePlayer(winnerId, winningAmount, room.settings.squadLimit, session);
          if (!winner) throw new ConflictError('Winning participant can no longer purchase this player', 'INSUFFICIENT_PURCHASE_FUNDS');
          await this.squadRepo.createSquadPlayer({
            roomId: current.roomId,
            participantId: current.currentHighestParticipantId!,
            playerId: current.playerId,
            auctionId: current._id,
            purchasePrice: winningAmount,
            status: 'RESERVE',
            purchasedAt: new Date(),
          }, session);
          await this.transactionRepo.createTransaction({
            roomId: current.roomId,
            participantId: current.currentHighestParticipantId!,
            auctionId: current._id,
            type: TransactionType.PLAYER_PURCHASE,
            amount: winningAmount,
            balanceBefore: before.purseRemaining,
            balanceAfter: winner.purseRemaining,
          }, session);
        }

        completed = await this.auctionRepo.transitionStatus(
          auctionId,
          AuctionStatus.FINALIZING,
          finalStatus,
          hasWinner ? {
            winnerParticipantId: current.currentHighestParticipantId,
            winningAmount,
            completedAt: new Date(),
          } : { completedAt: new Date() },
          session,
        );
        if (!completed) throw new ConflictError('Auction finalization could not be completed', 'AUCTION_FINALIZATION_CONFLICT');

        const roomPlayer = await this.roomPlayerRepo.updateStatus(
          current.roomPlayerId.toString(),
          hasWinner ? RoomPlayerStatus.SOLD : RoomPlayerStatus.UNSOLD,
          hasWinner ? { soldToParticipantId: current.currentHighestParticipantId, soldPrice: winningAmount } : undefined,
          session,
        );
        if (!roomPlayer) throw new NotFoundError('Room player not found', 'ROOM_PLAYER_NOT_FOUND');

        const event = await this.eventRepo.createAuctionEvent({
          roomId: current.roomId,
          auctionId: current._id,
          type: hasWinner ? AuctionEventType.AUCTION_SOLD : AuctionEventType.AUCTION_UNSOLD,
          participantId: current.currentHighestParticipantId ?? undefined,
          sequence: await this.eventRepo.nextSequence(current.roomId.toString(), session),
          payload: hasWinner
            ? { player, winner, winningAmount, remainingPurse: winner!.purseRemaining }
            : { player, auction: completed },
        }, session);
        eventSequence = event.sequence;
      };

      try {
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            await executeFinalization(session);
          });
        } catch (txErr: any) {
          if (
            txErr?.message?.includes('replica set member') ||
            txErr?.codeName === 'IllegalOperation' ||
            txErr?.message?.includes('Transaction numbers are only allowed')
          ) {
            await executeFinalization(undefined);
          } else {
            throw txErr;
          }
        } finally {
          await session.endSession().catch(() => {});
        }
      } catch (sessErr: any) {
        if (
          sessErr?.message?.includes('replica set member') ||
          sessErr?.codeName === 'IllegalOperation' ||
          sessErr?.message?.includes('Transaction numbers are only allowed')
        ) {
          await executeFinalization(undefined);
        } else {
          throw sessErr;
        }
      }

      if (!completed) return;
      const settledWinner = winner as IParticipant | null;
      this.emit(room.roomCode, hasWinner ? 'player:sold' : 'player:unsold', hasWinner
        ? {
            result: 'SOLD',
            player,
            playerId: player?._id ?? current.playerId,
            playerName: player?.name ?? 'Player',
            winner,
            winningAmount,
            winningBid: winningAmount,
            winnerParticipantId: current.currentHighestParticipantId,
            winnerParticipantName: settledWinner?.teamName ?? 'Winning Team',
            remainingPurse: settledWinner?.purseRemaining,
            auction: completed,
            displayDurationSeconds: Math.max(1, Math.round(this.resultDisplayDurationMs / 1000)),
            eventSequence,
          }
        : {
            result: 'UNSOLD',
            player,
            playerId: player?._id ?? current.playerId,
            playerName: player?.name ?? 'Player',
            auction: completed,
            displayDurationSeconds: Math.max(1, Math.round(this.resultDisplayDurationMs / 1000)),
            eventSequence,
          });

      if (this.resultDisplayDurationMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.resultDisplayDurationMs));
      }
      await this.advance(room, current);
    } finally {
      await this.lock.release(lockKey);
    }
  }

  async recover(): Promise<void> {
    const [liveRooms, completingRooms, auctions] = await Promise.all([
      this.roomRepo.findByStatus(RoomStatus.LIVE),
      this.roomRepo.findByStatus(RoomStatus.COMPLETING),
      this.auctionRepo.findAllByStatus(AuctionStatus.LIVE),
    ]);
    const roomIds = new Set([...liveRooms, ...completingRooms].map((room) => room._id.toString()));
    await this.timerManager.recover(auctions.filter((auction) => roomIds.has(auction.roomId.toString())));
  }

  private async advance(room: IAuctionRoom, previous: IAuction): Promise<void> {
    const completionCheck = await this.checkCompletionStatus(room._id.toString(), room.settings?.squadLimit);
    if (completionCheck.shouldComplete) {
      await this.completeAuction(room._id.toString(), completionCheck.reason!);
      return;
    }

    const next = await this.roomPlayerRepo.findNextPending(room._id.toString());
    if (next) {
      const isPopulatedPlayer = Boolean(next.playerId && typeof next.playerId === 'object' && (next.playerId as any).name);
      const nextPlayerIdStr = isPopulatedPlayer
        ? (next.playerId as any)._id.toString()
        : next.playerId.toString();
      const player = isPopulatedPlayer
        ? (next.playerId as any)
        : await this.playerRepo.findById(nextPlayerIdStr);
      const timerEndsAt = new Date(Date.now() + (room.settings?.bidTimerSeconds || 15) * 1000);
      const auction = await this.auctionRepo.createAuction({
        roomId: room._id,
        roomPlayerId: next._id,
        playerId: new Types.ObjectId(nextPlayerIdStr),
        status: AuctionStatus.LIVE,
        startingPrice: next.basePrice,
        currentHighestBid: next.basePrice,
        currentHighestParticipantId: null,
        bidCount: 0,
        sequence: 0,
        version: 1,
        hasStartedBidding: false,
        timerEndsAt,
        startedAt: new Date(),
      });
      await this.roomPlayerRepo.updateStatus(next._id.toString(), RoomPlayerStatus.LIVE);
      await this.roomRepo.setCurrentAuction(room._id.toString(), auction._id);
      this.timerManager.start(auction);
      const poolState = await this.roomPlayerRepo.getActivePoolState(room._id.toString());
      this.emit(room.roomCode, 'player:live', {
        auction,
        roomPlayer: next,
        player: player ?? undefined,
        sequence: auction.sequence,
        previousAuctionId: previous._id,
        poolState,
      });
      return;
    }
    await this.completeAuction(room._id.toString(), 'NO_PLAYERS_REMAINING');
  }

  private emit(roomCode: string, event: string, payload: unknown): void {
    this.onEvent?.({ roomCode, event, payload });
  }

  private async acquireBidTurn(key: string): Promise<() => void> {
    const previous = this.bidQueues.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    this.bidQueues.set(key, current);
    await previous;
    return () => {
      if (this.bidQueues.get(key) === current) this.bidQueues.delete(key);
      release();
    };
  }
}

export const sharedAuctionEngine = new AuctionEngine();

