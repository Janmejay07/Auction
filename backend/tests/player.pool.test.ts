import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db';
import { UserModel } from '../src/users/user.model';

const BASE = '/api/v1';
const settings = { purseTotal: 100000, squadLimit: 15, bidIncrement: 100, bidTimerSeconds: 15 };

async function register(n: number) {
  const response = await request(app).post(`${BASE}/auth/register`).send({
    name: `User ${n}`, email: `pool${n}@test.com`, password: 'password1234',
  });
  return { token: response.body.data.token as string, userId: response.body.data.user._id as string };
}

async function makeAdmin(userId: string) {
  await UserModel.findByIdAndUpdate(userId, { role: 'ADMIN' });
}

async function makePlayer(token: string, name = 'Pool Player') {
  const response = await request(app).post(`${BASE}/players`).set('Authorization', `Bearer ${token}`).send({
    name, position: 'GK', basePrice: 1,
  });
  return response.body.data.player._id as string;
}

async function makeRoom(token: string) {
  const response = await request(app).post(`${BASE}/rooms`).set('Authorization', `Bearer ${token}`).send({ teamName: 'Alpha', settings });
  return response.body.data.room as { _id: string; roomCode: string };
}

describe('Player pool management', () => {
  beforeAll(setupTestDb);
  afterEach(clearTestDb);
  afterAll(teardownTestDb);

  it('requires admin access for global player APIs', async () => {
    const user = await register(1);
    const response = await request(app).get(`${BASE}/players`).set('Authorization', `Bearer ${user.token}`);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ADMIN_ACCESS_REQUIRED');
  });

  it('creates and retrieves global players as an admin', async () => {
    const admin = await register(1);
    await makeAdmin(admin.userId);
    const playerId = await makePlayer(admin.token);
    const [list, one] = await Promise.all([
      request(app).get(`${BASE}/players`).set('Authorization', `Bearer ${admin.token}`),
      request(app).get(`${BASE}/players/${playerId}`).set('Authorization', `Bearer ${admin.token}`),
    ]);
    expect(list.status).toBe(200);
    expect(list.body.data.total).toBe(1);
    expect(one.status).toBe(200);
    expect(one.body.data.player._id).toBe(playerId);
  });

  it('enforces duplicate players, orders, prices, and creator ownership', async () => {
    const admin = await register(1);
    const stranger = await register(2);
    await makeAdmin(admin.userId);
    const firstPlayer = await makePlayer(admin.token, 'First');
    const secondPlayer = await makePlayer(admin.token, 'Second');
    const room = await makeRoom(admin.token);
    const add = (playerId: string, auctionOrder = 1, basePrice = 100, token = admin.token) =>
      request(app).post(`${BASE}/rooms/${room.roomCode}/players`).set('Authorization', `Bearer ${token}`).send({ playerId, auctionOrder, basePrice, bucket: 'CUSTOM' });

    expect((await add(firstPlayer)).status).toBe(201);
    expect((await add(firstPlayer, 2)).status).toBe(409);
    expect((await add(secondPlayer)).status).toBe(409);
    expect((await add(secondPlayer, 2, 0)).status).toBe(400);
    expect((await add(secondPlayer, 2, 100, stranger.token)).status).toBe(403);
  });

  it('allows reorder swaps and locks every mutation after start', async () => {
    const admin = await register(1);
    const joiner = await register(2);
    await makeAdmin(admin.userId);
    const first = await makePlayer(admin.token, 'First');
    const second = await makePlayer(admin.token, 'Second');
    const room = await makeRoom(admin.token);
    await request(app).post(`${BASE}/rooms/${room.roomCode}/join`).set('Authorization', `Bearer ${joiner.token}`).send({ teamName: 'Beta' });
    const firstResponse = await request(app).post(`${BASE}/rooms/${room.roomCode}/players`).set('Authorization', `Bearer ${admin.token}`).send({ playerId: first, basePrice: 100, auctionOrder: 1 });
    const secondResponse = await request(app).post(`${BASE}/rooms/${room.roomCode}/players`).set('Authorization', `Bearer ${admin.token}`).send({ playerId: second, basePrice: 100, auctionOrder: 2 });
    const firstRoomPlayer = firstResponse.body.data.roomPlayer._id as string;
    const secondRoomPlayer = secondResponse.body.data.roomPlayer._id as string;

    const reorder = await request(app).patch(`${BASE}/rooms/${room.roomCode}/players/reorder`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ players: [{ roomPlayerId: firstRoomPlayer, auctionOrder: 2 }, { roomPlayerId: secondRoomPlayer, auctionOrder: 1 }] });
    expect(reorder.status).toBe(200);

    expect((await request(app).post(`${BASE}/rooms/${room.roomCode}/start`).set('Authorization', `Bearer ${admin.token}`)).status).toBe(200);
    expect((await request(app).patch(`${BASE}/rooms/${room.roomCode}/players/${firstRoomPlayer}`).set('Authorization', `Bearer ${admin.token}`).send({ basePrice: 200 })).status).toBe(409);
    expect((await request(app).delete(`${BASE}/rooms/${room.roomCode}/players/${secondRoomPlayer}`).set('Authorization', `Bearer ${admin.token}`)).status).toBe(409);
  });
});