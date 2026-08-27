import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../common/logger';
import { verifyToken } from '../common/utils/jwt';
import { RealtimeService } from './realtime.service';
import type { Socket } from 'socket.io';
import { ConflictError, type AppError } from '../common/errors';
import { z } from 'zod';

const roomName = (roomCode: string) => `room:${roomCode.toUpperCase()}`;
const roomEventSchema = z.object({ roomCode: z.string().trim().min(1).max(20) });
const bidEventSchema = roomEventSchema.extend({
  amount: z.number().finite().positive(),
  clientBidId: z.string().trim().min(1).max(100),
});
export const SOCKET_EVENTS = {
  PARTICIPANT_JOINED: 'participant:joined',
  PARTICIPANT_LEFT: 'participant:left',
  PARTICIPANT_ONLINE: 'participant:online',
  PARTICIPANT_OFFLINE: 'participant:offline',
  PARTICIPANT_READY: 'participant:ready',
  ROOM_CANCELLED: 'room:cancelled',
  AUCTION_STARTING: 'auction:starting',
  AUCTION_STARTED: 'auction:started',
  PLAYER_LIVE: 'player:live',
  BID_ACCEPTED: 'bid:accepted',
  PLAYER_SOLD: 'player:sold',
  PLAYER_UNSOLD: 'player:unsold',
  AUCTION_COMPLETED: 'auction:completed',
  BID_REJECTED: 'bid:rejected',
  SQUAD_UPDATED: 'squad:updated',
} as const;

let activeSocketIO: SocketIOServer | null = null;

export function getSocketIO(): SocketIOServer | null {
  return activeSocketIO;
}

export function emitRoomEvent(
  io: SocketIOServer,
  roomCode: string,
  event: string,
  payload: unknown,
): void {
  io.to(roomName(roomCode)).emit(event, payload);
}
const errorPayload = (error: unknown) => {
  const appError = error as Partial<AppError>;
  return { code: appError.code ?? 'SOCKET_ERROR', message: appError.message ?? 'Socket request failed' };
};

function authToken(socket: Socket): string {
  const auth = socket.handshake.auth?.token;
  if (typeof auth === 'string') return auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  const header = socket.handshake.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7);
  throw new Error('Authentication required');
}

/**
 * Create and configure the Socket.IO server.
 *
 * This sets up the transport layer only.  Auction-specific
 * event handlers will be registered in later parts.
 */
