import { Router } from 'express';
import { squadController } from './squad.controller';
import { authenticate } from '../common/middleware/authenticate';
import { requireRoomParticipant } from '../common/middleware/authorization';

const squadRouter = Router();

// Get authenticated user's entire squad history across all auctions
squadRouter.get(
  '/squads/my-history',
  authenticate,
  squadController.getUserSquadsHistory,
);

// Get summary of all squads in the room
squadRouter.get(
  '/rooms/:roomCode/squads',
  authenticate,
  requireRoomParticipant,
  squadController.getRoomSquads,
);

// Get authenticated user's squad for the room
squadRouter.get(
  '/rooms/:roomCode/my-squad',
  authenticate,
  requireRoomParticipant,
  squadController.getMySquad,
);

// Get final squad for the room (alias to my-squad)
squadRouter.get(
  '/rooms/:roomCode/final-squad',
  authenticate,
  requireRoomParticipant,
  squadController.getMySquad,
);

// Get manager's squad (Starting XI, Reserves, Formation)
squadRouter.get(
  '/rooms/:roomCode/managers/:managerId/squad',
  authenticate,
  requireRoomParticipant,
  squadController.getManagerSquad,
);

// Update manager formation
squadRouter.patch(
  '/rooms/:roomCode/managers/:managerId/formation',
  authenticate,
  requireRoomParticipant,
  squadController.updateFormation,
);

// Move player between Starting XI and Reserves
squadRouter.patch(
  '/rooms/:roomCode/managers/:managerId/players/:squadPlayerId/status',
  authenticate,
  requireRoomParticipant,
  squadController.updatePlayerStatus,
);

// Direct atomic swap between Starting XI player and Reserve player
squadRouter.post(
  '/rooms/:roomCode/managers/:managerId/swap',
  authenticate,
  requireRoomParticipant,
  squadController.swapPlayers,
);

export { squadRouter };
