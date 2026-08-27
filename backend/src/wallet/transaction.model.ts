import { Schema, model, Model } from 'mongoose';
import type { ITransaction } from '../common/types/domain';
import { TransactionType } from '../common/types/domain';

const transactionSchema = new Schema<ITransaction>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'AuctionRoom', required: true },
    participantId: {
      type: Schema.Types.ObjectId,
      ref: 'Participant',
      required: true,
    },
    auctionId: { type: Schema.Types.ObjectId, ref: 'Auction' },
    type: {
      type: String,
      enum: Object.values(TransactionType),
      required: true,
    },
    amount: { type: Number, required: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

// Ledger queries: all transactions for a participant in a room
transactionSchema.index({ roomId: 1, participantId: 1 });
transactionSchema.index({ participantId: 1, createdAt: -1 });

export const TransactionModel: Model<ITransaction> = model<ITransaction>(
  'Transaction',
  transactionSchema,
);
