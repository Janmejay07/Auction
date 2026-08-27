import { Router } from 'express';
import { playerController } from './player.controller';
import { authenticate, requireAdmin } from '../common/middleware';

const playerRouter = Router();
playerRouter.post('/players', authenticate, requireAdmin, playerController.create);
playerRouter.get('/players', authenticate, requireAdmin, playerController.list);
playerRouter.get('/players/:id', authenticate, requireAdmin, playerController.get);

export { playerRouter };