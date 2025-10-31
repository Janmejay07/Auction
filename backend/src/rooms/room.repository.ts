import { AuctionRoomModel } from './room.model';
import type {
  IAuctionRoom,
  CreateRoomDTO,
  RoomStatus,
} from '../common/types/domain';
import type { ClientSession, Types } from 'mongoose';

export class RoomRepository {
  async findById(id: string): Promise<IAuctionRoom | null> {
    return AuctionRoomModel.findById(id).lean();
  }

  async findRoomByCode(roomCode: string): Promise<IAuctionRoom | null> {
    return AuctionRoomModel.findOne({ roomCode: roomCode.toUpperCase() }).lean();
  }

  async createRoom(dto: CreateRoomDTO): Promise<IAuctionRoom> {
    const room = await AuctionRoomModel.create(dto);
    return room.toObject();
  }

  async findByStatus(status: RoomStatus): Promise<IAuctionRoom[]> {
    return AuctionRoomModel.find({ status }).lean();
  }

  async findByCreator(creatorUserId: string): Promise<IAuctionRoom[]> {
    return AuctionRoomModel.find({ creatorUserId }).lean();
  }

  async updateStatus(
    id: string,
    status: RoomStatus,
    extra?: Partial<Pick<IAuctionRoom, 'startedAt' | 'completedAt'>>,
  ): Promise<IAuctionRoom | null> {
    return AuctionRoomModel.findByIdAndUpdate(
      id,
      { $set: { status, ...extra } },
      { new: true },
    ).lean();
  }

  async transitionStatus(
    id: string,
    from: RoomStatus,
    to: RoomStatus,
    extra?: Partial<Pick<IAuctionRoom, 'startedAt' | 'completedAt'>>,
  ): Promise<IAuctionRoom | null> {
    return AuctionRoomModel.findOneAndUpdate(
      { _id: id, status: from },
      { $set: { status: to, ...extra } },
      { new: true },
    ).lean();
  }

  async setCurrentAuction(
    roomId: string,
    auctionId: Types.ObjectId | null,
    session?: ClientSession,
  ): Promise<void> {
    await AuctionRoomModel.updateOne(
      { _id: roomId },
      auctionId
        ? { $set: { currentAuctionId: auctionId } }
        : { $unset: { currentAuctionId: '' } },
    ).session(session ?? null);
  }

  async roomCodeExists(roomCode: string): Promise<boolean> {
    const doc = await AuctionRoomModel.exists({
      roomCode: roomCode.toUpperCase(),
    });
    return doc !== null;
  }

  /** Transfer room creator ownership to a different user. */
  async updateCreator(
    roomId: string,
    newCreatorUserId: Types.ObjectId,
  ): Promise<void> {
    await AuctionRoomModel.updateOne(
      { _id: roomId },
      { $set: { creatorUserId: newCreatorUserId } },
    );
  }
}
