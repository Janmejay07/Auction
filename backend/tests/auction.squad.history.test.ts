import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db';
import { RoomRepository } from '../src/rooms/room.repository';
import { ParticipantRepository } from '../src/participants/participant.repository';
import { RoomPlayerRepository } from '../src/roomPlayers/roomPlayer.repository';
import { PlayerRepository } from '../src/players/player.repository';
import { SquadPlayerRepository } from '../src/squads/squadPlayer.repository';
import { SquadService } from '../src/squads/squad.service';
import { RoomService } from '../src/rooms/room.service';
import { AuctionEngine } from '../src/auction/auction.engine';
import { AuctionRepository } from '../src/auction/auction.repository';
import { RoomStatus, PlayerPosition, RoomPlayerStatus } from '../src/common/types/domain';
import { SquadPlayerModel } from '../src/squads/squadPlayer.model';

const settings = {
  purseTotal: 100000000,
  squadLimit: 11,
  bidIncrement: 100000,
  bidTimerSeconds: 5,
};

describe('Auction-Specific Final Squad & Squad History System', () => {
  let roomRepo: RoomRepository;
  let participantRepo: ParticipantRepository;
  let roomPlayerRepo: RoomPlayerRepository;
  let playerRepo: PlayerRepository;
  let squadRepo: SquadPlayerRepository;
  let auctionRepo: AuctionRepository;
  let squadService: SquadService;
  let roomService: RoomService;
  let engine: AuctionEngine;

  beforeAll(async () => {
    await setupTestDb();
    roomRepo = new RoomRepository();
    participantRepo = new ParticipantRepository();
    roomPlayerRepo = new RoomPlayerRepository();
    playerRepo = new PlayerRepository();
    squadRepo = new SquadPlayerRepository();
    auctionRepo = new AuctionRepository();
    squadService = new SquadService(squadRepo, participantRepo, roomRepo, playerRepo);
    engine = new AuctionEngine(roomRepo, roomPlayerRepo, auctionRepo, participantRepo, undefined, undefined, undefined, squadRepo, undefined, playerRepo, 50);
    roomService = new RoomService(roomRepo, participantRepo, roomPlayerRepo, playerRepo, engine);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  it('Test 1 & 2 — New auction starts fresh: Manager has full squad in Auction A, joins Auction B with 0/11 players', async () => {
    const userAId = new Types.ObjectId().toString();
    const userBId = new Types.ObjectId().toString();

    // Auction A
    const { room: roomA, participant: partA_in_A } = await roomService.createRoom(userAId, {
      teamName: 'Red Devils A',
      settings,
    });
    await roomService.joinRoom(userBId, roomA.roomCode, { teamName: 'Opponent FC' });

    // Purchase 11 players in Auction A
    for (let i = 1; i <= 11; i++) {
      const pl = await playerRepo.createPlayer({ name: `Player A${i}`, position: PlayerPosition.MID });
      await squadRepo.createSquadPlayer({
        roomId: roomA._id,
        participantId: partA_in_A._id,
        playerId: pl._id,
        auctionId: new Types.ObjectId(),
        purchasePrice: 2000000,
        status: 'STARTING_XI',
      });
    }
    await participantRepo.updateStatus(partA_in_A._id.toString(), 'ACTIVE', {
      squadCount: 11,
      purseRemaining: 78000000,
      totalSpent: 22000000,
    });

    const squadSummaryA = await squadService.getMySquad(userAId, roomA.roomCode);
    expect(squadSummaryA.squadSize).toBe(11);
    expect(squadSummaryA.purseRemaining).toBe(78000000);

    // Manager joins brand new Auction B
    const { room: roomB, participant: partA_in_B } = await roomService.createRoom(userAId, {
      teamName: 'Red Devils B',
      settings,
    });
    await roomService.joinRoom(userBId, roomB.roomCode, { teamName: 'Opponent FC 2' });

    // Auction B must start with 0/11 players and full fresh purse
    const squadSummaryB = await squadService.getMySquad(userAId, roomB.roomCode);
    expect(squadSummaryB.squadSize).toBe(0);
    expect(squadSummaryB.startingXI).toHaveLength(0);
    expect(squadSummaryB.reserves).toHaveLength(0);
    expect(squadSummaryB.purseRemaining).toBe(settings.purseTotal);
    expect(squadSummaryB.totalSpent).toBe(0);

    // Verify Auction A remains untouched (11 players)
    const squadSummaryA_after = await squadService.getMySquad(userAId, roomA.roomCode);
    expect(squadSummaryA_after.squadSize).toBe(11);
  });

  it('Test 3 & 4 — Same player can be purchased in different auctions, but unique inside one auction', async () => {
    const userAId = new Types.ObjectId().toString();
    const userBId = new Types.ObjectId().toString();

    // Global player Saka
    const saka = await playerRepo.createPlayer({ name: 'Bukayo Saka', position: PlayerPosition.MID, club: 'Arsenal' });

    // Room 1
    const { room: room1, participant: part1A } = await roomService.createRoom(userAId, { teamName: 'Team 1A', settings });
    const part1B = await roomService.joinRoom(userBId, room1.roomCode, { teamName: 'Team 1B' });

    // Room 2
    const { room: room2, participant: part2B } = await roomService.createRoom(userBId, { teamName: 'Team 2B', settings });

    // Saka purchased by User A in Room 1
    await squadRepo.createSquadPlayer({
      roomId: room1._id,
      participantId: part1A._id,
      playerId: saka._id,
      auctionId: new Types.ObjectId(),
      purchasePrice: 5000000,
      status: 'RESERVE',
    });

    // Saka purchased by User B in Room 2 (Valid across different auctions!)
    const squadPlayer2 = await squadRepo.createSquadPlayer({
      roomId: room2._id,
      participantId: part2B._id,
      playerId: saka._id,
      auctionId: new Types.ObjectId(),
      purchasePrice: 6000000,
      status: 'STARTING_XI',
    });
    expect(squadPlayer2).toBeDefined();

    // Attempting to give Saka to User B in Room 1 (duplicate in same room/auction) MUST fail!
    await expect(
      squadRepo.createSquadPlayer({
        roomId: room1._id,
        participantId: part1B._id,
        playerId: saka._id,
        auctionId: new Types.ObjectId(),
        purchasePrice: 5500000,
        status: 'RESERVE',
      }),
    ).rejects.toThrow();
  });

  it('Test 5 — Purse and spending isolation across auctions', async () => {
    const userAId = new Types.ObjectId().toString();
    const userBId = new Types.ObjectId().toString();

    const { room: roomA, participant: partA } = await roomService.createRoom(userAId, { teamName: 'Team A', settings });
    await roomService.joinRoom(userBId, roomA.roomCode, { teamName: 'Opponent' });

    const { room: roomB, participant: partB } = await roomService.createRoom(userAId, { teamName: 'Team B', settings });
    await roomService.joinRoom(userBId, roomB.roomCode, { teamName: 'Opponent 2' });

    // Deduct purse in Room A
    await participantRepo.deductPurse(partA._id.toString(), 30000000);

    const dataA = await squadService.getMySquad(userAId, roomA.roomCode);
    const dataB = await squadService.getMySquad(userAId, roomB.roomCode);

    expect(dataA.purseRemaining).toBe(70000000);
    expect(dataA.totalSpent).toBe(30000000);

    // Room B remains untouched at 100M
    expect(dataB.purseRemaining).toBe(100000000);
    expect(dataB.totalSpent).toBe(0);
  });

  it('Test 6 & 7 — Starting XI, Reserve, and Formation isolation', async () => {
    const userAId = new Types.ObjectId().toString();
    const userBId = new Types.ObjectId().toString();

    const { room: roomA, participant: partA } = await roomService.createRoom(userAId, { teamName: 'Team A', settings });
    await roomService.joinRoom(userBId, roomA.roomCode, { teamName: 'Opponent' });

    const { room: roomB, participant: partB } = await roomService.createRoom(userAId, { teamName: 'Team B', settings });
    await roomService.joinRoom(userBId, roomB.roomCode, { teamName: 'Opponent 2' });

    // Update formation in Room A to 4-4-2
    await squadService.updateFormation(userAId, roomA.roomCode, partA._id.toString(), '4-4-2');
    // Update formation in Room B to 3-5-2
    await squadService.updateFormation(userAId, roomB.roomCode, partB._id.toString(), '3-5-2');

    const resA = await squadService.getMySquad(userAId, roomA.roomCode);
    const resB = await squadService.getMySquad(userAId, roomB.roomCode);

    expect(resA.formation).toBe('4-4-2');
    expect(resB.formation).toBe('3-5-2');
  });

  it('Test 8, 9 & 14 — GET /rooms/:roomCode/my-squad resolves authenticated user squad with actual purchase prices', async () => {
    const userAId = new Types.ObjectId().toString();
    const userBId = new Types.ObjectId().toString();

    const { room: roomA, participant: partA } = await roomService.createRoom(userAId, { teamName: 'Red Devils', settings });
    const partB = await roomService.joinRoom(userBId, roomA.roomCode, { teamName: 'Gunners' });

    const p1 = await playerRepo.createPlayer({ name: 'Martin Odegaard', position: PlayerPosition.MID, club: 'Arsenal' });
    const p2 = await playerRepo.createPlayer({ name: 'Declan Rice', position: PlayerPosition.MID, club: 'Arsenal' });

    await squadRepo.createSquadPlayer({
      roomId: roomA._id,
      participantId: partA._id,
      playerId: p1._id,
      auctionId: new Types.ObjectId(),
      purchasePrice: 45000000,
      status: 'STARTING_XI',
      pitchPosition: 'cm',
    });

    await squadRepo.createSquadPlayer({
      roomId: roomA._id,
      participantId: partB._id,
      playerId: p2._id,
      auctionId: new Types.ObjectId(),
      purchasePrice: 60000000,
      status: 'RESERVE',
    });

    // User A fetches my-squad
    const mySquadA = await squadService.getMySquad(userAId, roomA.roomCode);
    expect(mySquadA.manager.teamName).toBe('Red Devils');
    expect(mySquadA.startingXI).toHaveLength(1);
    expect(mySquadA.startingXI[0].purchasePrice).toBe(45000000);
    expect(mySquadA.reserves).toHaveLength(0);

    // User B fetches my-squad
    const mySquadB = await squadService.getMySquad(userBId, roomA.roomCode);
    expect(mySquadB.manager.teamName).toBe('Gunners');
    expect(mySquadB.startingXI).toHaveLength(0);
    expect(mySquadB.reserves).toHaveLength(1);
    expect(mySquadB.reserves[0].purchasePrice).toBe(60000000);
  });

  it('Test 10 & 11 — getUserSquadsHistory returns historical auction squads for user across all auctions', async () => {
    const userAId = new Types.ObjectId().toString();
    const userBId = new Types.ObjectId().toString();

    // User A joins Room 1
    const { room: r1, participant: p1 } = await roomService.createRoom(userAId, { teamName: 'Devils 1', settings });
    await roomService.joinRoom(userBId, r1.roomCode, { teamName: 'Opponent 1' });

    // User A joins Room 2
    const { room: r2, participant: p2 } = await roomService.createRoom(userAId, { teamName: 'Devils 2', settings });
    await roomService.joinRoom(userBId, r2.roomCode, { teamName: 'Opponent 2' });

    const pl1 = await playerRepo.createPlayer({ name: 'Player R1', position: PlayerPosition.FWD });
    await squadRepo.createSquadPlayer({
      roomId: r1._id,
      participantId: p1._id,
      playerId: pl1._id,
      auctionId: new Types.ObjectId(),
      purchasePrice: 15000000,
      status: 'STARTING_XI',
    });

    const history = await squadService.getUserSquadsHistory(userAId);
    expect(history).toHaveLength(2);
    expect(history.map((h) => h.roomCode)).toContain(r1.roomCode);
    expect(history.map((h) => h.roomCode)).toContain(r2.roomCode);

    const r1History = history.find((h) => h.roomCode === r1.roomCode);
    expect(r1History?.squadSize).toBe(1);
    expect(r1History?.teamName).toBe('Devils 1');

    const r2History = history.find((h) => h.roomCode === r2.roomCode);
    expect(r2History?.squadSize).toBe(0);
    expect(r2History?.teamName).toBe('Devils 2');
  });

  it('Test 12 — Interactive Starting XI: assigning reserve to pitch position and auto-replacing occupied slot', async () => {
    const userAId = new Types.ObjectId().toString();
    const userBId = new Types.ObjectId().toString();

    const { room, participant: partA } = await roomService.createRoom(userAId, { teamName: 'Devils', settings });
    await roomService.joinRoom(userBId, room.roomCode, { teamName: 'Opponent' });

    const raya = await playerRepo.createPlayer({ name: 'David Raya', position: PlayerPosition.GK });
    const ramsdale = await playerRepo.createPlayer({ name: 'Aaron Ramsdale', position: PlayerPosition.GK });

    const spRaya = await squadRepo.createSquadPlayer({
      roomId: room._id,
      participantId: partA._id,
      playerId: raya._id,
      auctionId: new Types.ObjectId(),
      purchasePrice: 30000000,
      status: 'RESERVE',
    });

    const spRamsdale = await squadRepo.createSquadPlayer({
      roomId: room._id,
      participantId: partA._id,
      playerId: ramsdale._id,
      auctionId: new Types.ObjectId(),
      purchasePrice: 25000000,
      status: 'RESERVE',
    });

    // 1. Move Raya to GK slot
    await squadService.updatePlayerStatus(
      userAId,
      room.roomCode,
      partA._id.toString(),
      spRaya._id.toString(),
      'STARTING_XI',
      'gk',
    );

    let squadState = await squadService.getMySquad(userAId, room.roomCode);
    expect(squadState.startingXI).toHaveLength(1);
    expect(squadState.startingXI[0].pitchPosition).toBe('gk');
    expect(squadState.reserves).toHaveLength(1);
    expect(squadState.reserves[0]._id.toString()).toBe(spRamsdale._id.toString());

    // 2. Replace Raya with Ramsdale in GK slot (Raya should auto-move to reserves)
    await squadService.updatePlayerStatus(
      userAId,
      room.roomCode,
      partA._id.toString(),
      spRamsdale._id.toString(),
      'STARTING_XI',
      'gk',
    );

    squadState = await squadService.getMySquad(userAId, room.roomCode);
    expect(squadState.startingXI).toHaveLength(1);
    expect(squadState.startingXI[0]._id.toString()).toBe(spRamsdale._id.toString());
    expect(squadState.startingXI[0].pitchPosition).toBe('gk');
    expect(squadState.reserves).toHaveLength(1);
    expect(squadState.reserves[0]._id.toString()).toBe(spRaya._id.toString());
    expect(squadState.reserves[0].pitchPosition).toBeNull();

    // 3. Move Ramsdale back to reserve
    await squadService.updatePlayerStatus(
      userAId,
      room.roomCode,
      partA._id.toString(),
      spRamsdale._id.toString(),
      'RESERVE',
      null,
    );

    squadState = await squadService.getMySquad(userAId, room.roomCode);
    expect(squadState.startingXI).toHaveLength(0);
    expect(squadState.reserves).toHaveLength(2);
  });
});
