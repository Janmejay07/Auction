import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'must be a valid id');
const auctionOrder = z.number().int().min(0);

export const addRoomPlayerSchema = z.object({
  playerId: objectId,
  bucket: z.string().trim().min(1).max(40).optional(),
  basePrice: z.number().positive(),
  auctionOrder,
});

export const updateRoomPlayerSchema = z.object({
  bucket: z.string().trim().min(1).max(40).optional(),
  basePrice: z.number().positive().optional(),
  auctionOrder: auctionOrder.optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const reorderRoomPlayersSchema = z.object({
  players: z.array(z.object({ roomPlayerId: objectId, auctionOrder })).min(1),
});