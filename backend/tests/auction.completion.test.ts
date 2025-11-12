import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db';
import { AuctionEngine, type AuctionEngineEvent } from '../src/auction/auction.engine';
import { AuctionRepository } from '../src/auction/auction.repository';
import { ParticipantRepository } from '../src/participants/participant.repository';
import { RoomPlayerRepository } from '../src/roomPlayers/roomPlayer.repository';
import { RoomRepository } from '../src/rooms/room.repository';
import { RoomService } from '../src/rooms/room.service';
import { AuctionStatus, RoomPlayerStatus, RoomStatus } from '../src/common/types/domain';
import { PlayerModel } from '../src/players/player.model';

const defaultSettings = {
  purseTotal: 10000000,
  squadLimit: 2, // small limit for testing full squad condition easily
  bidIncrement: 100000,
  bidTimerSeconds: 5,
};

describe('Auction Completion Rules & View-Only Mode', () => {
  let roomRepo: RoomRepository;
  let participantRepo: ParticipantRepository;
  let roomPlayerRepo: RoomPlayerRepository;
  let auctionRepo: AuctionRepository;
  let roomService: RoomService;
  let engine: AuctionEngine;
  let emittedEvents: AuctionEngineEvent[] = [];

  beforeAll(async () => {
    await setupTestDb();
    roomRepo = new RoomRepository();
    participantRepo = new ParticipantRepository();
    roomPlayerRepo = new RoomPlayerRepository();
    auctionRepo = new AuctionRepository();
    engine = new AuctionEngine(
      roomRepo,
      roomPlayerRepo,
      auctionRepo,
      participantRepo,
      undefined,
      (event) => emittedEvents.push(event),
      undefined,
      undefined,
      undefined,
      undefined,
      50,
    );

    roomService = new RoomService(roomRepo, participantRepo, roomPlayerRepo, undefined, engine);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  afterEach(async () => {
    emittedEvents = [];
    await clearTestDb();
  });

  async function createTestPlayer(name: string, position: 'GK' | 'MID' | 'FWD', club: string) {
    return PlayerModel.create({
      name,
      position,
      club,
      overallRating: 85,
      basePrice: 1000000,
    });
  }

  async function setupFixture(participantCount = 2, playerCount = 3, squadLimit = 2) {
    const creatorId = new Types.ObjectId();
    const settings = { ...defaultSettings, squadLimit };

    const room = await roomRepo.createRoom({
      roomCode: `CMP${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      creatorUserId: creatorId,
      status: RoomStatus.WAITING,
      settings,
    });

    const participants = [];
    const creatorPart = await participantRepo.createParticipant({
      roomId: room._id,
      userId: creatorId,
      teamName: 'Manager 1',
      initialPurse: settings.purseTotal,
      purseRemaining: settings.purseTotal,
      totalSpent: 0,
      squadCount: 0,
      status: 'ACTIVE',
      joinedAt: new Date(),
      lastSeenAt: new Date(),
    });
    participants.push(creatorPart);

    for (let i = 2; i <= participantCount; i++) {
      const uId = new Types.ObjectId();
      const p = await participantRepo.createParticipant({
        roomId: room._id,
        userId: uId,
        teamName: `Manager ${i}`,
        initialPurse: settings.purseTotal,
        purseRemaining: settings.purseTotal,
        totalSpent: 0,
        squadCount: 0,
        status: 'ACTIVE',
        joinedAt: new Date(),
        lastSeenAt: new Date(),
      });
      participants.push(p);
    }

    const roomPlayers = [];
    for (let i = 1; i <= playerCount; i++) {
      const pl = await createTestPlayer(`Player ${i}`, 'MID', 'Arsenal');
      const rp = await roomPlayerRepo.createRoomPlayer({
        roomId: room._id,
        playerId: pl._id,
        basePrice: 1000000,
        auctionOrder: i,
        status: RoomPlayerStatus.PENDING,
      });
      roomPlayers.push(rp);
    }

    return { room, participants, roomPlayers };
  }

  it('Test 1 — Starting auction with 1 active participant completes immediately with NOT_ENOUGH_PLAYERS', async () => {
    const { room } = await setupFixture(1, 3); // Only 1 participant

    await expect(engine.startAuction(room._id.toString())).rejects.toThrow(
      /At least 2 active participants are required/,
    );

    const updatedRoom = await roomRepo.findById(room._id.toString());
    expect(updatedRoom?.status).toBe(RoomStatus.COMPLETED);

    const completedEvent = emittedEvents.find((e) => e.event === 'auction:completed');
    expect(completedEvent).toBeDefined();
    expect((completedEvent?.payload as any)?.reason).toBe('NOT_ENOUGH_PLAYERS');
  });

  it('Test 2 — Starting auction with 2 active participants succeeds and creates LIVE auction', async () => {
    const { room } = await setupFixture(2, 3);
    await engine.transitionRoom(room._id.toString(), RoomStatus.STARTING);

    const auction = await engine.startAuction(room._id.toString());
    expect(auction).toBeDefined();
    expect(auction.status).toBe(AuctionStatus.LIVE);

    const updatedRoom = await roomRepo.findById(room._id.toString());
    expect(updatedRoom?.status).toBe(RoomStatus.LIVE);
  });

  it('Test 3 — When a participant leaves during live auction and active participants drops to 1, completes auction', async () => {
    const { room, participants } = await setupFixture(2, 3);
    await engine.transitionRoom(room._id.toString(), RoomStatus.STARTING);
    await engine.startAuction(room._id.toString());

    // Participant 2 leaves
    await roomService.leaveRoom(participants[1].userId.toString(), room.roomCode);

    const updatedRoom = await roomRepo.findById(room._id.toString());
    expect(updatedRoom?.status).toBe(RoomStatus.COMPLETED);

    const completedEvent = emittedEvents.find((e) => e.event === 'auction:completed');
    expect(completedEvent).toBeDefined();
    expect((completedEvent?.payload as any)?.reason).toBe('NOT_ENOUGH_PLAYERS');
  });

  it('Test 4 — When all squads are full before start, completes immediately with ALL_SQUADS_FULL', async () => {
    const { room, participants } = await setupFixture(2, 3, 2);
    await engine.transitionRoom(room._id.toString(), RoomStatus.STARTING);

    // Fill both participants squads to limit (2/2)
    await participantRepo.updateStatus(participants[0]._id.toString(), 'ACTIVE', { squadCount: 2 });
    await participantRepo.updateStatus(participants[1]._id.toString(), 'ACTIVE', { squadCount: 2 });

    await expect(engine.startAuction(room._id.toString())).rejects.toThrow(/squads are full/);

    const updatedRoom = await roomRepo.findById(room._id.toString());
    expect(updatedRoom?.status).toBe(RoomStatus.COMPLETED);

    const completedEvent = emittedEvents.find((e) => e.event === 'auction:completed');
    expect(completedEvent).toBeDefined();
    expect((completedEvent?.payload as any)?.reason).toBe('ALL_SQUADS_FULL');
  });

  it('Test 5 — When one squad has space (2/2 and 1/2), auction continues to next player', async () => {
    const { room, participants } = await setupFixture(2, 3, 2);
    await engine.transitionRoom(room._id.toString(), RoomStatus.STARTING);

    // Participant 0 is full (2/2), Participant 1 has space (1/2)
    await participantRepo.updateStatus(participants[0]._id.toString(), 'ACTIVE', { squadCount: 2 });
    await participantRepo.updateStatus(participants[1]._id.toString(), 'ACTIVE', { squadCount: 1 });

    const auction = await engine.startAuction(room._id.toString());
    expect(auction.status).toBe(AuctionStatus.LIVE);

    const updatedRoom = await roomRepo.findById(room._id.toString());
    expect(updatedRoom?.status).toBe(RoomStatus.LIVE);
  });

  it('Test 6 — Full manager cannot place a bid and receives SQUAD_FULL error', async () => {
    const { room, participants } = await setupFixture(2, 3, 2);
    await engine.transitionRoom(room._id.toString(), RoomStatus.STARTING);
    await participantRepo.updateStatus(participants[0]._id.toString(), 'ACTIVE', { squadCount: 2 }); // Full

    await engine.startAuction(room._id.toString());

    // Full manager attempts to place bid
    await expect(
      engine.placeBid(
        participants[0].userId.toString(),
        room.roomCode,
        1500000,
        'bid-client-full-test',
      ),
    ).rejects.toThrow(/Your squad is full and you cannot bid on another player/);
  });

  it('Test 7 — Winning player fills last available slot across all managers, completing the auction', async () => {
    // Room with squadLimit = 1, 2 managers
    const { room, participants } = await setupFixture(2, 5, 1);
    await engine.transitionRoom(room._id.toString(), RoomStatus.STARTING);

    // Manager 0 already has 1/1, Manager 1 has 0/1
    await participantRepo.updateStatus(participants[0]._id.toString(), 'ACTIVE', { squadCount: 1 });

    const auction = await engine.startAuction(room._id.toString());

    // Manager 1 bids and wins
    await engine.placeBid(
      participants[1].userId.toString(),
      room.roomCode,
      1000000,
      'bid-winning-slot',
    );

    // Expire auction -> settle sold -> advance
    await auctionRepo.applyBid(
      auction._id.toString(),
      2,
      1000000,
      participants[1]._id,
      1,
      new Date(Date.now() - 1000),
    );
    await engine.expireAuction(auction._id.toString());

    // Manager 1 now has 1/1
    const p1 = await participantRepo.findById(participants[1]._id.toString());
    expect(p1?.squadCount).toBe(1);

    // Both managers are 1/1 -> all squads full -> auction completed!
    const updatedRoom = await roomRepo.findById(room._id.toString());
    expect(updatedRoom?.status).toBe(RoomStatus.COMPLETED);

    const completedEvent = emittedEvents.find((e) => e.event === 'auction:completed');
    expect(completedEvent).toBeDefined();
    expect((completedEvent?.payload as any)?.reason).toBe('ALL_SQUADS_FULL');
  });

  it('Test 8 & 9 — View-only check helper reports eligibleManagers correctly', async () => {
    const { room, participants } = await setupFixture(3, 5, 2);

    await participantRepo.updateStatus(participants[0]._id.toString(), 'ACTIVE', { squadCount: 2 }); // Full
    await participantRepo.updateStatus(participants[1]._id.toString(), 'ACTIVE', { squadCount: 1 }); // Space
    await participantRepo.updateStatus(participants[2]._id.toString(), 'INACTIVE', { squadCount: 0 }); // Inactive

    const status = await engine.checkCompletionStatus(room._id.toString(), room.settings.squadLimit);
    expect(status.shouldComplete).toBe(false);
    expect(status.activeParticipants.length).toBe(2);
    expect(status.eligibleManagers.length).toBe(1);
    expect(status.eligibleManagers[0]._id.toString()).toBe(participants[1]._id.toString());
  });

  it('Test 10 — Completion idempotency: multiple concurrent completion triggers emit auction:completed exactly once', async () => {
    const { room } = await setupFixture(2, 3);
    await engine.transitionRoom(room._id.toString(), RoomStatus.STARTING);
    await engine.startAuction(room._id.toString());

    // Call completeAuction concurrently 5 times
    await Promise.all([
      engine.completeAuction(room._id.toString(), 'ALL_SQUADS_FULL'),
      engine.completeAuction(room._id.toString(), 'ALL_SQUADS_FULL'),
      engine.completeAuction(room._id.toString(), 'NOT_ENOUGH_PLAYERS'),
      engine.completeAuction(room._id.toString(), 'NO_PLAYERS_REMAINING'),
      engine.completeAuction(room._id.toString(), 'ALL_SQUADS_FULL'),
    ]);

    const completedEvents = emittedEvents.filter((e) => e.event === 'auction:completed');
    expect(completedEvents.length).toBe(1);

    const updatedRoom = await roomRepo.findById(room._id.toString());
    expect(updatedRoom?.status).toBe(RoomStatus.COMPLETED);
  });
});
