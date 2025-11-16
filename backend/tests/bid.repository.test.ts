import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db';
import { BidRepository } from '../src/bids/bid.repository';

const bidRepo = new BidRepository();

const roomId = new Types.ObjectId();
const auctionId = new Types.ObjectId();
const playerId = new Types.ObjectId();
const participantId = new Types.ObjectId();
const userId = new Types.ObjectId();

function makeBidDTO(amount: number, clientBidId: string, sequence: number) {
  return {
    roomId,
    auctionId,
    playerId,
    participantId,
    userId,
    amount,
    sequence,
    clientBidId,
  };
}

describe('BidRepository', () => {
  beforeAll(setupTestDb);
  afterEach(clearTestDb);
  afterAll(teardownTestDb);

  it('creates a bid successfully', async () => {
    const bid = await bidRepo.createBid(makeBidDTO(1000, 'client-001', 1));

    expect(bid._id).toBeDefined();
    expect(bid.amount).toBe(1000);
    expect(bid.sequence).toBe(1);
    expect(bid.clientBidId).toBe('client-001');
  });

  it('enforces unique (roomId, clientBidId) for idempotency', async () => {
    await bidRepo.createBid(makeBidDTO(1000, 'client-dup', 1));

    await expect(
      bidRepo.createBid(makeBidDTO(2000, 'client-dup', 2)),
    ).rejects.toThrow();
  });

  it('allows same clientBidId in different rooms', async () => {
    const otherRoom = new Types.ObjectId();
    await bidRepo.createBid(makeBidDTO(1000, 'client-x', 1));

    const bid2 = await bidRepo.createBid({
      ...makeBidDTO(1000, 'client-x', 1),
      roomId: otherRoom,
    });
    expect(bid2._id).toBeDefined();
  });

  it('findByClientBidId returns existing bid', async () => {
    await bidRepo.createBid(makeBidDTO(1500, 'client-abc', 1));

    const found = await bidRepo.findByClientBidId(
      roomId.toString(),
      'client-abc',
    );
    expect(found).not.toBeNull();
    expect(found!.amount).toBe(1500);
  });

  it('findByClientBidId returns null for unknown id', async () => {
    const found = await bidRepo.findByClientBidId(
      roomId.toString(),
      'ghost-999',
    );
    expect(found).toBeNull();
  });

  it('findByAuction returns bids ordered by sequence', async () => {
    await bidRepo.createBid(makeBidDTO(1000, 'b1', 1));
    await bidRepo.createBid(makeBidDTO(2000, 'b2', 2));
    await bidRepo.createBid(makeBidDTO(3000, 'b3', 3));

    const bids = await bidRepo.findByAuction(auctionId.toString());

    expect(bids.length).toBe(3);
    expect(bids[0]!.sequence).toBe(1);
    expect(bids[1]!.sequence).toBe(2);
    expect(bids[2]!.sequence).toBe(3);
  });

  it('findLatestBid returns the highest sequence bid', async () => {
    await bidRepo.createBid(makeBidDTO(1000, 'c1', 1));
    await bidRepo.createBid(makeBidDTO(2000, 'c2', 2));

    const latest = await bidRepo.findLatestBid(auctionId.toString());
    expect(latest!.sequence).toBe(2);
    expect(latest!.amount).toBe(2000);
  });
});
