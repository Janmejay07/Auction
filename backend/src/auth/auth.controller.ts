import type { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { UserRepository } from '../users/user.repository';
import { registerSchema, loginSchema } from './auth.validation';
import { ValidationError } from '../common/errors';

// Singleton service (stateless – safe to share)
const authService = new AuthService(new UserRepository());

export const authController = {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.errors.map((e) => e.message).join('; '),
        );
      }

      const result = await authService.register(parsed.data);

      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.errors.map((e) => e.message).join('; '),
        );
      }

      const result = await authService.login(parsed.data);

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // userId is guaranteed by the authenticate middleware
      const userId = req.userId as string;
      const user = await authService.getMe(userId);

      res.status(200).json({
        success: true,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          user,
        },
      });
    } catch (err) {
      next(err);
    }
  },
};
