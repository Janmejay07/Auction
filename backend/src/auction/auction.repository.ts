import { AuctionModel } from './auction.model';
import type {
  IAuction,
  CreateAuctionDTO,
  AuctionStatus,
} from '../common/types/domain';
import type { ClientSession, Types } from 'mongoose';

export class AuctionRepository {
  async findById(id: string): Promise<IAuction | null> {
    return AuctionModel.findById(id).lean();
  }

  /**
   * Find the current LIVE auction for a room.
   * Hot path – uses the (roomId, status) index.
   */
  async findCurrentAuction(roomId: string): Promise<IAuction | null> {
    return AuctionModel.findOne({ roomId, status: 'LIVE' }).lean();
  }

  async findByStatus(roomId: string, status: AuctionStatus): Promise<IAuction[]> {
    return AuctionModel.find({ roomId, status }).lean();
  }

  async findAllByStatus(status: AuctionStatus): Promise<IAuction[]> {
    return AuctionModel.find({ status }).lean();
  }

  async createAuction(dto: CreateAuctionDTO): Promise<IAuction> {
    const auction = await AuctionModel.create(dto);
    return auction.toObject();
  }

  /**
   * Atomic bid update using optimistic concurrency.
   *
   * Matches on version to prevent lost updates when two bids
   * arrive simultaneously. Returns null if the version has
   * already changed (caller should retry or reject the bid).
   */
  async applyBid(
    auctionId: string,
    expectedVersion: number,
    amount: number,
    participantId: Types.ObjectId,
    nextSequence: number,
    timerEndsAt: Date,
  ): Promise<IAuction | null> {
    return AuctionModel.findOneAndUpdate(
      { _id: auctionId, version: expectedVersion, status: 'LIVE' },
      {
        $set: {
          currentHighestBid: amount,
          currentHighestParticipantId: participantId,
          hasStartedBidding: true,
          timerEndsAt,
          sequence: nextSequence,
        },
        $inc: { bidCount: 1, version: 1 },
      },
      { new: true },
    ).lean();
  }

  async updateStatus(
    id: string,
    status: AuctionStatus,
    extra?: Partial<
      Pick<
        IAuction,
        'winnerParticipantId' | 'winningAmount' | 'completedAt'
      >
    >,
  ): Promise<IAuction | null> {
    return AuctionModel.findByIdAndUpdate(
      id,
      { $set: { status, ...extra } },
      { new: true },
    ).lean();
  }

  async transitionStatus(
    id: string,
    from: AuctionStatus,
    to: AuctionStatus,
    extra?: Partial<Pick<IAuction, 'winnerParticipantId' | 'winningAmount' | 'completedAt'>>,
    session?: ClientSession,
  ): Promise<IAuction | null> {
    return AuctionModel.findOneAndUpdate(
      { _id: id, status: from },
      { $set: { status: to, ...extra } },
      { new: true, $inc: { version: 1 } },
    ).session(session ?? null).lean();
  }

  async findByRoomAndPlayer(
    roomId: string,
    playerId: string,
  ): Promise<IAuction | null> {
    return AuctionModel.findOne({ roomId, playerId }).lean();
  }

  async findLatestByRoom(roomId: string): Promise<IAuction | null> {
    return AuctionModel.findOne({ roomId }).sort({ startedAt: -1, _id: -1 }).lean();
  }
}
