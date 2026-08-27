import { Schema, model, Model } from 'mongoose';
import type { ISquadPlayer } from '../common/types/domain';

const squadPlayerSchema = new Schema<ISquadPlayer>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'AuctionRoom', required: true },
    participantId: {
      type: Schema.Types.ObjectId,
      ref: 'Participant',
      required: true,
    },
    playerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    auctionId: { type: Schema.Types.ObjectId, ref: 'Auction', required: true },
    purchasePrice: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['STARTING_XI', 'RESERVE'],
      default: 'RESERVE',
      required: true,
    },
    pitchPosition: { type: String, default: null },
    purchasedAt: { type: Date, required: true, default: Date.now },
  },
  {
    versionKey: false,
  },
);

// Core squad queries: all players in a team
squadPlayerSchema.index({ roomId: 1, participantId: 1 });
// Verify player is not already in any squad in this room
squadPlayerSchema.index({ roomId: 1, playerId: 1 }, { unique: true });

export const SquadPlayerModel: Model<ISquadPlayer> = model<ISquadPlayer>(
  'SquadPlayer',
  squadPlayerSchema,
);
