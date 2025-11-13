import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db';
import { AuctionRepository } from '../src/auction/auction.repository';
import { AuctionStatus } from '../src/common/types/domain';

const auctionRepo = new AuctionRepository();

const roomId = new Types.ObjectId();
const playerId = new Types.ObjectId();
const roomPlayerId = new Types.ObjectId();
const participantId = new Types.ObjectId();

function makeAuctionDTO(status: AuctionStatus = AuctionStatus.CREATED) {
  return {
    roomId,
    roomPlayerId,
    playerId,
    status,
    startingPrice: 100,
    bidCount: 0,
    sequence: 0,
    version: 0,
    hasStartedBidding: false,
    startedAt: new Date(),
  };
}

describe('AuctionRepository', () => {
  beforeAll(setupTestDb);
  afterEach(clearTestDb);
  afterAll(teardownTestDb);

  it('creates an auction with CREATED status', async () => {
    const auction = await auctionRepo.createAuction(makeAuctionDTO());

    expect(auction._id).toBeDefined();
    expect(auction.status).toBe(AuctionStatus.CREATED);
    expect(auction.version).toBe(0);
    expect(auction.hasStartedBidding).toBe(false);
  });

  it('findCurrentAuction returns only LIVE auctions', async () => {
    await auctionRepo.createAuction(makeAuctionDTO(AuctionStatus.CREATED));
    const live = await auctionRepo.createAuction(
      makeAuctionDTO(AuctionStatus.LIVE),
    );

    const found = await auctionRepo.findCurrentAuction(roomId.toString());
    expect(found).not.toBeNull();
    expect(found!._id.toString()).toBe(live._id.toString());
  });

  it('findCurrentAuction returns null when no live auction', async () => {
    await auctionRepo.createAuction(makeAuctionDTO(AuctionStatus.CREATED));

    const found = await auctionRepo.findCurrentAuction(roomId.toString());
    expect(found).toBeNull();
  });

  it('applyBid succeeds on matching version and increments counters', async () => {
    const auction = await auctionRepo.createAuction(
      makeAuctionDTO(AuctionStatus.LIVE),
    );
    const timerEndsAt = new Date(Date.now() + 15_000);

    const updated = await auctionRepo.applyBid(
      auction._id.toString(),
      0, // expected version
      500,
      participantId,
      1,
      timerEndsAt,
    );

    expect(updated).not.toBeNull();
    expect(updated!.currentHighestBid).toBe(500);
    expect(updated!.bidCount).toBe(1);
    expect(updated!.version).toBe(1);
    expect(updated!.hasStartedBidding).toBe(true);
    expect(updated!.sequence).toBe(1);
  });

  it('applyBid returns null on version mismatch (optimistic lock)', async () => {
    const auction = await auctionRepo.createAuction(
      makeAuctionDTO(AuctionStatus.LIVE),
    );
    const timerEndsAt = new Date(Date.now() + 15_000);

    // First bid succeeds
    await auctionRepo.applyBid(
      auction._id.toString(),
      0,
      500,
      participantId,
      1,
      timerEndsAt,
    );

    // Second bid with stale version (0) should fail
    const stale = await auctionRepo.applyBid(
      auction._id.toString(),
      0, // stale version
      600,
      participantId,
      2,
      timerEndsAt,
    );
    expect(stale).toBeNull();
  });

  it('updateStatus transitions auction to SOLD', async () => {
    const auction = await auctionRepo.createAuction(
      makeAuctionDTO(AuctionStatus.LIVE),
    );

    const completed = await auctionRepo.updateStatus(
      auction._id.toString(),
      AuctionStatus.SOLD,
      {
        winnerParticipantId: participantId,
        winningAmount: 500,
        completedAt: new Date(),
      },
    );

    expect(completed!.status).toBe(AuctionStatus.SOLD);
    expect(completed!.winningAmount).toBe(500);
    expect(completed!.winnerParticipantId?.toString()).toBe(
      participantId.toString(),
    );
  });

  it('findByStatus returns auctions filtered by status', async () => {
    await auctionRepo.createAuction(makeAuctionDTO(AuctionStatus.SOLD));
    await auctionRepo.createAuction(makeAuctionDTO(AuctionStatus.UNSOLD));
    await auctionRepo.createAuction(makeAuctionDTO(AuctionStatus.LIVE));

    const sold = await auctionRepo.findByStatus(
      roomId.toString(),
      AuctionStatus.SOLD,
    );
    expect(sold.length).toBe(1);
  });
});
