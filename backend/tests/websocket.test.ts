import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import http from 'http';
import { io as connect, type Socket } from 'socket.io-client';
import { Types } from 'mongoose';
import { app } from '../src/app';
import { createSocketServer } from '../src/websocket';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db';
import { PlayerRepository } from '../src/players/player.repository';
import { AuctionRepository } from '../src/auction/auction.repository';
import { RoomStatus, AuctionStatus } from '../src/common/types/domain';

const BASE = '/api/v1';
const settings = { purseTotal: 100000, squadLimit: 15, bidIncrement: 100, bidTimerSeconds: 15 };
let httpServer: http.Server;
let ioServer: ReturnType<typeof createSocketServer>;
let address: string;

async function register(n: number) {
  const response = await request(app).post(`${BASE}/auth/register`).send({
    name: `Socket User ${n}`, email: `socket${n}@test.com`, password: 'password1234',
  });
  return { token: response.body.data.token as string, userId: response.body.data.user._id as string };
}

async function createRoom(token: string, teamName: string) {
  const response = await request(app).post(`${BASE}/rooms`).set('Authorization', `Bearer ${token}`).send({ teamName, settings });
  return response.body.data as { room: { _id: string; roomCode: string }; participant: { _id: string } };
}

function socket(token?: string): Socket {
  return connect(address, { auth: token ? { token } : {}, transports: ['websocket'], autoConnect: true });
}

function connected(client: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    client.once('connect', () => resolve());
    client.once('connect_error', reject);
  });
}

function event<T>(client: Socket, name: string): Promise<T> {
  return new Promise((resolve) => client.once(name, resolve));
}

describe('Socket.IO realtime backend', () => {
  beforeAll(async () => {
    await setupTestDb();
    httpServer = http.createServer(app);
    ioServer = createSocketServer(httpServer, '*');
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const port = (httpServer.address() as { port: number }).port;
    address = `http://localhost:${port}`;
  });

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    ioServer.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await teardownTestDb();
  });

  it('rejects missing or invalid JWT during connection', async () => {
    const missing = socket();
    await expect(connected(missing)).rejects.toThrow(/authentication/i);
    missing.close();
    const invalid = socket('not-a-token');
    await expect(connected(invalid)).rejects.toThrow(/authentication/i);
    invalid.close();
  });

  it('joins only authorized rooms and supports reconnect plus sync', async () => {
    const user = await register(1);
    const room = await createRoom(user.token, 'Alpha');
    const client = socket(user.token);
    await connected(client);
    const joined = await new Promise<{ ok: boolean; roomCode: string }>((resolve) => {
      client.emit('room:join', { roomCode: room.room.roomCode }, resolve);
    });
    expect(joined.ok).toBe(true);
    expect(joined.roomCode).toBe(room.room.roomCode);
    const sync = await new Promise<{ ok: boolean; data: { room: { status: string }; participants: unknown[]; serverTime: string } }>((resolve) => {
      client.emit('room:sync', { roomCode: room.room.roomCode }, resolve);
    });
    expect(sync.ok).toBe(true);
    expect(sync.data.room.status).toBe(RoomStatus.WAITING);
    expect(sync.data.participants).toHaveLength(1);
    expect(sync.data.serverTime).toBeDefined();
    client.close();

    const reconnected = socket(user.token);
    await connected(reconnected);
    const joinedAgain = await new Promise<{ ok: boolean }>((resolve) => {
      reconnected.emit('room:join', { roomCode: room.room.roomCode }, resolve);
    });
    expect(joinedAgain.ok).toBe(true);
    reconnected.close();
  });

  it('keeps presence and bid events isolated between rooms', async () => {
    const userA = await register(1);
    const userB = await register(2);
    const roomA = await createRoom(userA.token, 'Alpha');
    const roomB = await createRoom(userB.token, 'Beta');
    const player = await new PlayerRepository().createPlayer({ name: 'Live Player', position: 'GK' });
    await new AuctionRepository().createAuction({
      roomId: new Types.ObjectId(roomA.room._id), roomPlayerId: new Types.ObjectId(), playerId: player._id,
      status: AuctionStatus.LIVE, startingPrice: 100, bidCount: 0, sequence: 0, version: 0,
      hasStartedBidding: false, startedAt: new Date(),
    });
    const clientA = socket(userA.token);
    const clientB = socket(userB.token);
    const observer = socket(userA.token);
    await Promise.all([connected(clientA), connected(clientB), connected(observer)]);
    await Promise.all([
      new Promise((resolve) => clientA.emit('room:join', { roomCode: roomA.room.roomCode }, resolve)),
      new Promise((resolve) => clientB.emit('room:join', { roomCode: roomB.room.roomCode }, resolve)),
      new Promise((resolve) => observer.emit('room:join', { roomCode: roomA.room.roomCode }, resolve)),
    ]);
    const offline = event<{ userId: string }>(observer, 'participant:offline');
    const foreignJoin = await new Promise<{ ok: boolean; error: { code: string } }>((resolve) => {
      clientB.emit('room:join', { roomCode: roomA.room.roomCode }, resolve);
    });
    expect(foreignJoin.ok).toBe(false);
    expect(foreignJoin.error.code).toBe('ROOM_ACCESS_DENIED');

    const unrelatedEvent = event(clientB, 'bid:accepted');
    const accepted = await new Promise<{ ok: boolean }>((resolve) => {
      clientA.emit('bid:place', { roomCode: roomA.room.roomCode, amount: 100, clientBidId: 'socket-bid-1' }, resolve);
    });
    expect(accepted.ok).toBe(true);
    await expect(Promise.race([unrelatedEvent, new Promise((resolve) => setTimeout(() => resolve('timeout'), 100))])).resolves.toBe('timeout');
    clientA.close();
    await expect(offline).resolves.toMatchObject({ userId: userA.userId });
    clientB.close();
    observer.close();
  });

  it('derives bid participant from the authenticated socket user', async () => {
    const creator = await register(1);
    const joiner = await register(2);
    const room = await createRoom(creator.token, 'Alpha');
    await request(app).post(`${BASE}/rooms/${room.room.roomCode}/join`).set('Authorization', `Bearer ${joiner.token}`).send({ teamName: 'Beta' });
    const participants = await request(app).get(`${BASE}/rooms/${room.room.roomCode}/participants`).set('Authorization', `Bearer ${creator.token}`);
    const joinerParticipant = participants.body.data.participants.find((participant: { userId: string }) => participant.userId === joiner.userId);
    const player = await new PlayerRepository().createPlayer({ name: 'Trusted Player', position: 'FWD' });
    const auction = await new AuctionRepository().createAuction({
      roomId: new Types.ObjectId(room.room._id), roomPlayerId: new Types.ObjectId(), playerId: player._id,
      status: AuctionStatus.LIVE, startingPrice: 100, bidCount: 0, sequence: 0, version: 0,
      hasStartedBidding: false, startedAt: new Date(),
    });
    const client = socket(joiner.token);
    await connected(client);
    await new Promise((resolve) => client.emit('room:join', { roomCode: room.room.roomCode }, resolve));
    const result = await new Promise<{ ok: boolean; data: { bid: { userId: string; participantId: string } } }>((resolve) => {
      client.emit('bid:place', { roomCode: room.room.roomCode, amount: 100, clientBidId: 'identity-bid', participantId: new Types.ObjectId().toString() }, resolve);
    });
    expect(result.ok).toBe(true);
    expect(result.data.bid.userId).toBe(joiner.userId);
    expect(result.data.bid.participantId).toBe(joinerParticipant.participantId);
    expect(auction._id).toBeDefined();
    client.close();
  });
});