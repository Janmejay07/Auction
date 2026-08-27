import { Schema, model, Model } from 'mongoose';
import type { IAuctionEvent } from '../common/types/domain';
import { AuctionEventType } from '../common/types/domain';

const auctionEventSchema = new Schema<IAuctionEvent>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'AuctionRoom', required: true },
    auctionId: { type: Schema.Types.ObjectId, ref: 'Auction' },
    type: {
      type: String,
      enum: Object.values(AuctionEventType),
      required: true,
    },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    participantId: { type: Schema.Types.ObjectId, ref: 'Participant' },
    sequence: { type: Number, required: true, min: 0 },
    payload: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

// Replay all events for a room in order
auctionEventSchema.index({ roomId: 1, sequence: 1 });
// Replay events for a specific auction
auctionEventSchema.index({ auctionId: 1, sequence: 1 });
// Recent event queries
auctionEventSchema.index({ roomId: 1, createdAt: -1 });

export const AuctionEventModel: Model<IAuctionEvent> = model<IAuctionEvent>(
  'AuctionEvent',
  auctionEventSchema,
);
