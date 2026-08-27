import { BidModel } from './bid.model';
import type { IBid, CreateBidDTO } from '../common/types/domain';

export class BidRepository {
  async findById(id: string): Promise<IBid | null> {
    return BidModel.findById(id).lean();
  }

  async createBid(dto: CreateBidDTO): Promise<IBid> {
    const bid = await BidModel.create(dto);
    return bid.toObject();
  }

  /**
   * Idempotent bid lookup – used before inserting to check
   * whether a clientBidId has already been processed.
   */
  async findByClientBidId(
    roomId: string,
    clientBidId: string,
  ): Promise<IBid | null> {
    return BidModel.findOne({ roomId, clientBidId }).lean();
  }

  /** Ordered bid history for an auction – used for replay and display. */
  async findByAuction(auctionId: string): Promise<IBid[]> {
    return BidModel.find({ auctionId }).sort({ sequence: 1 }).lean();
  }

  async findLatestBid(auctionId: string): Promise<IBid | null> {
    return BidModel.findOne({ auctionId }).sort({ sequence: -1 }).lean();
  }

  async countByAuction(auctionId: string): Promise<number> {
    return BidModel.countDocuments({ auctionId });
  }

  async findByParticipant(
    participantId: string,
    auctionId?: string,
  ): Promise<IBid[]> {
    const filter = auctionId ? { participantId, auctionId } : { participantId };
    return BidModel.find(filter).sort({ sequence: -1 }).lean();
  }
}
