import type { Request, Response, NextFunction } from 'express';
import { RoomService } from './room.service';
import { RoomRepository } from './room.repository';
import { ParticipantRepository } from '../participants/participant.repository';
import { RoomPlayerRepository } from '../roomPlayers/roomPlayer.repository';
import { createRoomSchema, joinRoomSchema } from './room.validation';
import { ValidationError } from '../common/errors';
import { Types } from 'mongoose';
import { addRoomPlayerSchema, updateRoomPlayerSchema, reorderRoomPlayersSchema } from './roomPlayer.validation';
import { sharedAuctionEngine } from '../auction/auction.engine';
import { emitRoomEvent, getSocketIO, SOCKET_EVENTS } from '../websocket';

// Singleton service (stateless – safe to share)
const roomService = new RoomService(
  new RoomRepository(),
  new ParticipantRepository(),
  new RoomPlayerRepository(),
);
const auctionEngine = sharedAuctionEngine;

export const roomController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId as string;

      const parsed = createRoomSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.errors.map((e) => e.message).join('; '),
        );
      }

      const result = await roomService.createRoom(userId, parsed.data);

      res.status(201).json({
        success: true,
        data: {
          roomId: result.room._id.toString(),
          roomCode: result.room.roomCode,
          participantId: result.participant._id.toString(),
          settings: result.room.settings,
          room: result.room,
          participant: result.participant,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async join(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId as string;
      // roomCode comes from the URL – never from the body
      const { roomCode } = req.params as { roomCode: string };

      const parsed = joinRoomSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.errors.map((e) => e.message).join('; '),
        );
      }

      const participant = await roomService.joinRoom(userId, roomCode, parsed.data);

      res.status(201).json({
        success: true,
        data: {
          participant,
          participantId: participant._id.toString(),
          teamName: participant.teamName,
          status: participant.status,
          purseRemaining: participant.purseRemaining,
          squadCount: participant.squadCount,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId as string;
      const { roomCode } = req.params as { roomCode: string };

      const room = await roomService.startRoom(userId, roomCode);

      res.status(200).json({ success: true, data: { room } });
    } catch (err) {
      next(err);
    }
  },

  async startAuction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const room = await roomService.getRoomByCode(String(req.params.roomCode));
      const auction = await auctionEngine.startAuction(room._id.toString());
      res.status(200).json({ success: true, data: { auction } });
    } catch (err) { next(err); }
  },

  async leave(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId as string;
      const { roomCode } = req.params as { roomCode: string };

      const { room, participant } = await roomService.leaveRoom(userId, roomCode);

      const io = getSocketIO();
      if (io) {
        emitRoomEvent(io, roomCode, SOCKET_EVENTS.PARTICIPANT_LEFT, {
          participantId: participant._id,
          userId: participant.userId,
          teamName: participant.teamName,
          status: 'INACTIVE',
          isReady: false,
          participant,
        });
        if (room.status === 'CANCELLED') {
          emitRoomEvent(io, roomCode, SOCKET_EVENTS.ROOM_CANCELLED, { roomCode });
        }
      }

      res.status(200).json({ success: true, data: { message: 'Left room successfully' } });
    } catch (err) {
      next(err);
    }
  },

  async ready(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId as string;
      const { roomCode } = req.params as { roomCode: string };
      const isReady = typeof req.body.isReady === 'boolean' ? req.body.isReady : true;

      const participant = await roomService.setReady(userId, roomCode, isReady);

      const io = getSocketIO();
      if (io) {
        emitRoomEvent(io, roomCode, SOCKET_EVENTS.PARTICIPANT_READY, {
          participantId: participant._id,
          userId: participant.userId,
          isReady: participant.isReady,
          participant,
        });
      }

      res.status(200).json({ success: true, data: { participant } });
    } catch (err) {
      next(err);
    }
  },

  async getRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roomCode } = req.params as { roomCode: string };
      const roomDetails = await roomService.getRoomDetails(roomCode);
      res.status(200).json({
        success: true,
        data: {
          ...roomDetails,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async getParticipants(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { roomCode } = req.params as { roomCode: string };
      const participants = await roomService.getRoomParticipants(roomCode);
      const safeParticipants = participants.map((p) => ({
        _id: p._id.toString(),
        id: p._id.toString(),
        participantId: p._id.toString(),
        teamName: p.teamName,
        status: p.status,
        squadCount: p.squadCount,
        purse: p.purseRemaining,
        purseRemaining: p.purseRemaining,
        spent: p.totalSpent,
        totalSpent: p.totalSpent,
        initialPurse: p.initialPurse,
        isReady: Boolean(p.isReady),
        joinedAt: p.joinedAt,
        userId: p.userId.toString(),
      }));
      res.status(200).json({ success: true, data: { participants: safeParticipants } });
    } catch (err) {
      next(err);
    }
  },

  async addPlayer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = addRoomPlayerSchema.safeParse(req.body);
      if (!parsed.success) throw new ValidationError(parsed.error.errors.map((e) => e.message).join('; '));
      const player = await roomService.addRoomPlayer(req.userId as string, String(req.params.roomCode), {
        ...parsed.data, playerId: new Types.ObjectId(parsed.data.playerId), roomId: new Types.ObjectId(), status: 'PENDING',
      });
      res.status(201).json({ success: true, data: { roomPlayer: player } });
    } catch (err) { next(err); }
  },

  async removePlayer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await roomService.removeRoomPlayer(req.userId as string, String(req.params.roomCode), String(req.params.roomPlayerId));
      res.status(200).json({ success: true, data: { message: 'Room player removed' } });
    } catch (err) { next(err); }
  },

  async updatePlayer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = updateRoomPlayerSchema.safeParse(req.body);
      if (!parsed.success) throw new ValidationError(parsed.error.errors.map((e) => e.message).join('; '));
      const roomPlayer = await roomService.updateRoomPlayer(req.userId as string, String(req.params.roomCode), String(req.params.roomPlayerId), parsed.data);
      res.status(200).json({ success: true, data: { roomPlayer } });
    } catch (err) { next(err); }
  },

  async reorderPlayers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = reorderRoomPlayersSchema.safeParse(req.body);
      if (!parsed.success) throw new ValidationError(parsed.error.errors.map((e) => e.message).join('; '));
      const players = await roomService.reorderRoomPlayers(req.userId as string, String(req.params.roomCode), parsed.data.players);
      res.status(200).json({ success: true, data: { players } });
    } catch (err) { next(err); }
  },
};
