import { AuctionEventModel } from './auctionEvent.model';
import type {
  IAuctionEvent,
  CreateAuctionEventDTO,
} from '../common/types/domain';
import type { ClientSession } from 'mongoose';

export class AuctionEventRepository {
  async createAuctionEvent(
    dto: CreateAuctionEventDTO,
    session?: ClientSession,
  ): Promise<IAuctionEvent> {
    const [event] = await AuctionEventModel.create([dto], { session });
    if (!event) throw new Error('Auction event creation returned no document');
    return event.toObject();
  }

  /** Ordered event replay for a room (full history). */
  async findByRoom(roomId: string): Promise<IAuctionEvent[]> {
    return AuctionEventModel.find({ roomId }).sort({ sequence: 1 }).lean();
  }

  /** Ordered event replay for a specific auction. */
  async findByAuction(auctionId: string): Promise<IAuctionEvent[]> {
    return AuctionEventModel.find({ auctionId }).sort({ sequence: 1 }).lean();
  }

  /** Next sequence number for a room's event log. */
  async nextSequence(roomId: string, session?: ClientSession): Promise<number> {
    const last = await AuctionEventModel.findOne({ roomId })
      .sort({ sequence: -1 })
      .select('sequence')
      .session(session ?? null)
      .lean();
    return last ? last.sequence + 1 : 0;
  }

  async findRecentByRoom(
    roomId: string,
    limit = 50,
  ): Promise<IAuctionEvent[]> {
    return AuctionEventModel.find({ roomId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
}
