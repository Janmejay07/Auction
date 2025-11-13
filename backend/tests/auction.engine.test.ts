import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db';
import { AuctionEngine } from '../src/auction/auction.engine';
import { AuctionRepository } from '../src/auction/auction.repository';
import { AuctionModel } from '../src/auction/auction.model';
import { ParticipantRepository } from '../src/participants/participant.repository';
import { RoomPlayerRepository } from '../src/roomPlayers/roomPlayer.repository';
import { RoomRepository } from '../src/rooms/room.repository';
import { AuctionStatus, RoomPlayerStatus, RoomStatus } from '../src/common/types/domain';
import { AuctionEventRepository } from '../src/events/auctionEvent.repository';
import { ParticipantModel } from '../src/participants/participant.model';
import { SquadPlayerModel } from '../src/squads/squadPlayer.model';
import { TransactionModel } from '../src/wallet/transaction.model';
import { AuctionEventModel } from '../src/events/auctionEvent.model';

const settings = { purseTotal: 100000, squadLimit: 15, bidIncrement: 100, bidTimerSeconds: 5 };

async function fixture(playerCount = 1) {
  const roomRepo = new RoomRepository();
  const participantRepo = new ParticipantRepository();
  const roomPlayerRepo = new RoomPlayerRepository();
  const auctionRepo = new AuctionRepository();
  const creatorId = new Types.ObjectId();
  const secondUserId = new Types.ObjectId();
  const room = await roomRepo.createRoom({ roomCode: `ENG${Math.random().toString(36).slice(2, 7).toUpperCase()}`, creatorUserId: creatorId, status: RoomStatus.WAITING, settings });
  await participantRepo.createParticipant({
    roomId: room._id, userId: creatorId, teamName: 'Engine Team', initialPurse: settings.purseTotal,
    purseRemaining: settings.purseTotal, totalSpent: 0, squadCount: 0, status: 'ACTIVE', joinedAt: new Date(), lastSeenAt: new Date(),
  });
  await participantRepo.createParticipant({
    roomId: room._id, userId: secondUserId, teamName: 'Engine Team 2', initialPurse: settings.purseTotal,
    purseRemaining: settings.purseTotal, totalSpent: 0, squadCount: 0, status: 'ACTIVE', joinedAt: new Date(), lastSeenAt: new Date(),
  });
  const roomPlayers = [];
  for (let index = 0; index < playerCount; index += 1) {
    roomPlayers.push(await roomPlayerRepo.createRoomPlayer({
      roomId: room._id, playerId: new Types.ObjectId(), basePrice: 100 + index * 100,
      auctionOrder: index + 1, status: RoomPlayerStatus.PENDING,
    }));
  }
  const engine = new AuctionEngine(roomRepo, roomPlayerRepo, auctionRepo, participantRepo);
  await engine.transitionRoom(room._id.toString(), RoomStatus.STARTING);
  const participant = await participantRepo.findParticipant(room._id.toString(), creatorId.toString());
  return { engine, room, roomRepo, roomPlayerRepo, auctionRepo, participantRepo, roomPlayers, creatorId, secondUserId, participantId: participant!._id };
}

