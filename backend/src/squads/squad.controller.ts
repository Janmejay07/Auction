import type { Request, Response, NextFunction } from 'express';
import { SquadService } from './squad.service';
import { ValidationError } from '../common/errors';
import { z } from 'zod';

const squadService = new SquadService();

const updateStatusSchema = z.object({
  status: z.enum(['STARTING_XI', 'RESERVE']),
  pitchPosition: z.string().nullable().optional(),
});

const swapSchema = z.object({
  startingPlayerId: z.string().min(1),
  reservePlayerId: z.string().min(1),
});

const formationSchema = z.object({
  formation: z.string().min(1),
});

export const squadController = {
  async getRoomSquads(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roomCode } = req.params as { roomCode: string };
      const data = await squadService.getRoomSquadsSummary(roomCode);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getManagerSquad(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roomCode, managerId } = req.params as { roomCode: string; managerId: string };
      const data = await squadService.getManagerSquad(roomCode, managerId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getMySquad(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId as string;
      const { roomCode } = req.params as { roomCode: string };
      const data = await squadService.getMySquad(userId, roomCode);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getUserSquadsHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId as string;
      const data = await squadService.getUserSquadsHistory(userId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async updatePlayerStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId as string;
      const { roomCode, managerId, squadPlayerId } = req.params as {
        roomCode: string;
        managerId: string;
        squadPlayerId: string;
      };

      const parsed = updateStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map((e) => e.message).join('; '));
      }

      const result = await squadService.updatePlayerStatus(
        userId,
        roomCode,
        managerId,
        squadPlayerId,
        parsed.data.status,
        parsed.data.pitchPosition,
      );

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async swapPlayers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId as string;
      const { roomCode, managerId } = req.params as { roomCode: string; managerId: string };

      const parsed = swapSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map((e) => e.message).join('; '));
      }

      const data = await squadService.swapPlayers(
        userId,
        roomCode,
        managerId,
        parsed.data.startingPlayerId,
        parsed.data.reservePlayerId,
      );

      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async updateFormation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId as string;
      const { roomCode, managerId } = req.params as { roomCode: string; managerId: string };

      const parsed = formationSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map((e) => e.message).join('; '));
      }

      const data = await squadService.updateFormation(
        userId,
        roomCode,
        managerId,
        parsed.data.formation,
      );

      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
