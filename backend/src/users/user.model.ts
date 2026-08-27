import { Schema, model, Model } from 'mongoose';
import type { IUser } from '../common/types/domain';
import { UserRole } from '../common/types/domain';

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    passwordHash: { type: String, select: false },
    avatar: { type: String },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Partial unique index: only enforce uniqueness when email is present
userSchema.index({ email: 1 }, { unique: true, sparse: true });

export const UserModel: Model<IUser> = model<IUser>('User', userSchema);
