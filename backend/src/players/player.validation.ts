import { z } from 'zod';
import { PlayerPosition } from '../common/types/domain';

export const createPlayerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  position: z.nativeEnum(PlayerPosition),
  image: z.string().url().optional(),
  nationality: z.string().trim().max(80).optional(),
  club: z.string().trim().max(100).optional(),
  age: z.number().int().min(15).max(50).optional(),
  rating: z.number().min(0).max(100).optional(),
});

export type CreatePlayerInput = z.infer<typeof createPlayerSchema>;