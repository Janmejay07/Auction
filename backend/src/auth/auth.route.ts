import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../common/middleware/authenticate';

const authRouter = Router();

authRouter.post('/auth/register', authController.register);
authRouter.post('/auth/login', authController.login);
authRouter.get('/auth/me', authenticate, authController.me);

export { authRouter };
