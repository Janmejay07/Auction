import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db';
import { RoomService } from '../src/rooms/room.service';
import { RoomRepository } from '../src/rooms/room.repository';
import { ParticipantRepository } from '../src/participants/participant.repository';
import { RoomPlayerRepository } from '../src/roomPlayers/roomPlayer.repository';
import { ParticipantStatus, RoomStatus } from '../src/common/types/domain';

const defaultSettings = {
  purseTotal: 10000000,
  squadLimit: 11,
  bidIncrement: 100000,
  bidTimerSeconds: 15,
};

describe('Room Leave State & Ready Management', () => {
  let roomRepo: RoomRepository;
  let participantRepo: ParticipantRepository;
  let roomPlayerRepo: RoomPlayerRepository;
  let roomService: RoomService;

  beforeAll(async () => {
    await setupTestDb();
    roomRepo = new RoomRepository();
    participantRepo = new ParticipantRepository();
    roomPlayerRepo = new RoomPlayerRepository();
    roomService = new RoomService(roomRepo, participantRepo, roomPlayerRepo);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  it('Test 1 — Ready participant leaves: becomes inactive and ready state is cleared', async () => {
    const creatorId = new Types.ObjectId().toString();
    const userBId = new Types.ObjectId().toString();

    const { room } = await roomService.createRoom(creatorId, {
      teamName: 'Host United',
      settings: defaultSettings,
    });

    const partB = await roomService.joinRoom(userBId, room.roomCode, {
      teamName: 'Player B FC',
    });
    expect(partB.isReady).toBe(false);

    // User B ready up
    const readyB = await roomService.setReady(userBId, room.roomCode, true);
    expect(readyB.isReady).toBe(true);

    // User B leaves room
    const { participant: leftB } = await roomService.leaveRoom(userBId, room.roomCode);
    expect(leftB.status).toBe(ParticipantStatus.INACTIVE);
    expect(leftB.isReady).toBe(false);

    // Active participants in room should only include creator
    const activeParticipants = await participantRepo.findActiveByRoom(room._id.toString());
    expect(activeParticipants.length).toBe(1);
    expect(activeParticipants[0].userId.toString()).toBe(creatorId);
  });

  it('Test 2 — Ready count: only active members who are ready count', async () => {
    const hostId = new Types.ObjectId().toString();
    const userBId = new Types.ObjectId().toString();
    const userCId = new Types.ObjectId().toString();

    const { room } = await roomService.createRoom(hostId, {
      teamName: 'Host FC',
      settings: defaultSettings,
    });

    await roomService.joinRoom(userBId, room.roomCode, { teamName: 'Team B' });
    await roomService.joinRoom(userCId, room.roomCode, { teamName: 'Team C' });

    await roomService.setReady(userBId, room.roomCode, true);
    await roomService.setReady(userCId, room.roomCode, true);

    let allParticipants = await participantRepo.findByRoom(room._id.toString());
    let activeMembers = allParticipants.filter((p) => p.status === ParticipantStatus.ACTIVE);
    let readyCount = activeMembers.filter((p) => p.isReady || p.userId.toString() === hostId).length;
    expect(activeMembers.length).toBe(3);
    expect(readyCount).toBe(3);

    // C leaves room
    await roomService.leaveRoom(userCId, room.roomCode);

    allParticipants = await participantRepo.findByRoom(room._id.toString());
    activeMembers = allParticipants.filter((p) => p.status === ParticipantStatus.ACTIVE);
    readyCount = activeMembers.filter((p) => p.isReady || p.userId.toString() === hostId).length;

    expect(activeMembers.length).toBe(2);
    expect(readyCount).toBe(2); // Only Host and B
  });

  it('Test 3 — Rejoin after intentional leave starts as NOT READY', async () => {
    const hostId = new Types.ObjectId().toString();
    const userBId = new Types.ObjectId().toString();

    const { room } = await roomService.createRoom(hostId, {
      teamName: 'Host FC',
      settings: defaultSettings,
    });

    await roomService.joinRoom(userBId, room.roomCode, { teamName: 'Team B' });
    await roomService.setReady(userBId, room.roomCode, true);

    // Leave
    await roomService.leaveRoom(userBId, room.roomCode);

    // Rejoin
    const rejoined = await roomService.joinRoom(userBId, room.roomCode, {
      teamName: 'Team B Reborn',
    });

    expect(rejoined.status).toBe(ParticipantStatus.ACTIVE);
    expect(rejoined.isReady).toBe(false);
    expect(rejoined.teamName).toBe('Team B Reborn');

    // Make sure no duplicate participant was created in database
    const allForUser = await participantRepo.findByRoom(room._id.toString());
    const userParticipants = allForUser.filter((p) => p.userId.toString() === userBId);
    expect(userParticipants.length).toBe(1);
  });

  it('Test 4 — Host leaves WAITING room cancels room and marks all inactive', async () => {
    const hostId = new Types.ObjectId().toString();
    const userBId = new Types.ObjectId().toString();

    const { room } = await roomService.createRoom(hostId, {
      teamName: 'Host FC',
      settings: defaultSettings,
    });

    await roomService.joinRoom(userBId, room.roomCode, { teamName: 'Team B' });

    const { room: cancelledRoom } = await roomService.leaveRoom(hostId, room.roomCode);
    expect(cancelledRoom.status).toBe(RoomStatus.CANCELLED);

    const activeParticipants = await participantRepo.findActiveByRoom(room._id.toString());
    expect(activeParticipants.length).toBe(0);
  });

  it('Test 5 — Non-participant cannot toggle ready or leave room', async () => {
    const hostId = new Types.ObjectId().toString();
    const strangerId = new Types.ObjectId().toString();

    const { room } = await roomService.createRoom(hostId, {
      teamName: 'Host FC',
      settings: defaultSettings,
    });

    await expect(roomService.setReady(strangerId, room.roomCode, true)).rejects.toThrow();
    await expect(roomService.leaveRoom(strangerId, room.roomCode)).rejects.toThrow();
  });
});
