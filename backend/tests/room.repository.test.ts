import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db';
import { RoomRepository } from '../src/rooms/room.repository';
import { RoomStatus } from '../src/common/types/domain';

const roomRepo = new RoomRepository();

const creatorId = new Types.ObjectId();
const baseSettings = {
  purseTotal: 1_000_000,
  squadLimit: 15,
  bidIncrement: 100,
  bidTimerSeconds: 15,
};

function makeRoomDTO(code: string) {
  return {
    roomCode: code,
    creatorUserId: creatorId,
    status: RoomStatus.WAITING,
    settings: baseSettings,
  };
}

describe('RoomRepository', () => {
  beforeAll(setupTestDb);
  afterEach(clearTestDb);
  afterAll(teardownTestDb);

  it('creates a room and returns it with defaults', async () => {
    const room = await roomRepo.createRoom(makeRoomDTO('ALPHA1'));

    expect(room._id).toBeDefined();
    expect(room.roomCode).toBe('ALPHA1');
    expect(room.status).toBe(RoomStatus.WAITING);
    expect(room.maxParticipants).toBe(10);
    expect(room.minParticipants).toBe(2);
    expect(room.settings.purseTotal).toBe(1_000_000);
  });

  it('findRoomByCode returns the correct room (case-insensitive)', async () => {
    await roomRepo.createRoom(makeRoomDTO('BRAVO2'));

    const found = await roomRepo.findRoomByCode('bravo2');
    expect(found).not.toBeNull();
    expect(found!.roomCode).toBe('BRAVO2');
  });

  it('findRoomByCode returns null for unknown codes', async () => {
    const found = await roomRepo.findRoomByCode('XXXXX');
    expect(found).toBeNull();
  });

  it('enforces unique room codes', async () => {
    await roomRepo.createRoom(makeRoomDTO('DELTA3'));

    await expect(roomRepo.createRoom(makeRoomDTO('DELTA3'))).rejects.toThrow();
  });

  it('roomCodeExists returns true/false correctly', async () => {
    await roomRepo.createRoom(makeRoomDTO('ECHO44'));

    expect(await roomRepo.roomCodeExists('ECHO44')).toBe(true);
    expect(await roomRepo.roomCodeExists('NOPE99')).toBe(false);
  });

  it('updateStatus changes the room status', async () => {
    const room = await roomRepo.createRoom(makeRoomDTO('FOXTRT'));
    const updated = await roomRepo.updateStatus(
      room._id.toString(),
      RoomStatus.LIVE,
    );

    expect(updated!.status).toBe(RoomStatus.LIVE);
  });

  it('findByStatus returns only rooms with that status', async () => {
    await roomRepo.createRoom(makeRoomDTO('GOLF55'));
    const r2 = await roomRepo.createRoom(makeRoomDTO('HOTEL6'));
    await roomRepo.updateStatus(r2._id.toString(), RoomStatus.LIVE);

    const waiting = await roomRepo.findByStatus(RoomStatus.WAITING);
    const live = await roomRepo.findByStatus(RoomStatus.LIVE);

    expect(waiting.length).toBe(1);
    expect(live.length).toBe(1);
  });
});
