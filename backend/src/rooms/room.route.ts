import { Router } from 'express';
import { roomController } from './room.controller';
import { authenticate } from '../common/middleware/authenticate';
import {
  requireRoomParticipant,
  requireRoomCreator,
} from '../common/middleware/authorization';

const roomRouter = Router();

// Room Creation & Joining (Authenticated)
roomRouter.post('/rooms', authenticate, roomController.create);
roomRouter.post('/rooms/:roomCode/join', authenticate, roomController.join);

// Room Access (Authenticated participants of that room only)
roomRouter.get(
  '/rooms/:roomCode',
  authenticate,
  requireRoomParticipant,
  roomController.getRoom,
);
roomRouter.get(
  '/rooms/:roomCode/participants',
  authenticate,
  requireRoomParticipant,
  roomController.getParticipants,
);

// Room Lifecycle (Authenticated)
roomRouter.post(
  '/rooms/:roomCode/start',
  authenticate,
  requireRoomCreator,
  roomController.start,
);
roomRouter.post(
  '/rooms/:roomCode/auction/start',
  authenticate,
  requireRoomCreator,
  roomController.startAuction,
);
roomRouter.post('/rooms/:roomCode/leave', authenticate, roomController.leave);
roomRouter.post('/rooms/:roomCode/ready', authenticate, requireRoomParticipant, roomController.ready);
roomRouter.post('/rooms/:roomCode/players', authenticate, requireRoomCreator, roomController.addPlayer);
roomRouter.delete('/rooms/:roomCode/players/:roomPlayerId', authenticate, requireRoomCreator, roomController.removePlayer);
roomRouter.patch('/rooms/:roomCode/players/reorder', authenticate, requireRoomCreator, roomController.reorderPlayers);
roomRouter.patch('/rooms/:roomCode/players/:roomPlayerId', authenticate, requireRoomCreator, roomController.updatePlayer);

export { roomRouter };
