import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db';
import { RoomPlayerRepository } from '../src/roomPlayers/roomPlayer.repository';
import { RoomRepository } from '../src/rooms/room.repository';
import { RoomPlayerStatus } from '../src/common/types/domain';
import { Types } from 'mongoose';

const BASE = '/api/v1';

// ─── Shared helpers ──────────────────────────────────────────────────────────

async function registerUser(
  n: number,
): Promise<{ token: string; userId: string }> {
  const res = await request(app)
    .post(`${BASE}/auth/register`)
    .send({
      name: `TestUser${n}`,
      email: `user${n}@test.com`,
      password: 'password1234',
    });
  return {
    token: res.body.data.token as string,
    userId: res.body.data.user._id as string,
  };
}

const defaultSettings = {
  purseTotal: 1_000_000,
  squadLimit: 15,
  bidIncrement: 100,
  bidTimerSeconds: 15,
};

async function createRoom(token: string, teamName = 'Team Alpha') {
  return request(app)
    .post(`${BASE}/rooms`)
    .set('Authorization', `Bearer ${token}`)
    .send({ teamName, settings: defaultSettings });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Room Management', () => {
  beforeAll(setupTestDb);
  afterEach(clearTestDb);
  afterAll(teardownTestDb);

  // ── Create Room ────────────────────────────────────────────────────────────

  describe('POST /rooms – create room', () => {
    it('creates a room and auto-creates creator participant (201)', async () => {
      const { token } = await registerUser(1);
      const res = await createRoom(token);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const { room, participant } = res.body.data;
      expect(room.roomCode).toHaveLength(6);
      expect(room.status).toBe('WAITING');
      expect(room.settings.purseTotal).toBe(1_000_000);
      expect(participant.teamName).toBe('Team Alpha');
      expect(participant.purseRemaining).toBe(1_000_000);
      expect(participant.initialPurse).toBe(1_000_000);
      expect(participant.status).toBe('ACTIVE');
    });

    it('rejects unauthenticated request (401)', async () => {
      const res = await request(app)
        .post(`${BASE}/rooms`)
        .send({ teamName: 'X', settings: defaultSettings });

      expect(res.status).toBe(401);
    });

    it('rejects missing settings (400)', async () => {
      const { token } = await registerUser(1);
      const res = await request(app)
        .post(`${BASE}/rooms`)
        .set('Authorization', `Bearer ${token}`)
        .send({ teamName: 'X' });

      expect(res.status).toBe(400);
    });

    it('each created room gets a unique code', async () => {
      const { token } = await registerUser(1);
      const r1 = await createRoom(token, 'Team A');
      const r2 = await createRoom(token, 'Team B');

      expect(r1.body.data.room.roomCode).not.toBe(r2.body.data.room.roomCode);
    });
  });

  // ── Join Room ──────────────────────────────────────────────────────────────

  describe('POST /rooms/:roomCode/join', () => {
    it('allows a second user to join successfully (201)', async () => {
      const creator = await registerUser(1);
      const joiner = await registerUser(2);

      const roomRes = await createRoom(creator.token);
      const { roomCode } = roomRes.body.data.room;

      const res = await request(app)
        .post(`${BASE}/rooms/${roomCode}/join`)
        .set('Authorization', `Bearer ${joiner.token}`)
        .send({ teamName: 'Team Beta' });

      expect(res.status).toBe(201);
      expect(res.body.data.participant.teamName).toBe('Team Beta');
      expect(res.body.data.participant.purseRemaining).toBe(1_000_000);
    });

    it('rejects duplicate join – same user (409)', async () => {
      const creator = await registerUser(1);
      const joiner = await registerUser(2);
      const roomRes = await createRoom(creator.token);
      const { roomCode } = roomRes.body.data.room;

      await request(app)
        .post(`${BASE}/rooms/${roomCode}/join`)
        .set('Authorization', `Bearer ${joiner.token}`)
        .send({ teamName: 'Team Beta' });

      const res = await request(app)
        .post(`${BASE}/rooms/${roomCode}/join`)
        .set('Authorization', `Bearer ${joiner.token}`)
        .send({ teamName: 'Team Gamma' });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/already joined/i);
    });

    it('rejects duplicate team name (409)', async () => {
      const creator = await registerUser(1);
      const joiner1 = await registerUser(2);
      const joiner2 = await registerUser(3);
      const roomRes = await createRoom(creator.token, 'Alpha');
      const { roomCode } = roomRes.body.data.room;

      await request(app)
        .post(`${BASE}/rooms/${roomCode}/join`)
        .set('Authorization', `Bearer ${joiner1.token}`)
        .send({ teamName: 'Taken Name' });

      const res = await request(app)
        .post(`${BASE}/rooms/${roomCode}/join`)
        .set('Authorization', `Bearer ${joiner2.token}`)
        .send({ teamName: 'Taken Name' });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/team name/i);
    });

    it('allows exactly 10 participants in total', async () => {
      // Register 10 users (creator + 9 joiners)
      const users = await Promise.all(
        Array.from({ length: 10 }, (_, i) => registerUser(i + 1)),
      );

      const creator = users[0]!;
      const roomRes = await createRoom(creator.token, 'Team1');
      const { roomCode } = roomRes.body.data.room;

      // Join 9 more (users[1..9])
      const joins = await Promise.all(
        users.slice(1).map((u, i) =>
          request(app)
            .post(`${BASE}/rooms/${roomCode}/join`)
            .set('Authorization', `Bearer ${u.token}`)
            .send({ teamName: `Team${i + 2}` }),
        ),
      );

      // All 9 joins should succeed
      for (const join of joins) {
        expect(join.status).toBe(201);
      }
    });

    it('rejects the 11th participant (409)', async () => {
      // 10 users fill the room, the 11th should be rejected
      const users = await Promise.all(
        Array.from({ length: 11 }, (_, i) => registerUser(i + 1)),
      );

      const creator = users[0]!;
      const roomRes = await createRoom(creator.token, 'Team1');
      const { roomCode } = roomRes.body.data.room;

      // Fill slots 2–10 (9 joiners)
      for (let i = 1; i <= 9; i++) {
        const u = users[i]!;
        await request(app)
          .post(`${BASE}/rooms/${roomCode}/join`)
          .set('Authorization', `Bearer ${u.token}`)
          .send({ teamName: `Team${i + 1}` });
      }

      // 11th attempt should fail
      const overflow = users[10]!;
      const res = await request(app)
        .post(`${BASE}/rooms/${roomCode}/join`)
        .set('Authorization', `Bearer ${overflow.token}`)
        .send({ teamName: 'Overflow' });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/full/i);
    });

    it('rejects joining after WAITING state (409)', async () => {
      const creator = await registerUser(1);
      const joiner1 = await registerUser(2);
      const lateJoiner = await registerUser(3);

      const roomRes = await createRoom(creator.token);
      const { roomCode } = roomRes.body.data.room;
      const roomId = roomRes.body.data.room._id as string;

      await request(app)
        .post(`${BASE}/rooms/${roomCode}/join`)
        .set('Authorization', `Bearer ${joiner1.token}`)
        .send({ teamName: 'Team Beta' });

      // Add a player and start the room
      const roomPlayerRepo = new RoomPlayerRepository();
      await roomPlayerRepo.createRoomPlayer({
        roomId: new Types.ObjectId(roomId),
        playerId: new Types.ObjectId(),
        basePrice: 100,
        auctionOrder: 1,
        status: RoomPlayerStatus.PENDING,
      });

      await request(app)
        .post(`${BASE}/rooms/${roomCode}/start`)
        .set('Authorization', `Bearer ${creator.token}`);

      // lateJoiner tries to join after start
      const res = await request(app)
        .post(`${BASE}/rooms/${roomCode}/join`)
        .set('Authorization', `Bearer ${lateJoiner.token}`)
        .send({ teamName: 'Late Team' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ROOM_NOT_JOINABLE');
    });

    it('rejects join to non-existent room (404)', async () => {
      const { token } = await registerUser(1);
      const res = await request(app)
        .post(`${BASE}/rooms/XXXXXX/join`)
        .set('Authorization', `Bearer ${token}`)
        .send({ teamName: 'Any' });

      expect(res.status).toBe(404);
    });
  });

  // ── Room Access ────────────────────────────────────────────────────────────

  describe('GET /rooms/:roomCode and GET /rooms/:roomCode/participants', () => {
    it('allows room access by an active participant (200)', async () => {
      const creator = await registerUser(1);
      const roomRes = await createRoom(creator.token);
      const { roomCode } = roomRes.body.data.room;

      const res = await request(app)
        .get(`${BASE}/rooms/${roomCode}`)
        .set('Authorization', `Bearer ${creator.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.roomCode).toBe(roomCode);
      expect(res.body.data.status).toBe('WAITING');
      expect(res.body.data.participantCount).toBe(1);
      expect(res.body.data.settings).toBeDefined();
    });

    it('rejects room access by unauthenticated user (401)', async () => {
      const creator = await registerUser(1);
      const roomRes = await createRoom(creator.token);
      const { roomCode } = roomRes.body.data.room;

      const res = await request(app).get(`${BASE}/rooms/${roomCode}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects room access by non-participant authenticated user (403)', async () => {
      const creator = await registerUser(1);
      const stranger = await registerUser(2);
      const roomRes = await createRoom(creator.token);
      const { roomCode } = roomRes.body.data.room;

      const res = await request(app)
        .get(`${BASE}/rooms/${roomCode}`)
        .set('Authorization', `Bearer ${stranger.token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows participant list access by participant (200)', async () => {
      const creator = await registerUser(1);
      const joiner = await registerUser(2);
      const roomRes = await createRoom(creator.token, 'Alpha');
      const { roomCode } = roomRes.body.data.room;

      await request(app)
        .post(`${BASE}/rooms/${roomCode}/join`)
        .set('Authorization', `Bearer ${joiner.token}`)
        .send({ teamName: 'Beta' });

      const res = await request(app)
        .get(`${BASE}/rooms/${roomCode}/participants`)
        .set('Authorization', `Bearer ${joiner.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.participants).toHaveLength(2);
      expect(res.body.data.participants[0].teamName).toBe('Alpha');
      expect(res.body.data.participants[0].purseRemaining).toBe(1_000_000);
      expect(res.body.data.participants[0].squadCount).toBe(0);
      expect(res.body.data.participants[0].status).toBe('ACTIVE');
    });

    it('rejects participant list access by non-participant (403)', async () => {
      const creator = await registerUser(1);
      const stranger = await registerUser(2);
      const roomRes = await createRoom(creator.token);
      const { roomCode } = roomRes.body.data.room;

      const res = await request(app)
        .get(`${BASE}/rooms/${roomCode}/participants`)
        .set('Authorization', `Bearer ${stranger.token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ── Start Room ─────────────────────────────────────────────────────────────

  describe('POST /rooms/:roomCode/start', () => {
    it('rejects start by a non-creator (403)', async () => {
      const creator = await registerUser(1);
      const joiner = await registerUser(2);

      const roomRes = await createRoom(creator.token);
      const { roomCode } = roomRes.body.data.room;

      await request(app)
        .post(`${BASE}/rooms/${roomCode}/join`)
        .set('Authorization', `Bearer ${joiner.token}`)
        .send({ teamName: 'Team B' });

      const res = await request(app)
        .post(`${BASE}/rooms/${roomCode}/start`)
        .set('Authorization', `Bearer ${joiner.token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('NOT_ROOM_CREATOR');
    });

    it('rejects start with only 1 participant (409)', async () => {
      const creator = await registerUser(1);
      const roomRes = await createRoom(creator.token);
      const { roomCode } = roomRes.body.data.room;

      const res = await request(app)
        .post(`${BASE}/rooms/${roomCode}/start`)
        .set('Authorization', `Bearer ${creator.token}`);

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/participants/i);
    });

    it('rejects start with empty player pool (409)', async () => {
      const creator = await registerUser(1);
      const joiner = await registerUser(2);

      const roomRes = await createRoom(creator.token);
      const { roomCode } = roomRes.body.data.room;

      await request(app)
        .post(`${BASE}/rooms/${roomCode}/join`)
        .set('Authorization', `Bearer ${joiner.token}`)
        .send({ teamName: 'Team B' });

      // Try to start – no players added yet
      const res = await request(app)
        .post(`${BASE}/rooms/${roomCode}/start`)
        .set('Authorization', `Bearer ${creator.token}`);

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/player pool/i);
    });

    it('successfully starts a room with 2 participants and players (200)', async () => {
      const creator = await registerUser(1);
      const joiner = await registerUser(2);

      const roomRes = await createRoom(creator.token);
      const { roomCode } = roomRes.body.data.room;
      const roomId = roomRes.body.data.room._id as string;

      await request(app)
        .post(`${BASE}/rooms/${roomCode}/join`)
        .set('Authorization', `Bearer ${joiner.token}`)
        .send({ teamName: 'Team B' });

      // Seed a room player directly via repository to satisfy the pool check
      const roomPlayerRepo = new RoomPlayerRepository();
      await roomPlayerRepo.createRoomPlayer({
        roomId: new Types.ObjectId(roomId),
        playerId: new Types.ObjectId(),
        basePrice: 100,
        auctionOrder: 1,
        status: RoomPlayerStatus.PENDING,
      });

      const res = await request(app)
        .post(`${BASE}/rooms/${roomCode}/start`)
        .set('Authorization', `Bearer ${creator.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.room.status).toBe('STARTING');
    });
  });

  // ── Leave Room / Creator Cancellation ──────────────────────────────────────

  describe('POST /rooms/:roomCode/leave – creator cancellation', () => {
    it('creator leaving an empty room cancels it', async () => {
      const creator = await registerUser(1);
      const roomRes = await createRoom(creator.token);
      const { roomCode } = roomRes.body.data.room;

      const leaveRes = await request(app)
        .post(`${BASE}/rooms/${roomCode}/leave`)
        .set('Authorization', `Bearer ${creator.token}`);

      expect(leaveRes.status).toBe(200);

      const roomRepo = new RoomRepository();
      const updatedRoom = await roomRepo.findRoomByCode(roomCode);
      expect(updatedRoom!.status).toBe('CANCELLED');
    });

    it('cancels the room when creator leaves with other participants', async () => {
      const creator = await registerUser(1);
      const joiner1 = await registerUser(2);
      const joiner2 = await registerUser(3);

      const roomRes = await createRoom(creator.token);
      const { roomCode } = roomRes.body.data.room;

      // joiner1 joins first, joiner2 second
      await request(app)
        .post(`${BASE}/rooms/${roomCode}/join`)
        .set('Authorization', `Bearer ${joiner1.token}`)
        .send({ teamName: 'Team B' });

      await request(app)
        .post(`${BASE}/rooms/${roomCode}/join`)
        .set('Authorization', `Bearer ${joiner2.token}`)
        .send({ teamName: 'Team C' });

      // Creator leaves
      await request(app)
        .post(`${BASE}/rooms/${roomCode}/leave`)
        .set('Authorization', `Bearer ${creator.token}`);

      const roomRepo = new RoomRepository();
      const updatedRoom = await roomRepo.findRoomByCode(roomCode);

      expect(updatedRoom!.status).toBe('CANCELLED');
    });

    it('creator leaving during auction (STARTING) does NOT cancel room', async () => {
      const creator = await registerUser(1);
      const joiner = await registerUser(2);
      const joiner2 = await registerUser(3);

      const roomRes = await createRoom(creator.token);
      const { roomCode } = roomRes.body.data.room;
      const roomId = roomRes.body.data.room._id as string;

      await request(app)
        .post(`${BASE}/rooms/${roomCode}/join`)
        .set('Authorization', `Bearer ${joiner.token}`)
        .send({ teamName: 'Team B' });

      await request(app)
        .post(`${BASE}/rooms/${roomCode}/join`)
        .set('Authorization', `Bearer ${joiner2.token}`)
        .send({ teamName: 'Team C' });

      const roomPlayerRepo = new RoomPlayerRepository();
      await roomPlayerRepo.createRoomPlayer({
        roomId: new Types.ObjectId(roomId),
        playerId: new Types.ObjectId(),
        basePrice: 100,
        auctionOrder: 1,
        status: RoomPlayerStatus.PENDING,
      });

      // Transition to STARTING
      await request(app)
        .post(`${BASE}/rooms/${roomCode}/start`)
        .set('Authorization', `Bearer ${creator.token}`);

      // Creator leaves during STARTING
      const leaveRes = await request(app)
        .post(`${BASE}/rooms/${roomCode}/leave`)
        .set('Authorization', `Bearer ${creator.token}`);

      expect(leaveRes.status).toBe(200);

      const roomRepo = new RoomRepository();
      const updatedRoom = await roomRepo.findRoomByCode(roomCode);
      expect(updatedRoom!.status).toBe('STARTING');
    });

    it('non-creator leaving does NOT change the creator', async () => {
      const creator = await registerUser(1);
      const joiner = await registerUser(2);

      const roomRes = await createRoom(creator.token);
      const { roomCode } = roomRes.body.data.room;
      const creatorId = roomRes.body.data.room.creatorUserId as string;

      await request(app)
        .post(`${BASE}/rooms/${roomCode}/join`)
        .set('Authorization', `Bearer ${joiner.token}`)
        .send({ teamName: 'Team B' });

      await request(app)
        .post(`${BASE}/rooms/${roomCode}/leave`)
        .set('Authorization', `Bearer ${joiner.token}`);

      const roomRepo = new RoomRepository();
      const updatedRoom = await roomRepo.findRoomByCode(roomCode);
      expect(updatedRoom!.creatorUserId.toString()).toBe(creatorId);
    });

    it('rejects leaving a room you are not in (404)', async () => {
      const creator = await registerUser(1);
      const stranger = await registerUser(2);

      const roomRes = await createRoom(creator.token);
      const { roomCode } = roomRes.body.data.room;

      const res = await request(app)
        .post(`${BASE}/rooms/${roomCode}/leave`)
        .set('Authorization', `Bearer ${stranger.token}`);

      expect(res.status).toBe(404);
    });
  });
});
