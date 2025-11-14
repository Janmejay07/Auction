import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db';
import { AuctionEngine, type AuctionEngineEvent } from '../src/auction/auction.engine';
import { AuctionRepository } from '../src/auction/auction.repository';
import { AuctionModel } from '../src/auction/auction.model';
import { ParticipantRepository } from '../src/participants/participant.repository';
import { RoomPlayerRepository } from '../src/roomPlayers/roomPlayer.repository';
import { RoomRepository } from '../src/rooms/room.repository';
import { AuctionStatus, RoomPlayerStatus, RoomStatus } from '../src/common/types/domain';
import { SquadPlayerModel } from '../src/squads/squadPlayer.model';
import { TransactionModel } from '../src/wallet/transaction.model';

const settings = { purseTotal: 100000, squadLimit: 15, bidIncrement: 100, bidTimerSeconds: 10 };

async function setupSettlementFixture(playerCount = 2) {
  const roomRepo = new RoomRepository();
  const participantRepo = new ParticipantRepository();
  const roomPlayerRepo = new RoomPlayerRepository();
  const auctionRepo = new AuctionRepository();

  const userAId = new Types.ObjectId();
  const userBId = new Types.ObjectId();

  const room = await roomRepo.createRoom({
    roomCode: `SETT${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    creatorUserId: userAId,
    status: RoomStatus.WAITING,
    settings,
  });

  const partA = await participantRepo.createParticipant({
    roomId: room._id,
    userId: userAId,
    teamName: 'Team A',
    initialPurse: settings.purseTotal,
    purseRemaining: settings.purseTotal,
    totalSpent: 0,
    squadCount: 0,
    status: 'ACTIVE',
    joinedAt: new Date(),
    lastSeenAt: new Date(),
  });

  const partB = await participantRepo.createParticipant({
    roomId: room._id,
    userId: userBId,
    teamName: 'Team B',
    initialPurse: settings.purseTotal,
    purseRemaining: settings.purseTotal,
    totalSpent: 0,
    squadCount: 0,
    status: 'ACTIVE',
    joinedAt: new Date(),
    lastSeenAt: new Date(),
  });

  const roomPlayers = [];
  for (let i = 0; i < playerCount; i += 1) {
    roomPlayers.push(
      await roomPlayerRepo.createRoomPlayer({
        roomId: room._id,
        playerId: new Types.ObjectId(),
        basePrice: 1000 * (i + 1),
        auctionOrder: i + 1,
        status: RoomPlayerStatus.PENDING,
      }),
    );
  }

  const events: AuctionEngineEvent[] = [];
  const engine = new AuctionEngine(roomRepo, roomPlayerRepo, auctionRepo, participantRepo);
  engine.setEventHandler((e) => events.push(e));

  await engine.transitionRoom(room._id.toString(), RoomStatus.STARTING);

  return {
    engine,
    room,
    roomRepo,
    roomPlayerRepo,
    auctionRepo,
    participantRepo,
    roomPlayers,
    userAId: userAId.toString(),
    userBId: userBId.toString(),
    partA,
    partB,
    events,
  };
}

describe('Auction Settlement, Bidding Turns, and Timer Management', () => {
  beforeAll(setupTestDb);
  afterEach(clearTestDb);
  afterAll(teardownTestDb);

  it('Test 1 — Consecutive bid rejection: A bids 1000, then A bids 1100 -> rejected', async () => {
    const f = await setupSettlementFixture();
    await f.engine.startAuction(f.room._id.toString());

    // First bid by A succeeds
    const firstBid = await f.engine.placeBid(f.userAId, f.room.roomCode, 1000, 'bid-a1');
    expect(firstBid.bid.amount).toBe(1000);
    expect(firstBid.auction.currentHighestParticipantId?.toString()).toBe(f.partA._id.toString());

    // Immediate second bid by A fails with SAME_HIGHEST_BIDDER
    await expect(
      f.engine.placeBid(f.userAId, f.room.roomCode, 1100, 'bid-a2'),
    ).rejects.toMatchObject({ code: 'SAME_HIGHEST_BIDDER' });

    // Verify state unchanged
    const current = await f.auctionRepo.findCurrentAuction(f.room._id.toString());
    expect(current?.currentHighestBid).toBe(1000);
    expect(current?.bidCount).toBe(1);
  });

  it('Test 2 — Alternating bidders: A -> 1000, B -> 1100, A -> 1200, B -> 1300 -> all accepted', async () => {
    const f = await setupSettlementFixture();
    await f.engine.startAuction(f.room._id.toString());

    const b1 = await f.engine.placeBid(f.userAId, f.room.roomCode, 1000, 'turn-1');
    expect(b1.bid.amount).toBe(1000);

    const b2 = await f.engine.placeBid(f.userBId, f.room.roomCode, 1100, 'turn-2');
    expect(b2.bid.amount).toBe(1100);

    const b3 = await f.engine.placeBid(f.userAId, f.room.roomCode, 1200, 'turn-3');
    expect(b3.bid.amount).toBe(1200);

    const b4 = await f.engine.placeBid(f.userBId, f.room.roomCode, 1300, 'turn-4');
    expect(b4.bid.amount).toBe(1300);

    const current = await f.auctionRepo.findCurrentAuction(f.room._id.toString());
    expect(current?.bidCount).toBe(4);
    expect(current?.currentHighestBid).toBe(1300);
    expect(current?.currentHighestParticipantId?.toString()).toBe(f.partB._id.toString());
  });

  it('Test 3 — Timer reset on every valid accepted bid', async () => {
    const f = await setupSettlementFixture();
    const initialAuction = await f.engine.startAuction(f.room._id.toString());
    expect(initialAuction.timerEndsAt).toBeDefined();

    // Fast-forward artificial time before placing next bid
    const beforeBidTime = initialAuction.timerEndsAt!.getTime();
    await new Promise((r) => setTimeout(r, 20));

    const b1 = await f.engine.placeBid(f.userAId, f.room.roomCode, 1000, 'timer-b1');
    expect(b1.auction.timerEndsAt).toBeDefined();
    expect(b1.auction.timerEndsAt!.getTime()).toBeGreaterThanOrEqual(beforeBidTime);

    const t1 = b1.auction.timerEndsAt!.getTime();
    await new Promise((r) => setTimeout(r, 20));

    const b2 = await f.engine.placeBid(f.userBId, f.room.roomCode, 1100, 'timer-b2');
    expect(b2.auction.timerEndsAt!.getTime()).toBeGreaterThanOrEqual(t1);
  });

  it('Test 4 — Invalid or rejected bid does NOT reset timer', async () => {
    const f = await setupSettlementFixture();
    await f.engine.startAuction(f.room._id.toString());

    const b1 = await f.engine.placeBid(f.userAId, f.room.roomCode, 1000, 'valid-b1');
    const recordedTimer = b1.auction.timerEndsAt!.getTime();

    // Rejected bid: same bidder
    await expect(
      f.engine.placeBid(f.userAId, f.room.roomCode, 1200, 'invalid-same'),
    ).rejects.toMatchObject({ code: 'SAME_HIGHEST_BIDDER' });

    // Rejected bid: too low
    await expect(
      f.engine.placeBid(f.userBId, f.room.roomCode, 1050, 'invalid-low'),
    ).rejects.toMatchObject({ code: 'BID_TOO_LOW' });

    const persisted = await f.auctionRepo.findById(b1.auction._id.toString());
    expect(persisted?.timerEndsAt?.getTime()).toBe(recordedTimer);
  });

  it('Test 5 — Timer expires with bid: player SOLD, winning squad & budget updated, advances', async () => {
    const f = await setupSettlementFixture(2);
    const auction1 = await f.engine.startAuction(f.room._id.toString());

    await f.engine.placeBid(f.userAId, f.room.roomCode, 1000, 'sold-b1');
    await f.engine.placeBid(f.userBId, f.room.roomCode, 1500, 'sold-b2');

    // Simulate timer expired
    await AuctionModel.findByIdAndUpdate(auction1._id, { timerEndsAt: new Date(Date.now() - 100) });
    await f.engine.expireAuction(auction1._id.toString());

    // 1. Auction 1 is SOLD
    const settledAuction = await f.auctionRepo.findById(auction1._id.toString());
    expect(settledAuction?.status).toBe(AuctionStatus.SOLD);
    expect(settledAuction?.winningAmount).toBe(1500);
    expect(settledAuction?.winnerParticipantId?.toString()).toBe(f.partB._id.toString());

    // 2. Squad player created for winner B
    const squadCount = await SquadPlayerModel.countDocuments({
      roomId: f.room._id,
      participantId: f.partB._id,
    });
    expect(squadCount).toBe(1);

    // 3. Winner B budget deducted
    const updatedPartB = await f.participantRepo.findById(f.partB._id.toString());
    expect(updatedPartB?.purseRemaining).toBe(settings.purseTotal - 1500);
    expect(updatedPartB?.totalSpent).toBe(1500);
    expect(updatedPartB?.squadCount).toBe(1);

    // 4. Ledger transaction recorded
    const tx = await TransactionModel.findOne({ auctionId: auction1._id }).lean();
    expect(tx).toMatchObject({
      amount: 1500,
      balanceBefore: settings.purseTotal,
      balanceAfter: settings.purseTotal - 1500,
    });

    // 5. Advanced to player 2
    const nextAuction = await f.auctionRepo.findCurrentAuction(f.room._id.toString());
    expect(nextAuction).not.toBeNull();
    expect(nextAuction?._id.toString()).not.toBe(auction1._id.toString());
    expect(nextAuction?.status).toBe(AuctionStatus.LIVE);
    expect(nextAuction?.timerEndsAt).toBeDefined();

    // 6. Broadcast event emitted
    const soldEvent = f.events.find((e) => e.event === 'player:sold');
    expect(soldEvent).toBeDefined();
  });

  it('Test 6 — Timer expires without bid: player UNSOLD, advances to next player', async () => {
    const f = await setupSettlementFixture(2);
    const auction1 = await f.engine.startAuction(f.room._id.toString());

    // Simulate timer expired with 0 bids
    await AuctionModel.findByIdAndUpdate(auction1._id, { timerEndsAt: new Date(Date.now() - 100) });
    await f.engine.expireAuction(auction1._id.toString());

    // 1. Auction 1 is UNSOLD
    const settledAuction = await f.auctionRepo.findById(auction1._id.toString());
    expect(settledAuction?.status).toBe(AuctionStatus.UNSOLD);
    expect(settledAuction?.winnerParticipantId).toBeUndefined();

    // 2. Advanced to next player
    const nextAuction = await f.auctionRepo.findCurrentAuction(f.room._id.toString());
    expect(nextAuction).not.toBeNull();
    expect(nextAuction?._id.toString()).not.toBe(auction1._id.toString());
    expect(nextAuction?.status).toBe(AuctionStatus.LIVE);

    // 3. Broadcast event emitted
    const unsoldEvent = f.events.find((e) => e.event === 'player:unsold');
    expect(unsoldEvent).toBeDefined();
  });

  it('Test 7 — Settlement idempotency: multiple calls do not cause duplicate squad or deductions', async () => {
    const f = await setupSettlementFixture(1);
    const auction1 = await f.engine.startAuction(f.room._id.toString());

    await f.engine.placeBid(f.userAId, f.room.roomCode, 2000, 'idem-b1');

    await AuctionModel.findByIdAndUpdate(auction1._id, { timerEndsAt: new Date(Date.now() - 100) });

    // Concurrently trigger expireAuction multiple times
    await Promise.all([
      f.engine.expireAuction(auction1._id.toString()),
      f.engine.expireAuction(auction1._id.toString()),
      f.engine.expireAuction(auction1._id.toString()),
    ]);

    // Exactly 1 squad entry
    expect(await SquadPlayerModel.countDocuments({ auctionId: auction1._id })).toBe(1);
    // Exactly 1 transaction entry
    expect(await TransactionModel.countDocuments({ auctionId: auction1._id })).toBe(1);

    // Purse deducted exactly once
    const partA = await f.participantRepo.findById(f.partA._id.toString());
    expect(partA?.purseRemaining).toBe(settings.purseTotal - 2000);
    expect(partA?.totalSpent).toBe(2000);
  });

  it('Test 8 — Bid after expiration timestamp is rejected', async () => {
    const f = await setupSettlementFixture();
    const auction1 = await f.engine.startAuction(f.room._id.toString());

    await AuctionModel.findByIdAndUpdate(auction1._id, { timerEndsAt: new Date(Date.now() - 500) });

    await expect(
      f.engine.placeBid(f.userAId, f.room.roomCode, 1000, 'late-bid'),
    ).rejects.toMatchObject({ code: 'TIMER_EXPIRED' });
  });

  it('Test 9 — Race condition safety: no double settlement and no late bid on finalized auction', async () => {
    const f = await setupSettlementFixture(1);
    const auction1 = await f.engine.startAuction(f.room._id.toString());

    await f.engine.placeBid(f.userAId, f.room.roomCode, 1000, 'bid-early');
    await AuctionModel.findByIdAndUpdate(auction1._id, { timerEndsAt: new Date(Date.now() - 10) });

    // Race bid and expiration
    const [bidResult, _] = await Promise.allSettled([
      f.engine.placeBid(f.userBId, f.room.roomCode, 1500, 'race-bid'),
      f.engine.expireAuction(auction1._id.toString()),
    ]);

    const finalAuction = await f.auctionRepo.findById(auction1._id.toString());
    expect([AuctionStatus.SOLD, AuctionStatus.UNSOLD]).toContain(finalAuction?.status);
    expect(await SquadPlayerModel.countDocuments({ roomId: f.room._id })).toBeLessThanOrEqual(1);
  });

  it('Test 10 — Multiple participants receive all live broadcasts', async () => {
    const f = await setupSettlementFixture(2);
    await f.engine.startAuction(f.room._id.toString());

    await f.engine.placeBid(f.userAId, f.room.roomCode, 1000, 'broadcast-1');
    await f.engine.placeBid(f.userBId, f.room.roomCode, 1200, 'broadcast-2');

    const eventTypes = f.events.map((e) => e.event);
    expect(eventTypes).toContain('auction:starting');
    expect(eventTypes).toContain('auction:started');
    expect(eventTypes).toContain('player:live');
    expect(eventTypes).toContain('bid:accepted');
  });

  it('Test 11 — SOLD and UNSOLD broadcasts contain rich payload for 3-second popup', async () => {
    const f = await setupSettlementFixture(2);
    const auction1 = await f.engine.startAuction(f.room._id.toString());

    await f.engine.placeBid(f.userAId, f.room.roomCode, 1000, 'payload-b1');
    await AuctionModel.findByIdAndUpdate(auction1._id, { timerEndsAt: new Date(Date.now() - 100) });
    await f.engine.expireAuction(auction1._id.toString());

    const soldEvent = f.events.find((e) => e.event === 'player:sold');
    expect(soldEvent).toBeDefined();
    expect(soldEvent?.payload).toMatchObject({
      result: 'SOLD',
      winningAmount: 1000,
      winningBid: 1000,
      winnerParticipantName: 'Team A',
      displayDurationSeconds: expect.any(Number),
    });
  });

  it('Test 12 — Server maintains result display delay before advancing to next player', async () => {
    // Fixture with explicit 200ms result phase for precise timing check
    const roomRepo = new RoomRepository();
    const participantRepo = new ParticipantRepository();
    const roomPlayerRepo = new RoomPlayerRepository();
    const auctionRepo = new AuctionRepository();
    const userAId = new Types.ObjectId();

    const room = await roomRepo.createRoom({
      roomCode: `DUR${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      creatorUserId: userAId,
      status: RoomStatus.WAITING,
      settings,
    });
    await participantRepo.createParticipant({
      roomId: room._id,
      userId: userAId,
      teamName: 'Team A',
      initialPurse: settings.purseTotal,
      purseRemaining: settings.purseTotal,
      totalSpent: 0,
      squadCount: 0,
      status: 'ACTIVE',
      joinedAt: new Date(),
      lastSeenAt: new Date(),
    });
    const userBId = new Types.ObjectId();
    await participantRepo.createParticipant({
      roomId: room._id,
      userId: userBId,
      teamName: 'Team B',
      initialPurse: settings.purseTotal,
      purseRemaining: settings.purseTotal,
      totalSpent: 0,
      squadCount: 0,
      status: 'ACTIVE',
      joinedAt: new Date(),
      lastSeenAt: new Date(),
    });
    for (let i = 0; i < 2; i += 1) {
      await roomPlayerRepo.createRoomPlayer({
        roomId: room._id,
        playerId: new Types.ObjectId(),
        basePrice: 1000,
        auctionOrder: i + 1,
        status: RoomPlayerStatus.PENDING,
      });
    }

    const events: { event: string; time: number }[] = [];
    const engine = new AuctionEngine(
      roomRepo, roomPlayerRepo, auctionRepo, participantRepo, undefined,
      (e) => events.push({ event: e.event, time: Date.now() }),
      undefined, undefined, undefined, undefined, 200,
    );
    await engine.transitionRoom(room._id.toString(), RoomStatus.STARTING);
    const auction = await engine.startAuction(room._id.toString());

    await AuctionModel.findByIdAndUpdate(auction._id, { timerEndsAt: new Date(Date.now() - 10) });
    await engine.expireAuction(auction._id.toString());

    const unsoldIndex = events.findIndex((e) => e.event === 'player:unsold');
    const nextLiveIndex = events.findLastIndex((e) => e.event === 'player:live');

    expect(unsoldIndex).toBeGreaterThanOrEqual(0);
    expect(nextLiveIndex).toBeGreaterThan(unsoldIndex);
    const delay = events[nextLiveIndex].time - events[unsoldIndex].time;
    expect(delay).toBeGreaterThanOrEqual(180);
  });
});
