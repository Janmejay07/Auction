import { Schema, model, Model } from 'mongoose';
import type { IRoomPlayer } from '../common/types/domain';
import { RoomPlayerStatus } from '../common/types/domain';

const roomPlayerSchema = new Schema<IRoomPlayer>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'AuctionRoom', required: true },
    playerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    bucket: { type: String, trim: true },
    round: { type: Number, default: 1 },
    clubGroup: { type: String, trim: true },
    position: { type: String, trim: true },
    basePrice: { type: Number, required: true, min: 0 },
    auctionOrder: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: Object.values(RoomPlayerStatus),
      default: RoomPlayerStatus.PENDING,
      required: true,
    },
    soldToParticipantId: { type: Schema.Types.ObjectId, ref: 'Participant' },
    soldPrice: { type: Number, min: 0 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

// The primary query for "next player to auction" in order
roomPlayerSchema.index({ roomId: 1, status: 1, auctionOrder: 1 });
// Fast lookup of all room players
roomPlayerSchema.index({ roomId: 1 });
roomPlayerSchema.index({ roomId: 1, playerId: 1 }, { unique: true });
roomPlayerSchema.index({ roomId: 1, auctionOrder: 1 }, { unique: true });

export const RoomPlayerModel: Model<IRoomPlayer> = model<IRoomPlayer>(
  'RoomPlayer',
  roomPlayerSchema,
);
