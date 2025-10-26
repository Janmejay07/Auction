import { Schema, model, Model } from 'mongoose';
import type { IPlayer } from '../common/types/domain';
import { PlayerPosition } from '../common/types/domain';

const playerSchema = new Schema<IPlayer>(
  {
    name: { type: String, required: true, trim: true },
    image: { type: String },
    position: {
      type: String,
      enum: Object.values(PlayerPosition),
      required: true,
    },
    nationality: { type: String, trim: true },
    club: { type: String, trim: true },
    age: { type: Number, min: 15, max: 50 },
    rating: { type: Number, min: 0, max: 100 },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

playerSchema.index({ name: 1 });
playerSchema.index({ position: 1 });
playerSchema.index({ club: 1 });

export const PlayerModel: Model<IPlayer> = model<IPlayer>('Player', playerSchema);
