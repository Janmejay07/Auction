import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db';
import { RoomRepository } from '../src/rooms/room.repository';
import { ParticipantRepository } from '../src/participants/participant.repository';
import { AuctionRepository } from '../src/auction/auction.repository';
import { BidRepository } from '../src/bids/bid.repository';
import { RoomPlayerRepository } from '../src/roomPlayers/roomPlayer.repository';
import {
  RoomStatus,
  ParticipantStatus,
  AuctionStatus,
  RoomPlayerStatus,
} from '../src/common/types/domain';

/**
 * Integration-level tests verifying that indexes (unique constraints)
 * are actually created and enforced by MongoDB.
 */
describe('Database index enforcement', () => {
  beforeAll(setupTestDb);
  afterEach(clearTestDb);
  afterAll(teardownTestDb);

  const roomRepo = new RoomRepository();
  const participantRepo = new ParticipantRepository();
  const auctionRepo = new AuctionRepository();
  const bidRepo = new BidRepository();
  const roomPlayerRepo = new RoomPlayerRepository();

  // ── auctionRooms: unique roomCode ──────────────────────────────────
  describe('auctionRooms.roomCode unique index', () => {
    it('rejects duplicate room codes', async () => {
      const dto = {
        roomCode: 'UNIQ01',
        creatorUserId: new Types.ObjectId(),
        status: RoomStatus.WAITING,
        settings: {
          purseTotal: 100_000,
          squadLimit: 11,
          bidIncrement: 100,
          bidTimerSeconds: 15,
        },
      };
      await roomRepo.createRoom(dto);
      await expect(roomRepo.createRoom(dto)).rejects.toThrow();
    });
  });

  // ── participants: unique roomId + userId ────────────────────────────
  describe('participants.(roomId+userId) unique index', () => {
    it('rejects a second join by the same user in the same room', async () => {
      const roomId = new Types.ObjectId();
      const userId = new Types.ObjectId();
      const base = {
        roomId,
        userId,
        teamName: 'X',
        initialPurse: 100_000,
        purseRemaining: 100_000,
        totalSpent: 0,
        squadCount: 0,
        status: ParticipantStatus.ACTIVE,
        joinedAt: new Date(),
        lastSeenAt: new Date(),
      };
      await participantRepo.createParticipant(base);
      await expect(
        participantRepo.createParticipant({ ...base, teamName: 'Y' }),
      ).rejects.toThrow();
    });
  });

  // ── bids: unique roomId + clientBidId ──────────────────────────────
  describe('bids.(roomId+clientBidId) unique index', () => {
    it('rejects duplicate clientBidId within the same room', async () => {
      const base = {
        roomId: new Types.ObjectId(),
        auctionId: new Types.ObjectId(),
        playerId: new Types.ObjectId(),
        participantId: new Types.ObjectId(),
        userId: new Types.ObjectId(),
        amount: 1000,
        sequence: 1,
        clientBidId: 'idem-001',
      };
      await bidRepo.createBid(base);
      await expect(
        bidRepo.createBid({ ...base, amount: 2000, sequence: 2 }),
      ).rejects.toThrow();
    });
  });

  // ── auction states ──────────────────────────────────────────────────
  describe('auction status lifecycle', () => {
    it('progresses through CREATED → LIVE → SOLD', async () => {
      const dto = {
        roomId: new Types.ObjectId(),
        roomPlayerId: new Types.ObjectId(),
        playerId: new Types.ObjectId(),
        status: AuctionStatus.CREATED,
        startingPrice: 100,
        bidCount: 0,
        sequence: 0,
        version: 0,
        hasStartedBidding: false,
        startedAt: new Date(),
      };

      const auction = await auctionRepo.createAuction(dto);
      expect(auction.status).toBe(AuctionStatus.CREATED);

      const live = await auctionRepo.updateStatus(
        auction._id.toString(),
        AuctionStatus.LIVE,
      );
      expect(live!.status).toBe(AuctionStatus.LIVE);

      const sold = await auctionRepo.updateStatus(
        auction._id.toString(),
        AuctionStatus.SOLD,
        {
          winnerParticipantId: new Types.ObjectId(),
          winningAmount: 500,
          completedAt: new Date(),
        },
      );
      expect(sold!.status).toBe(AuctionStatus.SOLD);
      expect(sold!.winningAmount).toBe(500);
    });

    it('can progress to UNSOLD when no bids', async () => {
      const dto = {
        roomId: new Types.ObjectId(),
        roomPlayerId: new Types.ObjectId(),
        playerId: new Types.ObjectId(),
        status: AuctionStatus.LIVE,
        startingPrice: 100,
        bidCount: 0,
        sequence: 0,
        version: 0,
        hasStartedBidding: false,
        startedAt: new Date(),
      };

      const auction = await auctionRepo.createAuction(dto);
      const unsold = await auctionRepo.updateStatus(
        auction._id.toString(),
        AuctionStatus.UNSOLD,
        { completedAt: new Date() },
      );
      expect(unsold!.status).toBe(AuctionStatus.UNSOLD);
    });
  });

  // ── roomPlayers: ordering ───────────────────────────────────────────
  describe('roomPlayers auctionOrder index', () => {
    it('findNextPending returns the lowest-order PENDING player', async () => {
      const roomId = new Types.ObjectId();
      const p1 = new Types.ObjectId();
      const p2 = new Types.ObjectId();

      await roomPlayerRepo.createRoomPlayer({
        roomId,
        playerId: p1,
        basePrice: 100,
        auctionOrder: 2,
        status: RoomPlayerStatus.PENDING,
      });
      await roomPlayerRepo.createRoomPlayer({
        roomId,
        playerId: p2,
        basePrice: 100,
        auctionOrder: 1,
        status: RoomPlayerStatus.PENDING,
      });

      const next = await roomPlayerRepo.findNextPending(roomId.toString());
      expect(next).not.toBeNull();
      expect(next!.auctionOrder).toBe(1);
    });
  });
});
