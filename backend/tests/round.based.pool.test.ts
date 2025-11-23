import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db';
import { RoomRepository } from '../src/rooms/room.repository';
import { ParticipantRepository } from '../src/participants/participant.repository';
import { PlayerRepository } from '../src/players/player.repository';
import { RoomPlayerRepository } from '../src/roomPlayers/roomPlayer.repository';
import { AuctionRepository } from '../src/auction/auction.repository';
import { SquadPlayerRepository } from '../src/squads/squadPlayer.repository';
import { AuctionEngine } from '../src/auction/auction.engine';
import { RoomStatus, PlayerPosition, AuctionStatus } from '../src/common/types/domain';
import { getClubGroup, BIG_SIX_CLUBS, NEXT_SIX_CLUBS } from '../src/common/utils/clubGroups';
import { AuctionModel } from '../src/auction/auction.model';

describe('Round-Based Club Groups Auction Pool Hierarchy & Random Selection', () => {
  beforeAll(setupTestDb);
  afterEach(clearTestDb);
  afterAll(teardownTestDb);

  it('Test 1 — Correctly categorizes clubs into Round 1 (Top 6), Round 2 (Next 6), and Round 3 (Remaining)', () => {
    // Round 1
    expect(getClubGroup('Arsenal').round).toBe(1);
    expect(getClubGroup('Chelsea').round).toBe(1);
    expect(getClubGroup('Liverpool').round).toBe(1);
    expect(getClubGroup('Manchester City').round).toBe(1);
    expect(getClubGroup('Manchester United').round).toBe(1);
    expect(getClubGroup('Tottenham Hotspur').round).toBe(1);

    // Round 2
    expect(getClubGroup('Newcastle United').round).toBe(2);
    expect(getClubGroup('Aston Villa').round).toBe(2);
    expect(getClubGroup('West Ham United').round).toBe(2);
    expect(getClubGroup('Crystal Palace').round).toBe(2);
    expect(getClubGroup('Brighton').round).toBe(2);
    expect(getClubGroup('Everton').round).toBe(2);

    // Round 3
    expect(getClubGroup('Brentford').round).toBe(3);
    expect(getClubGroup('Fulham').round).toBe(3);
    expect(getClubGroup('Wolverhampton Wanderers').round).toBe(3);
  });

  it('Test 2 — Progresses strictly: Round 1 (GK -> MID -> FWD) -> Round 2 (GK -> MID -> FWD) -> Round 3 (GK -> MID -> FWD)', async () => {
    const roomRepo = new RoomRepository();
    const participantRepo = new ParticipantRepository();
    const playerRepo = new PlayerRepository();
    const roomPlayerRepo = new RoomPlayerRepository();
    const auctionRepo = new AuctionRepository();
    const squadRepo = new SquadPlayerRepository();

    const userAId = new Types.ObjectId();
    const userBId = new Types.ObjectId();

    const room = await roomRepo.createRoom({
      roomCode: `RND${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      creatorUserId: userAId,
      status: RoomStatus.WAITING,
      settings: { purseTotal: 10000000, squadLimit: 15, bidIncrement: 100, bidTimerSeconds: 10 },
    });

    await participantRepo.createParticipant({
      roomId: room._id,
      userId: userAId,
      teamName: 'Team A',
      initialPurse: 10000000,
      purseRemaining: 10000000,
      totalSpent: 0,
      squadCount: 0,
      status: 'ACTIVE',
      joinedAt: new Date(),
      lastSeenAt: new Date(),
    });

    await participantRepo.createParticipant({
      roomId: room._id,
      userId: userBId,
      teamName: 'Team B',
      initialPurse: 10000000,
      purseRemaining: 10000000,
      totalSpent: 0,
      squadCount: 0,
      status: 'ACTIVE',
      joinedAt: new Date(),
      lastSeenAt: new Date(),
    });

    // Create 1 player of each position for each round
    // Round 1: Arsenal (GK, MID, FWD)
    const p1_gk = await playerRepo.createPlayer({ name: 'R1 GK (Arsenal)', club: 'Arsenal', position: PlayerPosition.GK });
    const p1_mid = await playerRepo.createPlayer({ name: 'R1 MID (Arsenal)', club: 'Arsenal', position: PlayerPosition.MID });
    const p1_fwd = await playerRepo.createPlayer({ name: 'R1 FWD (Arsenal)', club: 'Arsenal', position: PlayerPosition.FWD });

    // Round 2: Newcastle (GK, MID, FWD)
    const p2_gk = await playerRepo.createPlayer({ name: 'R2 GK (Newcastle)', club: 'Newcastle United', position: PlayerPosition.GK });
    const p2_mid = await playerRepo.createPlayer({ name: 'R2 MID (Newcastle)', club: 'Newcastle United', position: PlayerPosition.MID });
    const p2_fwd = await playerRepo.createPlayer({ name: 'R2 FWD (Newcastle)', club: 'Newcastle United', position: PlayerPosition.FWD });

    // Round 3: Brentford (GK, MID, FWD)
    const p3_gk = await playerRepo.createPlayer({ name: 'R3 GK (Brentford)', club: 'Brentford', position: PlayerPosition.GK });
    const p3_mid = await playerRepo.createPlayer({ name: 'R3 MID (Brentford)', club: 'Brentford', position: PlayerPosition.MID });
    const p3_fwd = await playerRepo.createPlayer({ name: 'R3 FWD (Brentford)', club: 'Brentford', position: PlayerPosition.FWD });

    const allPlayers = [p1_gk, p1_mid, p1_fwd, p2_gk, p2_mid, p2_fwd, p3_gk, p3_mid, p3_fwd];

    // Create room players with round & position
    for (let i = 0; i < allPlayers.length; i += 1) {
      const p = allPlayers[i];
      const { round, clubGroup } = getClubGroup(p.club);
      await roomPlayerRepo.createRoomPlayer({
        roomId: room._id,
        playerId: p._id,
        round,
        clubGroup,
        position: p.position,
        basePrice: 1000,
        auctionOrder: i + 1,
        status: 'PENDING' as any,
      });
    }

    const engine = new AuctionEngine(
      roomRepo, roomPlayerRepo, auctionRepo, participantRepo, undefined, undefined,
      undefined, squadRepo, undefined, playerRepo, 0,
    );

    await engine.transitionRoom(room._id.toString(), RoomStatus.STARTING);

    const auctionedPlayersSequence: string[] = [];

    // 1st auction -> Must be Round 1 GK (p1_gk)
    let auction = await engine.startAuction(room._id.toString());
    let currentP = await playerRepo.findById(auction.playerId.toString());
    auctionedPlayersSequence.push(currentP!.name);
    expect(currentP!.position).toBe(PlayerPosition.GK);
    expect(getClubGroup(currentP!.club).round).toBe(1);

    // Settle 1st auction
    await AuctionModel.findByIdAndUpdate(auction._id, { timerEndsAt: new Date(Date.now() - 10) });
    await engine.expireAuction(auction._id.toString());

    // 2nd auction -> Must be Round 1 MID (p1_mid)
    let currentAuction = await auctionRepo.findCurrentAuction(room._id.toString());
    currentP = await playerRepo.findById(currentAuction!.playerId.toString());
    auctionedPlayersSequence.push(currentP!.name);
    expect(currentP!.position).toBe(PlayerPosition.MID);
    expect(getClubGroup(currentP!.club).round).toBe(1);

    // Settle 2nd auction
    await AuctionModel.findByIdAndUpdate(currentAuction!._id, { timerEndsAt: new Date(Date.now() - 10) });
    await engine.expireAuction(currentAuction!._id.toString());

    // 3rd auction -> Must be Round 1 FWD (p1_fwd)
    currentAuction = await auctionRepo.findCurrentAuction(room._id.toString());
    currentP = await playerRepo.findById(currentAuction!.playerId.toString());
    auctionedPlayersSequence.push(currentP!.name);
    expect(currentP!.position).toBe(PlayerPosition.FWD);
    expect(getClubGroup(currentP!.club).round).toBe(1);

    // Settle 3rd auction -> ROUND 1 COMPLETE!
    await AuctionModel.findByIdAndUpdate(currentAuction!._id, { timerEndsAt: new Date(Date.now() - 10) });
    await engine.expireAuction(currentAuction!._id.toString());

    // 4th auction -> Must advance to ROUND 2 GK (p2_gk)!
    currentAuction = await auctionRepo.findCurrentAuction(room._id.toString());
    currentP = await playerRepo.findById(currentAuction!.playerId.toString());
    auctionedPlayersSequence.push(currentP!.name);
    expect(currentP!.position).toBe(PlayerPosition.GK);
    expect(getClubGroup(currentP!.club).round).toBe(2);

    // Settle 4th auction
    await AuctionModel.findByIdAndUpdate(currentAuction!._id, { timerEndsAt: new Date(Date.now() - 10) });
    await engine.expireAuction(currentAuction!._id.toString());

    // 5th auction -> Must be ROUND 2 MID (p2_mid)!
    currentAuction = await auctionRepo.findCurrentAuction(room._id.toString());
    currentP = await playerRepo.findById(currentAuction!.playerId.toString());
    auctionedPlayersSequence.push(currentP!.name);
    expect(currentP!.position).toBe(PlayerPosition.MID);
    expect(getClubGroup(currentP!.club).round).toBe(2);

    // Settle 5th auction
    await AuctionModel.findByIdAndUpdate(currentAuction!._id, { timerEndsAt: new Date(Date.now() - 10) });
    await engine.expireAuction(currentAuction!._id.toString());

    // 6th auction -> Must be ROUND 2 FWD (p2_fwd)!
    currentAuction = await auctionRepo.findCurrentAuction(room._id.toString());
    currentP = await playerRepo.findById(currentAuction!.playerId.toString());
    auctionedPlayersSequence.push(currentP!.name);
    expect(currentP!.position).toBe(PlayerPosition.FWD);
    expect(getClubGroup(currentP!.club).round).toBe(2);

    // Settle 6th auction -> ROUND 2 COMPLETE!
    await AuctionModel.findByIdAndUpdate(currentAuction!._id, { timerEndsAt: new Date(Date.now() - 10) });
    await engine.expireAuction(currentAuction!._id.toString());

    // 7th auction -> Must advance to ROUND 3 GK (p3_gk)!
    currentAuction = await auctionRepo.findCurrentAuction(room._id.toString());
    currentP = await playerRepo.findById(currentAuction!.playerId.toString());
    auctionedPlayersSequence.push(currentP!.name);
    expect(currentP!.position).toBe(PlayerPosition.GK);
    expect(getClubGroup(currentP!.club).round).toBe(3);

    expect(auctionedPlayersSequence).toEqual([
      'R1 GK (Arsenal)',
      'R1 MID (Arsenal)',
      'R1 FWD (Arsenal)',
      'R2 GK (Newcastle)',
      'R2 MID (Newcastle)',
      'R2 FWD (Newcastle)',
      'R3 GK (Brentford)',
    ]);
  });

  it('Test 3 — Live Pool Tracker state reports accurate active round, group, and position', async () => {
    const roomRepo = new RoomRepository();
    const playerRepo = new PlayerRepository();
    const roomPlayerRepo = new RoomPlayerRepository();

    const userAId = new Types.ObjectId();
    const room = await roomRepo.createRoom({
      roomCode: `TRK${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      creatorUserId: userAId,
      status: RoomStatus.WAITING,
      settings: { purseTotal: 10000000, squadLimit: 15, bidIncrement: 100, bidTimerSeconds: 10 },
    });

    const p1 = await playerRepo.createPlayer({ name: 'Raya', club: 'Arsenal', position: PlayerPosition.GK });
    const p2 = await playerRepo.createPlayer({ name: 'Ederson', club: 'Manchester City', position: PlayerPosition.GK });
    const p3 = await playerRepo.createPlayer({ name: 'Saka', club: 'Arsenal', position: PlayerPosition.FWD });

    await roomPlayerRepo.createRoomPlayer({
      roomId: room._id,
      playerId: p1._id,
      round: 1,
      clubGroup: 'BIG_SIX',
      position: PlayerPosition.GK,
      basePrice: 1000,
      auctionOrder: 1,
      status: 'SOLD' as any,
    });
    await roomPlayerRepo.createRoomPlayer({
      roomId: room._id,
      playerId: p2._id,
      round: 1,
      clubGroup: 'BIG_SIX',
      position: PlayerPosition.GK,
      basePrice: 1000,
      auctionOrder: 2,
      status: 'LIVE' as any,
    });
    await roomPlayerRepo.createRoomPlayer({
      roomId: room._id,
      playerId: p3._id,
      round: 1,
      clubGroup: 'BIG_SIX',
      position: PlayerPosition.FWD,
      basePrice: 1000,
      auctionOrder: 3,
      status: 'PENDING' as any,
    });

    const poolState = await roomPlayerRepo.getActivePoolState(room._id.toString());
    expect(poolState.round).toBe(1);
    expect(poolState.clubGroup).toBe('BIG_SIX');
    expect(poolState.position).toBe('GK');
    expect(poolState.poolPlayers.length).toBe(2); // Raya (SOLD) and Ederson (LIVE)
  });
});
