import type { Request, Response, NextFunction } from 'express';
import {
  UnauthorizedError,
  ForbiddenError,
  NotRoomCreatorError,
  RoomNotFoundError,
  AdminAccessRequiredError,
} from '../errors';
import { RoomRepository } from '../../rooms/room.repository';
import { ParticipantRepository } from '../../participants/participant.repository';
import { ParticipantStatus } from '../types/domain';
import { UserRepository } from '../../users/user.repository';

const roomRepo = new RoomRepository();
const participantRepo = new ParticipantRepository();
const userRepo = new UserRepository();

/**
 * Authorization helper: Check if request has an authenticated user.
 */
export function isAuthenticated(req: Request): boolean {
  return Boolean(req.userId);
}

export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.userId) throw new UnauthorizedError('Authentication required');
    const user = await userRepo.findById(req.userId);
    if (!user || user.role !== 'ADMIN') {
      throw new AdminAccessRequiredError();
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Authorization helper: Check if user is an active participant in the given room.
 */
export async function isRoomParticipant(
  roomIdOrCode: string,
  userId: string,
): Promise<boolean> {
  let roomId = roomIdOrCode;
  const room = await roomRepo.findRoomByCode(roomIdOrCode);
  if (room) {
    roomId = room._id.toString();
  }
  const participant = await participantRepo.findParticipant(roomId, userId);
  return Boolean(participant && participant.status === ParticipantStatus.ACTIVE);
}

/**
 * Authorization helper: Check if user is the creator of the given room.
 */
export async function isRoomCreator(
  roomIdOrCode: string,
  userId: string,
): Promise<boolean> {
  const room = await roomRepo.findRoomByCode(roomIdOrCode);
  if (!room) return false;
  return room.creatorUserId.toString() === userId;
}

/**
 * Express middleware to enforce that the authenticated user is an active participant of the room.
 * URL parameter must contain `:roomCode`.
 */
export async function requireRoomParticipant(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { roomCode } = req.params as { roomCode?: string };
    if (!roomCode) {
      throw new RoomNotFoundError('Room code is required');
    }

    const room = await roomRepo.findRoomByCode(roomCode);
    if (!room) {
      throw new RoomNotFoundError('Room not found');
    }

    const participant = await participantRepo.findParticipant(
      room._id.toString(),
      userId,
    );

    if (!participant || participant.status !== ParticipantStatus.ACTIVE) {
      throw new ForbiddenError('You are not an active participant in this room');
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Express middleware to enforce that the authenticated user is the creator of the room.
 * URL parameter must contain `:roomCode`.
 */
export async function requireRoomCreator(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { roomCode } = req.params as { roomCode?: string };
    if (!roomCode) {
      throw new RoomNotFoundError('Room code is required');
    }

    const room = await roomRepo.findRoomByCode(roomCode);
    if (!room) {
      throw new RoomNotFoundError('Room not found');
    }

    if (room.creatorUserId.toString() !== userId) {
      throw new NotRoomCreatorError('Only the room creator can perform this action');
    }

    next();
  } catch (err) {
    next(err);
  }
}