describe('AuctionEngine', () => {
  beforeAll(setupTestDb);
  afterEach(clearTestDb);
  afterAll(teardownTestDb);

  it('creates the first live auction with the required initial state', async () => {
    const fixtureData = await fixture();
    const auction = await fixtureData.engine.startAuction(fixtureData.room._id.toString());
    expect(auction.status).toBe(AuctionStatus.LIVE);
    expect(auction.currentHighestBid).toBe(100);
    expect(auction.currentHighestParticipantId).toBeNull();
    expect(auction.hasStartedBidding).toBe(false);
    expect(auction.timerEndsAt).toBeDefined();
    expect(auction.version).toBe(1);
    expect((await fixtureData.roomRepo.findById(fixtureData.room._id.toString()))!.status).toBe(RoomStatus.LIVE);
  });

  it('starts and resets inactivity timers only for valid higher bids', async () => {
    const fixtureData = await fixture();
    const otherParticipantId = new Types.ObjectId();
    await fixtureData.participantRepo.createParticipant({
      roomId: fixtureData.room._id, userId: otherParticipantId, teamName: 'Other Team',
      initialPurse: settings.purseTotal, purseRemaining: settings.purseTotal, totalSpent: 0,
      squadCount: 0, status: 'ACTIVE', joinedAt: new Date(), lastSeenAt: new Date(),
    });
    await fixtureData.engine.startAuction(fixtureData.room._id.toString());
    const first = await fixtureData.engine.placeBid(fixtureData.creatorId.toString(), fixtureData.room.roomCode, 100, 'first');
    expect(first.auction.hasStartedBidding).toBe(true);
    expect(first.auction.timerEndsAt).toBeDefined();
    const firstTimer = first.auction.timerEndsAt!.getTime();
    const second = await fixtureData.engine.placeBid(otherParticipantId.toString(), fixtureData.room.roomCode, 200, 'second');
    expect(second.auction.timerEndsAt!.getTime()).toBeGreaterThanOrEqual(firstTimer);
    const resetTimer = second.auction.timerEndsAt!.getTime();
    await expect(fixtureData.engine.placeBid(fixtureData.creatorId.toString(), fixtureData.room.roomCode, 250, 'rejected')).rejects.toMatchObject({ code: 'BID_TOO_LOW' });
    expect((await fixtureData.auctionRepo.findById(second.auction._id.toString()))!.timerEndsAt!.getTime()).toBe(resetTimer);
  });

  it('rejects consecutive bids from the current highest bidder', async () => {
    const fixtureData = await fixture();
    await fixtureData.engine.startAuction(fixtureData.room._id.toString());
    await fixtureData.engine.placeBid(fixtureData.creatorId.toString(), fixtureData.room.roomCode, 100, 'first-bid');
    await expect(fixtureData.engine.placeBid(fixtureData.creatorId.toString(), fixtureData.room.roomCode, 200, 'second-bid'))
      .rejects.toMatchObject({ code: 'SAME_HIGHEST_BIDDER' });
  });

  it('finalizes an auction as UNSOLD and advances to the next player', async () => {
    const fixtureData = await fixture(2);
    const first = await fixtureData.engine.startAuction(fixtureData.room._id.toString());
    await AuctionModel.findByIdAndUpdate(first._id, { timerEndsAt: new Date(Date.now() - 1) });
    await fixtureData.engine.expireAuction(first._id.toString());
    const next = await fixtureData.auctionRepo.findCurrentAuction(fixtureData.room._id.toString());
    expect((await fixtureData.auctionRepo.findById(first._id.toString()))!.status).toBe(AuctionStatus.UNSOLD);
    expect(next).not.toBeNull();
    expect(next!.roomPlayerId.toString()).toBe(fixtureData.roomPlayers[1]!._id.toString());
  });

  it('finalizes SOLD auctions and completes the room after the final player', async () => {
    const fixtureData = await fixture();
    const auction = await fixtureData.engine.startAuction(fixtureData.room._id.toString());
    await fixtureData.engine.placeBid(fixtureData.creatorId.toString(), fixtureData.room.roomCode, 100, 'winner');
    await AuctionModel.findByIdAndUpdate(auction._id, { timerEndsAt: new Date(Date.now() - 1) });
    await fixtureData.engine.expireAuction(auction._id.toString());
    expect((await fixtureData.auctionRepo.findById(auction._id.toString()))!.status).toBe(AuctionStatus.SOLD);
    expect((await fixtureData.roomRepo.findById(fixtureData.room._id.toString()))!.status).toBe(RoomStatus.COMPLETED);
  });

  it('deducts the purse, creates the squad player, ledger entry, and sold event', async () => {
    const fixtureData = await fixture();
    const auction = await fixtureData.engine.startAuction(fixtureData.room._id.toString());
    await fixtureData.engine.placeBid(fixtureData.creatorId.toString(), fixtureData.room.roomCode, 300, 'purchase');
    await AuctionModel.findByIdAndUpdate(auction._id, { timerEndsAt: new Date(Date.now() - 1) });

    await fixtureData.engine.expireAuction(auction._id.toString());

    const participant = await fixtureData.participantRepo.findById(fixtureData.participantId.toString());
    expect(participant).toMatchObject({ purseRemaining: 99700, totalSpent: 300, squadCount: 1 });
    expect(await SquadPlayerModel.countDocuments({ auctionId: auction._id })).toBe(1);
    expect(await TransactionModel.findOne({ auctionId: auction._id }).lean()).toMatchObject({
      type: 'PLAYER_PURCHASE', amount: 300, balanceBefore: 100000, balanceAfter: 99700,
    });
    expect(await AuctionEventModel.countDocuments({ auctionId: auction._id, type: 'AUCTION_SOLD' })).toBe(1);
  });

  it('rolls back all finalization writes when the winner cannot pay', async () => {
    const fixtureData = await fixture();
    const auction = await fixtureData.engine.startAuction(fixtureData.room._id.toString());
    await fixtureData.engine.placeBid(fixtureData.creatorId.toString(), fixtureData.room.roomCode, 300, 'rollback');
    await ParticipantModel.findByIdAndUpdate(fixtureData.participantId, { purseRemaining: 0 });
    await AuctionModel.findByIdAndUpdate(auction._id, { timerEndsAt: new Date(Date.now() - 1) });

    await expect(fixtureData.engine.expireAuction(auction._id.toString())).rejects.toMatchObject({ code: 'INSUFFICIENT_PURCHASE_FUNDS' });
    expect((await fixtureData.auctionRepo.findById(auction._id.toString()))!.status).toBe(AuctionStatus.LIVE);
    expect((await fixtureData.roomPlayerRepo.findById(auction.roomPlayerId.toString()))!.status).toBe(RoomPlayerStatus.LIVE);
    expect(await SquadPlayerModel.countDocuments({ auctionId: auction._id })).toBe(0);
    expect(await TransactionModel.countDocuments({ auctionId: auction._id })).toBe(0);
    expect(await AuctionEventModel.countDocuments({ auctionId: auction._id, type: 'AUCTION_SOLD' })).toBe(0);
  });

  it('finalizes a concurrent expiration only once', async () => {
    const fixtureData = await fixture();
    const auction = await fixtureData.engine.startAuction(fixtureData.room._id.toString());
    await fixtureData.engine.placeBid(fixtureData.creatorId.toString(), fixtureData.room.roomCode, 300, 'concurrent-finalize');
    await AuctionModel.findByIdAndUpdate(auction._id, { timerEndsAt: new Date(Date.now() - 1) });

    await Promise.all([fixtureData.engine.expireAuction(auction._id.toString()), fixtureData.engine.expireAuction(auction._id.toString())]);

    expect((await fixtureData.auctionRepo.findById(auction._id.toString()))!.status).toBe(AuctionStatus.SOLD);
    expect(await SquadPlayerModel.countDocuments({ auctionId: auction._id })).toBe(1);
    expect(await TransactionModel.countDocuments({ auctionId: auction._id })).toBe(1);
    expect(await AuctionEventModel.countDocuments({ auctionId: auction._id, type: 'AUCTION_SOLD' })).toBe(1);
  });

  it('recovers expired live auctions on startup', async () => {
    const fixtureData = await fixture();
    await fixtureData.engine.transitionRoom(fixtureData.room._id.toString(), RoomStatus.LIVE);
    const auction = await fixtureData.auctionRepo.createAuction({
      roomId: fixtureData.room._id, roomPlayerId: fixtureData.roomPlayers[0]!._id, playerId: fixtureData.roomPlayers[0]!.playerId,
      status: AuctionStatus.LIVE, startingPrice: 100, currentHighestBid: 100, bidCount: 0, sequence: 0,
      version: 1, hasStartedBidding: false, startedAt: new Date(), timerEndsAt: new Date(Date.now() - 1),
    });
    await fixtureData.engine.recover();
    expect((await fixtureData.auctionRepo.findById(auction._id.toString()))!.status).toBe(AuctionStatus.UNSOLD);
  });

  it('rejects invalid room and auction transitions', async () => {
    const fixtureData = await fixture();
    await expect(fixtureData.engine.transitionRoom(fixtureData.room._id.toString(), RoomStatus.COMPLETED)).rejects.toMatchObject({ code: 'INVALID_ROOM_STATE' });
    const auction = await fixtureData.auctionRepo.createAuction({
      roomId: fixtureData.room._id, roomPlayerId: fixtureData.roomPlayers[0]!._id, playerId: fixtureData.roomPlayers[0]!.playerId,
      status: AuctionStatus.CREATED, startingPrice: 100, bidCount: 0, sequence: 0, version: 0,
      hasStartedBidding: false, startedAt: new Date(),
    });
    await expect(fixtureData.engine.transitionAuction(auction._id.toString(), AuctionStatus.SOLD)).rejects.toMatchObject({ code: 'INVALID_AUCTION_TRANSITION' });
  });

  it('is idempotent and records exactly one accepted bid event', async () => {
    const fixtureData = await fixture();
    await fixtureData.engine.startAuction(fixtureData.room._id.toString());
    const first = await fixtureData.engine.placeBid(fixtureData.creatorId.toString(), fixtureData.room.roomCode, 100, 'duplicate-key');
    const duplicate = await fixtureData.engine.placeBid(fixtureData.creatorId.toString(), fixtureData.room.roomCode, 100, 'duplicate-key');
    expect(duplicate.bid._id.toString()).toBe(first.bid._id.toString());
    expect((await fixtureData.auctionRepo.findById(first.auction._id.toString()))!.bidCount).toBe(1);
    expect((await new AuctionEventRepository().findByAuction(first.auction._id.toString()))
      .filter((event) => event.type === 'AUCTION_BID_PLACED')).toHaveLength(1);
  });

  it('rejects expired, unaffordable, and squad-limit bids without changing the auction', async () => {
    const fixtureData = await fixture();
    const auction = await fixtureData.engine.startAuction(fixtureData.room._id.toString());
    await AuctionModel.findByIdAndUpdate(auction._id, { timerEndsAt: new Date(Date.now() - 1) });
    await expect(fixtureData.engine.placeBid(fixtureData.creatorId.toString(), fixtureData.room.roomCode, 100, 'expired')).rejects.toMatchObject({ code: 'TIMER_EXPIRED' });
    await AuctionModel.findByIdAndUpdate(auction._id, { timerEndsAt: new Date(Date.now() + 10000) });
    await expect(fixtureData.engine.placeBid(fixtureData.creatorId.toString(), fixtureData.room.roomCode, 100001, 'poor')).rejects.toMatchObject({ code: 'INSUFFICIENT_PURSE' });
    await ParticipantModel.findByIdAndUpdate(fixtureData.participantId, { squadCount: settings.squadLimit });
    await expect(fixtureData.engine.placeBid(fixtureData.creatorId.toString(), fixtureData.room.roomCode, 100, 'full')).rejects.toMatchObject({ code: 'SQUAD_FULL' });
    const unchanged = await fixtureData.auctionRepo.findById(auction._id.toString());
    expect(unchanged!.bidCount).toBe(0);
    expect(unchanged!.timerEndsAt).toBeDefined();
  });

  it('serializes alternating bids without duplicate sequences or premature purse deduction', async () => {
    const fixtureData = await fixture();
    const otherId = new Types.ObjectId();
    await fixtureData.participantRepo.createParticipant({
      roomId: fixtureData.room._id, userId: otherId, teamName: 'Other Team',
      initialPurse: settings.purseTotal, purseRemaining: settings.purseTotal, totalSpent: 0,
      squadCount: 0, status: 'ACTIVE', joinedAt: new Date(), lastSeenAt: new Date(),
    });
    const auction = await fixtureData.engine.startAuction(fixtureData.room._id.toString());
    const users = [fixtureData.creatorId.toString(), otherId.toString()];
    const results = [];
    for (let index = 0; index < 6; index += 1) {
      results.push(await fixtureData.engine.placeBid(
        users[index % 2], fixtureData.room.roomCode, 100 + index * 100, `concurrent-${index}`,
      ));
    }
    const persisted = await fixtureData.auctionRepo.findById(auction._id.toString());
    expect(results.length).toBe(6);
    expect(new Set(results.map((r) => r.bid.sequence)).size).toBe(6);
    expect(persisted!.bidCount).toBe(6);
    expect(persisted!.sequence).toBe(6);
    expect((await fixtureData.participantRepo.findById(fixtureData.participantId.toString()))!.purseRemaining).toBe(settings.purseTotal);
  });

  it('rejects a participant from bidding in another room', async () => {
    const fixtureData = await fixture();
    await fixtureData.engine.startAuction(fixtureData.room._id.toString());
    await expect(fixtureData.engine.placeBid(new Types.ObjectId().toString(), fixtureData.room.roomCode, 100, 'foreign')).rejects.toMatchObject({ code: 'NOT_PARTICIPANT' });
  });
});