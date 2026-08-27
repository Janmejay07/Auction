import { Schema, model, Model } from 'mongoose';
import type { IBid } from '../common/types/domain';

const bidSchema = new Schema<IBid>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'AuctionRoom', required: true },
    auctionId: { type: Schema.Types.ObjectId, ref: 'Auction', required: true },
    playerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    participantId: {
      type: Schema.Types.ObjectId,
      ref: 'Participant',
      required: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 1 },
    sequence: { type: Number, required: true, min: 1 },
    clientBidId: { type: String, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

// Reconstruct bid history in order for an auction
bidSchema.index({ auctionId: 1, sequence: 1 });
// Idempotency: reject duplicate client submissions
bidSchema.index({ roomId: 1, clientBidId: 1 }, { unique: true });
// Participant bid history
bidSchema.index({ participantId: 1, auctionId: 1 });

export const BidModel: Model<IBid> = model<IBid>('Bid', bidSchema);
