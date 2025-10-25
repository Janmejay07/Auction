import type { Request, Response, NextFunction } from 'express';
import { PlayerRepository } from './player.repository';
import { createPlayerSchema } from './player.validation';
import { ValidationError, PlayerNotFoundError } from '../common/errors';

const playerRepo = new PlayerRepository();

export const playerController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createPlayerSchema.safeParse(req.body);
      if (!parsed.success) throw new ValidationError(parsed.error.errors.map((e) => e.message).join('; '));
      const player = await playerRepo.createPlayer(parsed.data);
      res.status(201).json({ success: true, data: { player } });
    } catch (err) { next(err); }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 100);
      const skip = Math.max(Number(req.query.skip) || 0, 0);
      const [players, total] = await Promise.all([playerRepo.findAll(limit, skip), playerRepo.count()]);
      res.status(200).json({ success: true, data: { players, total, limit, skip } });
    } catch (err) { next(err); }
  },

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const player = await playerRepo.findById(String(req.params.id));
      if (!player) throw new PlayerNotFoundError();
      res.status(200).json({ success: true, data: { player } });
    } catch (err) { next(err); }
  },
};