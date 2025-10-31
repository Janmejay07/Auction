import { Schema, model, Model } from 'mongoose';
import type { IAuctionRoom } from '../common/types/domain';
import { RoomStatus } from '../common/types/domain';

const roomSettingsSchema = new Schema(
  {
    purseTotal: { type: Number, required: true, min: 0 },
    squadLimit: { type: Number, required: true, min: 1 },
    bidIncrement: { type: Number, required: true, min: 1 },
    bidTimerSeconds: { type: Number, required: true, min: 5 },
  },
  { _id: false },
);

const auctionRoomSchema = new Schema<IAuctionRoom>(
  {
    roomCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    creatorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: Object.values(RoomStatus),
      default: RoomStatus.WAITING,
      required: true,
    },
    maxParticipants: { type: Number, default: 10, min: 2, max: 10 },
    minParticipants: { type: Number, default: 2, min: 2, max: 10 },
    settings: { type: roomSettingsSchema, required: true },
    currentAuctionId: { type: Schema.Types.ObjectId, ref: 'Auction' },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Required index: unique room codes
auctionRoomSchema.index({ roomCode: 1 }, { unique: true });
// Query by status for lobby listings
auctionRoomSchema.index({ status: 1 });
auctionRoomSchema.index({ creatorUserId: 1 });

export const AuctionRoomModel: Model<IAuctionRoom> = model<IAuctionRoom>(
  'AuctionRoom',
  auctionRoomSchema,
);