export function createSocketServer(
  httpServer: HttpServer,
  corsOrigin: string,
): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
    },
  });

  activeSocketIO = io;

  io.use((socket, next) => {
    try {
      socket.data.userId = verifyToken(authToken(socket)).userId;
      next();
    } catch {
      next(new Error('Authentication required'));
    }
  });

  const realtimeService = new RealtimeService();
  const bidRequests = new Map<string, number[]>();
  realtimeService.setAuctionEventHandler((event) => {
    emitRoomEvent(io, event.roomCode, event.event, event.payload);
  });
  void realtimeService.recoverAuctions().catch((error: unknown) => {
    logger.error({ err: error }, 'Auction recovery failed');
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    const joinedRooms = new Set<string>();
    logger.info({ socketId: socket.id, userId }, 'Socket client connected');

    socket.on('room:join', async (data: { roomCode?: string }, ack?: (result: unknown) => void) => {
      try {
        const parsed = roomEventSchema.safeParse(data);
        if (!parsed.success) throw new Error('roomCode is required and must be valid');
        const access = await realtimeService.getRoomAccess(userId, parsed.data.roomCode);
        const code = access.room.roomCode;
        const channel = roomName(code);
        socket.join(channel);
        joinedRooms.add(channel);
        const result = { ok: true, roomCode: code, participant: access.participant };
        ack?.(result);
        socket.to(channel).emit(SOCKET_EVENTS.PARTICIPANT_JOINED, { participant: access.participant });
        socket.to(channel).emit(SOCKET_EVENTS.PARTICIPANT_ONLINE, { participant: access.participant, userId });
      } catch (error) {
        ack?.({ ok: false, error: errorPayload(error) });
      }
    });

    socket.on('room:ready', async (data: { roomCode?: string; isReady?: boolean }, ack?: (result: unknown) => void) => {
      try {
        const parsed = roomEventSchema.safeParse(data);
        if (!parsed.success) throw new Error('roomCode is required and must be valid');
        const isReady = typeof data.isReady === 'boolean' ? data.isReady : true;
        const participant = await realtimeService.setReady(userId, parsed.data.roomCode, isReady);
        const channel = roomName(parsed.data.roomCode);
        io.to(channel).emit(SOCKET_EVENTS.PARTICIPANT_READY, {
          participantId: participant._id,
          userId: participant.userId,
          isReady: participant.isReady,
          participant,
        });
        ack?.({ ok: true, participant });
      } catch (error) {
        ack?.({ ok: false, error: errorPayload(error) });
      }
    });

    socket.on('room:leave', async (data: { roomCode?: string }, ack?: (result: unknown) => void) => {
      try {
        const parsed = roomEventSchema.safeParse(data);
        if (!parsed.success) throw new Error('roomCode is required and must be valid');
        const { room, participant } = await realtimeService.leaveRoom(userId, parsed.data.roomCode);
        const channel = roomName(parsed.data.roomCode);
        socket.leave(channel);
        joinedRooms.delete(channel);
        io.to(channel).emit(SOCKET_EVENTS.PARTICIPANT_LEFT, {
          participantId: participant._id,
          userId: participant.userId,
          teamName: participant.teamName,
          status: 'INACTIVE',
          isReady: false,
          participant,
        });
        if (room.status === 'CANCELLED') {
          io.to(channel).emit(SOCKET_EVENTS.ROOM_CANCELLED, { roomCode: room.roomCode });
        }
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: errorPayload(error) });
      }
    });

    socket.on('room:sync', async (data: { roomCode?: string }, ack?: (result: unknown) => void) => {
      try {
        const parsed = roomEventSchema.safeParse(data);
        if (!parsed.success) throw new Error('roomCode is required and must be valid');
        const sync = await realtimeService.sync(userId, parsed.data.roomCode);
        ack?.({ ok: true, data: sync });
      } catch (error) {
        ack?.({ ok: false, error: errorPayload(error) });
      }
    });

    socket.on('bid:place', async (data: { roomCode?: string; amount?: number; clientBidId?: string }, ack?: (result: unknown) => void) => {
      try {
        const parsed = bidEventSchema.safeParse(data);
        if (!parsed.success) throw new Error('roomCode, amount, and clientBidId are required and must be valid');
        const key = `${userId}:${parsed.data.roomCode.toUpperCase()}`;
        const now = Date.now();
        const recent = (bidRequests.get(key) ?? []).filter((timestamp) => now - timestamp < 1000);
        if (recent.length >= 20) throw new ConflictError('Too many bids; please retry shortly', 'BID_RATE_LIMITED');
        recent.push(now);
        bidRequests.set(key, recent);
        const result = await realtimeService.placeBid(userId, parsed.data);
        const payload = { auction: result.auction, bid: result.bid };
        ack?.({ ok: true, data: payload });
      } catch (error) {
        const payload = { error: errorPayload(error) };
        ack?.({ ok: false, ...payload });
        socket.emit(SOCKET_EVENTS.BID_REJECTED, payload);
      }
    });

    socket.on('disconnect', (reason) => {
      for (const channel of joinedRooms) socket.to(channel).emit(SOCKET_EVENTS.PARTICIPANT_OFFLINE, { userId });
      logger.info({ socketId: socket.id, reason }, 'Socket client disconnected');
    });
  });

  logger.info('Socket.IO server initialised');

  return io;
}
