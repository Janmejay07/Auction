import { z } from 'zod';

export const createRoomSchema = z.object({
  teamName: z.string().min(1).max(50).trim().optional().default('Creator Team'),
  settings: z.object({
    purseTotal: z.number().int().positive('purseTotal must be greater than 0'),
    squadLimit: z.number().int().positive('squadLimit must be greater than 0'),
    bidIncrement: z.number().int().positive('bidIncrement must be greater than 0'),
    bidTimerSeconds: z.number().int().positive('bidTimerSeconds must be greater than 0'),
  }),
});

export const joinRoomSchema = z.object({
  teamName: z.string().min(1).max(50).trim(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
