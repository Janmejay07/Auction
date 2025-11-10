import { TransactionModel } from './transaction.model';
import type {
  ITransaction,
  CreateTransactionDTO,
} from '../common/types/domain';
import type { ClientSession } from 'mongoose';

export class TransactionRepository {
  async createTransaction(dto: CreateTransactionDTO, session?: ClientSession): Promise<ITransaction> {
    const [tx] = await TransactionModel.create([dto], { session });
    if (!tx) throw new Error('Transaction creation returned no document');
    return tx.toObject();
  }

  async findByParticipant(
    roomId: string,
    participantId: string,
  ): Promise<ITransaction[]> {
    return TransactionModel.find({ roomId, participantId })
      .sort({ createdAt: -1 })
      .lean();
  }

  async findByRoom(roomId: string): Promise<ITransaction[]> {
    return TransactionModel.find({ roomId }).sort({ createdAt: -1 }).lean();
  }

  async findByAuction(auctionId: string): Promise<ITransaction[]> {
    return TransactionModel.find({ auctionId }).lean();
  }
}
