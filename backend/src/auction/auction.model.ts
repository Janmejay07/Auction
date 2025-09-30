import { Schema, model, Model } from 'mongoose';
import type { IAuction } from '../common/types/domain';
import { AuctionStatus } from '../common/types/domain';

const auctionSchema = new Schema<IAuction>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'AuctionRoom', required: true },
    roomPlayerId: {
      type: Schema.Types.ObjectId,
      ref: 'RoomPlayer',
      required: true,
    },
    playerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    status: {
      type: String,
      enum: Object.values(AuctionStatus),
      default: AuctionStatus.CREATED,
      required: true,
    },
    startingPrice: { type: Number, required: true, min: 0 },
    currentHighestBid: { type: Number, min: 0 },
    currentHighestParticipantId: {
      type: Schema.Types.ObjectId,
      ref: 'Participant',
    },
    bidCount: { type: Number, default: 0, min: 0 },
    sequence: { type: Number, default: 0, min: 0 },
    version: { type: Number, default: 0, min: 0 },
    hasStartedBidding: { type: Boolean, default: false },
    timerEndsAt: { type: Date },
    winnerParticipantId: { type: Schema.Types.ObjectId, ref: 'Participant' },
    winningAmount: { type: Number, min: 0 },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date },
  },
  {
    versionKey: false,
  },
);

// Primary auction lookup patterns
auctionSchema.index({ roomId: 1, status: 1 });
auctionSchema.index({ roomId: 1, playerId: 1 });
// Current live auction for a room
auctionSchema.index({ roomId: 1, status: 1, startedAt: -1 });

export const AuctionModel: Model<IAuction> = model<IAuction>(
  'Auction',
  auctionSchema,
);
