import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db';
import { RoomRepository } from '../src/rooms/room.repository';
import { ParticipantRepository } from '../src/participants/participant.repository';
import { PlayerRepository } from '../src/players/player.repository';
import { SquadPlayerRepository } from '../src/squads/squadPlayer.repository';
import { SquadPlayerModel } from '../src/squads/squadPlayer.model';
import { RoomStatus, PlayerPosition, AuctionStatus } from '../src/common/types/domain';
import { SquadService } from '../src/squads/squad.service';
import { AuctionEngine } from '../src/auction/auction.engine';
import { RoomPlayerRepository } from '../src/roomPlayers/roomPlayer.repository';
import { AuctionRepository } from '../src/auction/auction.repository';
import { AuctionModel } from '../src/auction/auction.model';

async function setupSquadFixture() {
  const roomRepo = new RoomRepository();
  const participantRepo = new ParticipantRepository();
  const playerRepo = new PlayerRepository();
  const squadRepo = new SquadPlayerRepository();

  const userAId = new Types.ObjectId();
  const userBId = new Types.ObjectId();

  const room = await roomRepo.createRoom({
    roomCode: `SQD${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    creatorUserId: userAId,
    status: RoomStatus.LIVE,
    settings: { purseTotal: 100000, squadLimit: 15, bidIncrement: 100, bidTimerSeconds: 10 },
  });

  const partA = await participantRepo.createParticipant({
    roomId: room._id,
    userId: userAId,
    teamName: 'Red Devils',
    initialPurse: 100000,
    purseRemaining: 100000,
    totalSpent: 0,
    squadCount: 0,
    status: 'ACTIVE',
    formation: '4-3-3',
    joinedAt: new Date(),
    lastSeenAt: new Date(),
  });

  const partB = await participantRepo.createParticipant({
    roomId: room._id,
    userId: userBId,
    teamName: 'Blue City',
    initialPurse: 100000,
    purseRemaining: 100000,
    totalSpent: 0,
    squadCount: 0,
    status: 'ACTIVE',
    formation: '4-4-2',
    joinedAt: new Date(),
    lastSeenAt: new Date(),
  });

  const players = [];
  for (let i = 0; i < 15; i += 1) {
    players.push(
      await playerRepo.createPlayer({
        name: `Player ${i + 1}`,
        position: i === 0 ? PlayerPosition.GK : i < 5 ? PlayerPosition.DEF : i < 10 ? PlayerPosition.MID : PlayerPosition.FWD,
        club: 'Premier FC',
        rating: 85 + (i % 5),
      }),
    );
  }

  const service = new SquadService(squadRepo, participantRepo, roomRepo, playerRepo);

  return {
    roomRepo,
    participantRepo,
    playerRepo,
    squadRepo,
    service,
    room,
    userAId: userAId.toString(),
    userBId: userBId.toString(),
    partA,
    partB,
    players,
  };
}

describe('Manager Squad Display, Starting XI, Reserves & Formations', () => {
  beforeAll(setupTestDb);
  afterEach(clearTestDb);
  afterAll(teardownTestDb);

  it('Test 1, 2, 3 — Returns purchased players categorized into Starting XI and Reserves', async () => {
    const f = await setupSquadFixture();

    // Create 3 squad players for Manager A: 2 in Starting XI, 1 in Reserve
    await f.squadRepo.createSquadPlayer({
      roomId: f.room._id,
      participantId: f.partA._id,
      playerId: f.players[0]._id,
      auctionId: new Types.ObjectId(),
      purchasePrice: 1000,
      status: 'STARTING_XI',
      purchasedAt: new Date(),
    });
    await f.squadRepo.createSquadPlayer({
      roomId: f.room._id,
      participantId: f.partA._id,
      playerId: f.players[1]._id,
      auctionId: new Types.ObjectId(),
      purchasePrice: 2000,
      status: 'STARTING_XI',
      purchasedAt: new Date(),
    });
    await f.squadRepo.createSquadPlayer({
      roomId: f.room._id,
      participantId: f.partA._id,
      playerId: f.players[2]._id,
      auctionId: new Types.ObjectId(),
      purchasePrice: 1500,
      status: 'RESERVE',
      purchasedAt: new Date(),
    });

    const squadData = await f.service.getManagerSquad(f.room.roomCode, f.partA._id.toString());
    expect(squadData.totalCount).toBe(3);
    expect(squadData.startingXICount).toBe(2);
    expect(squadData.reserveCount).toBe(1);
    expect(squadData.startingXI.map((sp) => (sp.playerId?._id ? sp.playerId._id.toString() : sp.playerId.toString()))).toContain(f.players[0]._id.toString());
    expect(squadData.reserves.map((sp) => (sp.playerId?._id ? sp.playerId._id.toString() : sp.playerId.toString()))).toContain(f.players[2]._id.toString());
  });

  it('Test 4 & 5 — Moving player between Starting XI and Reserve', async () => {
    const f = await setupSquadFixture();
    const sp = await f.squadRepo.createSquadPlayer({
      roomId: f.room._id,
      participantId: f.partA._id,
      playerId: f.players[0]._id,
      auctionId: new Types.ObjectId(),
      purchasePrice: 1000,
      status: 'RESERVE',
      purchasedAt: new Date(),
    });

    // Move Reserve -> XI
    await f.service.updatePlayerStatus(f.userAId, f.room.roomCode, f.partA._id.toString(), sp._id.toString(), 'STARTING_XI');
    let updated = await f.squadRepo.findById(sp._id.toString());
    expect(updated?.status).toBe('STARTING_XI');

    // Move XI -> Reserve
    await f.service.updatePlayerStatus(f.userAId, f.room.roomCode, f.partA._id.toString(), sp._id.toString(), 'RESERVE');
    updated = await f.squadRepo.findById(sp._id.toString());
    expect(updated?.status).toBe('RESERVE');
  });

  it('Test 6 & 13 — Enforces maximum 11 players in Starting XI', async () => {
    const f = await setupSquadFixture();

    // Fill Starting XI with 11 players
    for (let i = 0; i < 11; i += 1) {
      await f.squadRepo.createSquadPlayer({
        roomId: f.room._id,
        participantId: f.partA._id,
        playerId: f.players[i]._id,
        auctionId: new Types.ObjectId(),
        purchasePrice: 1000,
        status: 'STARTING_XI',
        purchasedAt: new Date(),
      });
    }

    // 12th player in Reserve
    const reservePlayer = await f.squadRepo.createSquadPlayer({
      roomId: f.room._id,
      participantId: f.partA._id,
      playerId: f.players[11]._id,
      auctionId: new Types.ObjectId(),
      purchasePrice: 1000,
      status: 'RESERVE',
      purchasedAt: new Date(),
    });

    // Attempting to move 12th player to Starting XI must be rejected
    await expect(
      f.service.updatePlayerStatus(f.userAId, f.room.roomCode, f.partA._id.toString(), reservePlayer._id.toString(), 'STARTING_XI'),
    ).rejects.toThrow(/Starting XI is full/);
  });

  it('Test 7 — Player cannot belong to two managers in the same room', async () => {
    const f = await setupSquadFixture();
    await f.squadRepo.createSquadPlayer({
      roomId: f.room._id,
      participantId: f.partA._id,
      playerId: f.players[0]._id,
      auctionId: new Types.ObjectId(),
      purchasePrice: 1000,
      status: 'STARTING_XI',
      purchasedAt: new Date(),
    });

    // Attempting to add same player to Manager B must fail unique constraint
    await expect(
      f.squadRepo.createSquadPlayer({
        roomId: f.room._id,
        participantId: f.partB._id,
        playerId: f.players[0]._id,
        auctionId: new Types.ObjectId(),
        purchasePrice: 1000,
        status: 'STARTING_XI',
        purchasedAt: new Date(),
      }),
    ).rejects.toThrow();
  });

  it('Test 8 — Unauthorized user cannot modify another manager squad', async () => {
    const f = await setupSquadFixture();
    const sp = await f.squadRepo.createSquadPlayer({
      roomId: f.room._id,
      participantId: f.partA._id,
      playerId: f.players[0]._id,
      auctionId: new Types.ObjectId(),
      purchasePrice: 1000,
      status: 'RESERVE',
      purchasedAt: new Date(),
    });

    // User B tries to modify Manager A's player
    await expect(
      f.service.updatePlayerStatus(f.userBId, f.room.roomCode, f.partA._id.toString(), sp._id.toString(), 'STARTING_XI'),
    ).rejects.toThrow(/not authorized/);
  });

  it('Test 9 — Auction purchase places new player into RESERVE by default', async () => {
    const roomRepo = new RoomRepository();
    const participantRepo = new ParticipantRepository();
    const roomPlayerRepo = new RoomPlayerRepository();
    const auctionRepo = new AuctionRepository();
    const squadRepo = new SquadPlayerRepository();
    const playerRepo = new PlayerRepository();

    const userAId = new Types.ObjectId();
    const room = await roomRepo.createRoom({
      roomCode: `PUR${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      creatorUserId: userAId,
      status: RoomStatus.WAITING,
      settings: { purseTotal: 100000, squadLimit: 15, bidIncrement: 100, bidTimerSeconds: 10 },
    });
    const partA = await participantRepo.createParticipant({
      roomId: room._id,
      userId: userAId,
      teamName: 'Team A',
      initialPurse: 100000,
      purseRemaining: 100000,
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
      initialPurse: 100000,
      purseRemaining: 100000,
      totalSpent: 0,
      squadCount: 0,
      status: 'ACTIVE',
      joinedAt: new Date(),
      lastSeenAt: new Date(),
    });
    const player = await playerRepo.createPlayer({
      name: 'Sold Star',
      position: PlayerPosition.FWD,
    });
    const rp = await roomPlayerRepo.createRoomPlayer({
      roomId: room._id,
      playerId: player._id,
      basePrice: 1000,
      auctionOrder: 1,
      status: 'PENDING' as any,
    });

    const engine = new AuctionEngine(
      roomRepo, roomPlayerRepo, auctionRepo, participantRepo, undefined, undefined,
      undefined, squadRepo, undefined, playerRepo, 0,
    );
    await engine.transitionRoom(room._id.toString(), RoomStatus.STARTING);
    const auction = await engine.startAuction(room._id.toString());
    await engine.placeBid(userAId.toString(), room.roomCode, 1000, 'bid-1');

    await AuctionModel.findByIdAndUpdate(auction._id, { timerEndsAt: new Date(Date.now() - 10) });
    await engine.expireAuction(auction._id.toString());

    const squadPlayer = await SquadPlayerModel.findOne({ roomId: room._id, participantId: partA._id });
    expect(squadPlayer).not.toBeNull();
    expect(squadPlayer?.status).toBe('RESERVE');
  });

  it('Test 10 — Formation is persisted and updated correctly', async () => {
    const f = await setupSquadFixture();
    const updated = await f.service.updateFormation(f.userAId, f.room.roomCode, f.partA._id.toString(), '4-2-3-1');
    expect(updated.formation).toBe('4-2-3-1');

    const persisted = await f.participantRepo.findById(f.partA._id.toString());
    expect(persisted?.formation).toBe('4-2-3-1');
  });

  it('Test 14 — Atomic swap between Starting XI and Reserve player', async () => {
    const f = await setupSquadFixture();
    const p1 = await f.squadRepo.createSquadPlayer({
      roomId: f.room._id,
      participantId: f.partA._id,
      playerId: f.players[0]._id,
      auctionId: new Types.ObjectId(),
      purchasePrice: 1000,
      status: 'STARTING_XI',
      purchasedAt: new Date(),
    });
    const p2 = await f.squadRepo.createSquadPlayer({
      roomId: f.room._id,
      participantId: f.partA._id,
      playerId: f.players[1]._id,
      auctionId: new Types.ObjectId(),
      purchasePrice: 2000,
      status: 'RESERVE',
      purchasedAt: new Date(),
    });

    await f.service.swapPlayers(f.userAId, f.room.roomCode, f.partA._id.toString(), p1._id.toString(), p2._id.toString());

    const [u1, u2] = await Promise.all([
      f.squadRepo.findById(p1._id.toString()),
      f.squadRepo.findById(p2._id.toString()),
    ]);

    expect(u1?.status).toBe('RESERVE');
    expect(u2?.status).toBe('STARTING_XI');
  });
});
