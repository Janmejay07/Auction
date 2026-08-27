import { Schema, model, Model } from 'mongoose';
import type { IParticipant } from '../common/types/domain';
import { ParticipantStatus } from '../common/types/domain';

const participantSchema = new Schema<IParticipant>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'AuctionRoom', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    teamName: { type: String, required: true, trim: true },
    teamLogo: { type: String },
    initialPurse: { type: Number, required: true, min: 0 },
    purseRemaining: { type: Number, required: true, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
    squadCount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: Object.values(ParticipantStatus),
      default: ParticipantStatus.ACTIVE,
      required: true,
    },
    isReady: {
      type: Boolean,
      default: false,
    },
    formation: {
      type: String,
      default: '4-3-3',
    },
    joinedAt: { type: Date, required: true, default: Date.now },
    lastSeenAt: { type: Date, required: true, default: Date.now },
  },
  {
    versionKey: false,
  },
);

// A user can only join a given room once
participantSchema.index({ roomId: 1, userId: 1 }, { unique: true });
// Fetch all participants in a room quickly
participantSchema.index({ roomId: 1, status: 1 });

export const ParticipantModel: Model<IParticipant> = model<IParticipant>(
  'Participant',
  participantSchema,
);
